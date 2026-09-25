import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEMO_USER_HEADER } from "./identity";
import { createFetchHandler } from "./http";
import { fileLog, formatLine, routeOf, type RequestLogEntry } from "./request-log";
import { demoWorld, ORIGIN } from "./test-harness";

// Ticket 32: reads of client data are events (ids only), and every request leaves one log line that
// carries a route pattern and a user id, never a path, query string, header or body.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterEach(() => setSystemTime());
afterAll(() => w.cleanup());

const views = (type: string, subjectId: string) =>
  w.all<{ actor_user_id: string | null; data: string; household_id: string | null; engagement_id: string | null }>(
    "SELECT actor_user_id, data, household_id, engagement_id FROM events WHERE type = ? AND subject_id = ?",
    type,
    subjectId,
  );

const clientDoc = () =>
  w.get<{ id: string; user: string; engagement_id: string; household_id: string }>(
    `SELECT d.id, u.id AS user, d.engagement_id, e.household_id FROM documents d
       JOIN engagements e ON e.id = d.engagement_id
       JOIN return_people rp ON rp.engagement_id = d.engagement_id AND rp.role = 'primary'
       JOIN users u ON u.person_id = rp.person_id
      WHERE d.purged_at IS NULL AND d.storage_key IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM events ev WHERE ev.subject_id = d.id AND ev.type = 'document.viewed')
      LIMIT 1`,
  );

describe("document.viewed", () => {
  test("a download writes one event, attributed, with ids and no file contents", async () => {
    const doc = clientDoc();
    const res = await w.portal(new Request(`${ORIGIN}/api/documents/${doc.id}/file`, { headers: { [DEMO_USER_HEADER]: doc.user } }));
    expect(res.status).toBe(200);
    const bytes = Buffer.from(await res.arrayBuffer()).toString("latin1");
    const [ev, ...more] = views("document.viewed", doc.id);
    expect(more).toHaveLength(0);
    expect(ev).toEqual({ actor_user_id: doc.user, data: "{}", household_id: doc.household_id, engagement_id: doc.engagement_id });
    expect(bytes.length).toBeGreaterThan(0);
    expect(ev!.data).not.toContain(bytes.slice(0, 16));
  });

  test("every download counts (they're deliberate), and a denied one records nothing", async () => {
    const doc = clientDoc();
    for (let i = 0; i < 2; i++) await w.handler(new Request(`${ORIGIN}/api/documents/${doc.id}/file`, { headers: { [DEMO_USER_HEADER]: w.preparerId } }));
    expect(views("document.viewed", doc.id)).toHaveLength(2);

    const other = w.get<{ id: string }>(
      "SELECT d.id FROM documents d WHERE d.engagement_id IS NOT NULL AND d.engagement_id NOT IN (SELECT engagement_id FROM client_access WHERE user_id = ?) AND d.purged_at IS NULL LIMIT 1",
      doc.user,
    );
    const denied = await w.portal(new Request(`${ORIGIN}/api/documents/${other.id}/file`, { headers: { [DEMO_USER_HEADER]: doc.user } }));
    expect(denied.status).toBe(404);
    expect(views("document.viewed", other.id)).toHaveLength(0);
  });
});

describe("engagement.viewed", () => {
  const someReturn = () => w.get<{ id: string }>("SELECT id FROM engagements WHERE tax_year = 2025 ORDER BY id DESC LIMIT 1").id;

  test("repeated opens within the hour write one; the next hour writes another", async () => {
    const id = someReturn();
    setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
    for (let i = 0; i < 3; i++) expect((await w.call(w.preparerId, "engagement.detail", { engagementId: id })).status).toBe(200);
    expect(views("engagement.viewed", id)).toHaveLength(1);
    setSystemTime(new Date("2026-10-01T10:59:00.000Z"));
    await w.call(w.preparerId, "engagement.detail", { engagementId: id });
    expect(views("engagement.viewed", id)).toHaveLength(1);
    setSystemTime(new Date("2026-10-01T11:01:00.000Z"));
    await w.call(w.preparerId, "engagement.detail", { engagementId: id });
    expect(views("engagement.viewed", id)).toHaveLength(2);
  });

  test("views stay out of the return's timeline and the household's last activity", async () => {
    const id = someReturn();
    const detail = await w.call(w.preparerId, "engagement.detail", { engagementId: id });
    const timeline = (detail.data as { timeline: { type: string }[] }).timeline;
    expect(timeline.some((t) => t.type.endsWith(".viewed"))).toBe(false);
    const hh = w.get<{ household_id: string }>("SELECT household_id FROM engagements WHERE id = ?", id).household_id;
    const last = w.get<{ at: string }>("SELECT MAX(occurred_at) AS at FROM events WHERE household_id = ? AND type NOT GLOB '*.viewed'", hh).at;
    const list = await w.call(w.preparerId, "household.list", { includeArchived: true });
    const row = (list.data as { id: string; lastActivityAt: string | null }[]).find((h) => h.id === hh)!;
    expect(row.lastActivityAt).toBe(last);
  });
});

