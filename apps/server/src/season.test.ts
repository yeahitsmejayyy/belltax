import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { SeasonPreview, SeasonReport } from "@app/schema";
import { demoWorld } from "./test-harness";

// Ticket 34: the new-season rollover, on the seeded world. Each test gets a fresh world: rollovers change it.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeEach(async () => {
  w = await demoWorld();
});
afterEach(() => w.cleanup());

const preview = async (fromYear: number) => {
  const res = await w.call(w.preparerId, "season.preview", { fromYear });
  expect(res.status).toBe(200);
  return res.data as SeasonPreview;
};
const rollover = async (fromYear: number, householdIds?: string[]) => {
  const res = await w.call(w.preparerId, "season.rollover", { fromYear, ...(householdIds ? { householdIds } : {}) }, "mutation");
  expect(res.status).toBe(200);
  return res.data as SeasonReport;
};
const creates = (p: SeasonPreview) => p.items.filter((i) => i.action === "create");
const count = (sql: string, ...p: (string | number)[]) => w.get<{ n: number }>(sql, ...p).n;
const completed2025 = () =>
  w.all<{ id: string; household_id: string }>("SELECT id, household_id FROM engagements WHERE tax_year = 2025 AND kind = 'original' AND stage = 'complete' ORDER BY id");