describe("letter.viewed", () => {
  test("a client reading their letter is recorded, once an hour; the preparer's reads aren't", async () => {
    const r = w.get<{ engagement_id: string; letter_id: string; user: string }>(
      `SELECT e.id AS engagement_id, e.letter_id, u.id AS user FROM engagements e
         JOIN engagement_letters l ON l.id = e.letter_id AND l.status IN ('sent', 'signed')
         JOIN return_people rp ON rp.engagement_id = e.id AND rp.role = 'primary'
         JOIN users u ON u.person_id = rp.person_id LIMIT 1`,
    );
    for (let i = 0; i < 2; i++) expect((await w.call(r.user, "letter.get", { engagementId: r.engagement_id }, "query", "portal")).status).toBe(200);
    await w.call(w.preparerId, "letter.get", { engagementId: r.engagement_id });
    const got = views("letter.viewed", r.letter_id);
    expect(got.map((v) => v.actor_user_id)).toEqual([r.user]);
  });
});

describe("activity.list views filter", () => {
  test("show (the default), hide and only", async () => {
    const types = async (views?: string) => {
      const res = await w.call(w.preparerId, "activity.list", { limit: 200, ...(views ? { views } : {}) });
      return (res.data as { items: { type: string }[] }).items.map((i) => i.type);
    };
    const shown = await types();
    expect(shown.some((t) => t.endsWith(".viewed"))).toBe(true);
    expect(shown.some((t) => !t.endsWith(".viewed"))).toBe(true);
    expect((await types("hide")).some((t) => t.endsWith(".viewed"))).toBe(false);
    const only = await types("only");
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((t) => t.endsWith(".viewed"))).toBe(true);
  });
});

describe("request log", () => {
  const SSN = "900-12-3456";
  const collect = () => {
    const lines: string[] = [];
    const entries: RequestLogEntry[] = [];
    const log = (e: RequestLogEntry) => {
      entries.push(e);
      lines.push(formatLine(e));
    };
    return { lines, entries, admin: createFetchHandler({ surface: "admin", webDist: "/nonexistent", log }), portal: createFetchHandler({ surface: "portal", webDist: "/nonexistent", log }) };
  };

  test("one line per request: pattern, status, surface and user; never the path, query or headers", async () => {
    const c = collect();
    const doc = clientDoc();
    const input = encodeURIComponent(JSON.stringify({ search: SSN }));
    await c.admin(new Request(`${ORIGIN}/trpc/household.list?input=${input}`, { headers: { [DEMO_USER_HEADER]: w.preparerId } }));
    await c.portal(new Request(`${ORIGIN}/api/documents/${doc.id}/file?name=${SSN}`, { headers: { [DEMO_USER_HEADER]: doc.user, cookie: `x=${SSN}` } }));
    await c.portal(new Request(`${ORIGIN}/returns/${SSN}?q=${SSN}`));
    await c.portal(new Request(`${ORIGIN}/trpc/${SSN}`));
    await c.admin(new Request(`${ORIGIN}/api/${SSN}`));

    expect(c.entries.map(({ surface, method, route, status, user }) => ({ surface, method, route, status, user }))).toEqual([
      { surface: "admin", method: "GET", route: "/trpc/household.list", status: 200, user: w.preparerId },
      { surface: "portal", method: "GET", route: "/api/documents/:id/file", status: 200, user: doc.user },
      { surface: "portal", method: "GET", route: "/*", status: 503, user: null },
      { surface: "portal", method: "GET", route: "/trpc/:unknown", status: 404, user: null },
      { surface: "admin", method: "GET", route: "/api/:unknown", status: 404, user: w.preparerId }, // no header on admin: the demo preparer
    ]);
    for (const line of c.lines) {
      expect(line).not.toContain("?"); // no query string, ever
      expect(line).not.toContain(SSN);
      expect(line).not.toContain(doc.id);
      // Nothing SSN-shaped, dashed or not, once the user id (a UUID) is set aside.
      expect(line.split(" ").slice(0, -1).join(" ")).not.toMatch(/\d{3}-?\d{2}-?\d{4}/);
    }
    expect(c.lines[0]).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z admin GET \/trpc\/household\.list 200 \d+ms [0-9a-f-]{36}$/);
  });

  test("route patterns", () => {
    expect(routeOf("/trpc/engagement.detail,letter.get")).toBe("/trpc/engagement.detail,letter.get");
    expect(routeOf("/trpc/a%20b")).toBe("/trpc/:unknown");
    expect(routeOf("/api/documents")).toBe("/api/documents");
    expect(routeOf("/api/documents/not-an-id/file")).toBe("/api/:unknown");
    expect(routeOf("/assets/index-abc.js")).toBe("/assets/*");
    expect(routeOf("/health")).toBe("/health");
    expect(routeOf("/pipeline")).toBe("/*");
  });

  test("a failing logger never fails the request", async () => {
    const h = createFetchHandler({ surface: "admin", webDist: "/nonexistent", log: () => { throw new Error("disk full"); } });
    expect((await h(new Request(`${ORIGIN}/health`))).status).toBe(200);
  });

  test("the live file log is owner-only and rotates by size, keeping five", () => {
    const dir = mkdtempSync(join(tmpdir(), "btp-reqlog-"));
    try {
      const write = fileLog(dir, 100);
      for (let i = 0; i < 40; i++) write(`line ${i} ${"x".repeat(40)}`);
      const file = join(dir, "logs", "requests.log");
      expect(statSync(join(dir, "logs")).mode & 0o777).toBe(0o700);
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(readFileSync(file, "utf8")).toContain("line 39");
      for (let i = 1; i <= 5; i++) expect(existsSync(`${file}.${i}`)).toBe(true);
      expect(existsSync(`${file}.6`)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