describe("preview and rollover agree", () => {
  test("every 2025 return is accounted for; completed ones roll to 2026 with people, sources and a checklist", async () => {
    const p = await preview(2025);
    expect(p.toYear).toBe(2026);
    expect(p.items).toHaveLength(count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2025"));
    expect(creates(p).map((i) => i.fromEngagementId).sort()).toEqual(completed2025().map((e) => e.id));
    for (const i of p.items.filter((i) => i.action === "skip")) expect(i.reason).toContain("not complete");

    const r = await rollover(2025);
    expect(r.failed).toEqual([]);
    expect(r.created.map((c) => c.fromEngagementId).sort()).toEqual(creates(p).map((i) => i.fromEngagementId).sort());
    expect(Object.fromEntries(r.skipped.map((s): [string, string | null] => [s.fromEngagementId, s.reason]))).toEqual(
      Object.fromEntries(p.items.filter((i) => i.action === "skip").map((i) => [i.fromEngagementId, i.reason])),
    );

    for (const c of r.created) {
      const planned = p.items.find((i) => i.fromEngagementId === c.fromEngagementId)!;
      const e = w.get<{ household_id: string; tax_year: number; kind: string; stage: string }>("SELECT household_id, tax_year, kind, stage FROM engagements WHERE id = ?", c.engagementId);
      expect(e).toEqual({ household_id: c.householdId, tax_year: 2026, kind: "original", stage: "invited" });
      // Same people in the same roles.
      const people = (id: string) => w.all<{ person_id: string; role: string }>("SELECT person_id, role FROM return_people WHERE engagement_id = ? ORDER BY person_id", id);
      expect(people(c.engagementId)).toEqual(people(c.fromEngagementId));
      expect(c.people).toBe(planned.people);
      expect(c.sourcesCarried).toBe(planned.sourcesToCarry);
      expect(count("SELECT COUNT(*) AS n FROM return_sources WHERE engagement_id = ?", c.engagementId)).toBe(c.sourcesCarried);
      expect(count("SELECT COUNT(*) AS n FROM requests WHERE engagement_id = ?", c.engagementId)).toBe(c.requestsCreated);
      if (c.sourcesCarried) expect(c.requestsCreated).toBeGreaterThan(0);
      // Every created row wrote its event.
      const created = w.eventsOf("engagement.created", c.engagementId);
      expect(created.map((ev) => JSON.parse(ev.data))).toEqual([{ tax_year: 2026, kind: "original", from_engagement: c.fromEngagementId, rollover: true }]);
      expect(count("SELECT COUNT(*) AS n FROM events WHERE engagement_id = ? AND type = 'request.created'", c.engagementId)).toBe(c.requestsCreated);
      expect(count("SELECT COUNT(*) AS n FROM events WHERE engagement_id = ? AND type = 'source.attached'", c.engagementId)).toBe(c.sourcesCarried);
    }
  });

  test("running it twice creates nothing new", async () => {
    const first = await rollover(2025);
    expect(first.created.length).toBeGreaterThan(0);
    const returns = count("SELECT COUNT(*) AS n FROM engagements");
    const events = count("SELECT COUNT(*) AS n FROM events");
    const again = await rollover(2025);
    expect(again.created).toEqual([]);
    expect(count("SELECT COUNT(*) AS n FROM engagements")).toBe(returns);
    expect(count("SELECT COUNT(*) AS n FROM events")).toBe(events);
    for (const c of first.created) {
      expect(again.skipped.find((s) => s.fromEngagementId === c.fromEngagementId)?.reason).toMatch(/is already on a 2026 return\.$/);
    }
    expect(creates(await preview(2025))).toEqual([]);
  });
});

describe("what's skipped, and why", () => {
  test("2024: amended returns never roll; originals that already have a 2025 return say so", async () => {
    const p = await preview(2024);
    expect(creates(p)).toEqual([]);
    const amended = w.all<{ id: string }>("SELECT id FROM engagements WHERE tax_year = 2024 AND kind = 'amended'");
    expect(amended.length).toBeGreaterThan(0);
    for (const a of amended) expect(p.items.find((i) => i.fromEngagementId === a.id)?.reason).toBe("An amended 2024 return; 2025 starts from the original.");
    for (const i of p.items.filter((i) => !amended.some((a) => a.id === i.fromEngagementId))) expect(i.reason).toMatch(/is already on a 2025 return\.$/);
    const r = await rollover(2024);
    expect(r.created).toEqual([]);
    expect(r.skipped).toHaveLength(p.items.length);
  });

  test("an archived household is skipped", async () => {
    const [e] = completed2025();
    expect((await w.call(w.preparerId, "household.update", { householdId: e!.household_id, archived: true }, "mutation")).status).toBe(200);
    const item = (await preview(2025)).items.find((i) => i.fromEngagementId === e!.id)!;
    expect({ action: item.action, reason: item.reason }).toEqual({ action: "skip", reason: "The household is archived." });
    expect((await rollover(2025)).created.some((c) => c.householdId === e!.household_id)).toBe(false);
  });

  test("a filer now in another household skips the return; a dependent who left is dropped and named", async () => {
    const [a, b] = completed2025();
    const other = w.get<{ id: string }>("SELECT id FROM households WHERE id NOT IN (?, ?) LIMIT 1", a!.household_id, b!.household_id).id;
    const primaryOf = (id: string) => w.get<{ person_id: string; name: string }>(
      "SELECT rp.person_id, p.first_name || ' ' || p.last_name AS name FROM return_people rp JOIN people p ON p.id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'", id);
    const moved = primaryOf(a!.id);
    w.db.run("UPDATE people SET household_id = ? WHERE id = ?", [other, moved.person_id]);

    // Give b a dependent who has since moved out.
    const kid = Bun.randomUUIDv7();
    w.db.run("INSERT INTO people (id, household_id, first_name, last_name, date_of_birth, created_at) VALUES (?, ?, 'Demo', 'Leaver', '2008-05-05', '2026-01-01T00:00:00.000Z')", [kid, other]);
    w.db.run("INSERT INTO return_people (engagement_id, person_id, tax_year, engagement_kind, role, relationship, months_lived_with) VALUES (?, ?, 2025, 'original', 'dependent', 'child', 12)", [b!.id, kid]);

    const p = await preview(2025);
    expect(p.items.find((i) => i.fromEngagementId === a!.id)?.reason).toBe(`${moved.name} is now in another household. Start 2026 by hand.`);
    const bItem = p.items.find((i) => i.fromEngagementId === b!.id)!;
    expect(bItem.action).toBe("create");
    expect(bItem.dependentsLeft).toEqual(["Demo Leaver"]);

    const r = await rollover(2025);
    const made = r.created.find((c) => c.fromEngagementId === b!.id)!;
    expect(made.dependentsLeft).toEqual(["Demo Leaver"]);
    expect(count("SELECT COUNT(*) AS n FROM return_people WHERE engagement_id = ? AND person_id = ?", made.engagementId, kid)).toBe(0);
    expect(r.created.some((c) => c.fromEngagementId === a!.id)).toBe(false);
  });
});

describe("one household at a time", () => {
  test("householdIds limits the run to those households", async () => {
    const [e] = completed2025();
    const r = await rollover(2025, [e!.household_id]);
    expect([...r.created, ...r.skipped].every((i) => i.householdId === e!.household_id)).toBe(true);
    expect(r.created.map((c) => c.fromEngagementId)).toContain(e!.id);
    expect(count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2026")).toBe(r.created.length);
  });

  test("a household that fails leaves nothing behind and doesn't stop the rest", async () => {
    const [bad, ...good] = completed2025();
    w.db.run(`CREATE TEMP TRIGGER fail_one BEFORE INSERT ON requests
              WHEN (SELECT household_id FROM engagements WHERE id = NEW.engagement_id) = '${bad!.household_id}'
              BEGIN SELECT RAISE(ABORT, 'demo failure'); END`);
    const events = count("SELECT COUNT(*) AS n FROM events");
    const r = await rollover(2025);
    w.db.run("DROP TRIGGER fail_one");

    expect(r.failed.map((f) => [f.fromEngagementId, f.error])).toEqual([[bad!.id, "demo failure"]]);
    expect(r.created.map((c) => c.fromEngagementId).sort()).toEqual(good.map((g) => g.id));
    expect(count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2026 AND household_id = ?", bad!.household_id)).toBe(0);
    const expectedEvents = r.created.reduce((n, c) => n + 1 + c.sourcesCarried + c.requestsCreated, 0);
    expect(count("SELECT COUNT(*) AS n FROM events") - events).toBe(expectedEvents);
    // Fixed, it rolls on the next run.
    expect((await rollover(2025)).created.map((c) => c.fromEngagementId)).toEqual([bad!.id]);
  });
});

describe("who can", () => {
  test("preparer only, and never on the portal", async () => {
    expect((await w.call(w.preparerId, "season.preview", { fromYear: 2025 }, "query", "portal")).status).toBe(404);
    expect((await w.call(w.preparerId, "season.rollover", { fromYear: 2025 }, "mutation", "portal")).status).toBe(404);
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "season.preview", { fromYear: 2025 })).status).toBe(403);
    expect((await w.call(client, "season.rollover", { fromYear: 2025 }, "mutation")).status).toBe(403);
    expect(count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2026")).toBe(0);
  });
});
