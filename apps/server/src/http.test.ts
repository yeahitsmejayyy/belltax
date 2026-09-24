import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EngagementList, Stage } from "@app/schema";
import { useRuntime } from "./db/client";
import { applySchema } from "./db/schema";
import { seedDemo } from "./db/seed/seed";
import { createFetchHandler } from "./http";
import { createStorage } from "./storage";

// End to end over HTTP: Request in, Response out, through tRPC, the views and the seeded demo world.

const tmp = mkdtempSync(join(tmpdir(), "btp-http-"));
const webDist = join(tmp, "dist");
const storage = createStorage(join(tmp, "files"));
let db: Database;

beforeAll(async () => {
  db = new Database(":memory:", { strict: true });
  await applySchema(db);
  seedDemo(db, { storage, anchor: new Date("2026-09-23T17:00:00.000Z") });
  mkdirSync(join(webDist, "assets"), { recursive: true });
  writeFileSync(join(webDist, "index.html"), "<!doctype html><title>app</title>");
  writeFileSync(join(webDist, "assets", "app.js"), "console.log('app')");
});
beforeEach(() => useRuntime({ db, storage, mode: "demo" }));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const handler = createFetchHandler({ surface: "admin", webDist, devOrigin: "http://localhost:5173" });
const get = (path: string, headers: Record<string, string> = {}) => handler(new Request(`http://127.0.0.1${path}`, { headers }));
const list = async (input?: unknown) => {
  const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await get(`/trpc/engagement.list${qs}`);
  return { status: res.status, body: (await res.json()) as { result?: { data: unknown }; error?: { message: string } } };
};

describe("engagement.list (the preparer pipeline)", () => {
  test("defaults to the newest tax year and returns a valid pipeline", async () => {
    const { status, body } = await list();
    expect(status).toBe(200);
    const data = EngagementList.parse(body.result!.data);
    expect(data.taxYear).toBe(2025);
    expect(data.years).toEqual([2025, 2024]);
    expect(data.rows).toHaveLength(27);
    expect(Object.values(data.counts).reduce((a, b) => a + b, 0)).toBe(27);
    for (const stage of Stage.options) expect(data.counts[stage]).toBeGreaterThan(0);
  });

  test("rows come in board order: by stage, then longest-waiting first", async () => {
    const data = EngagementList.parse((await list()).body.result!.data);
    for (let i = 1; i < data.rows.length; i++) {
      const a = data.rows[i - 1]!;
      const b = data.rows[i]!;
      const byStage = Stage.options.indexOf(a.stage) - Stage.options.indexOf(b.stage);
      expect(byStage < 0 || (byStage === 0 && a.stageChangedAt <= b.stageChangedAt)).toBe(true);
    }
  });

  test("filters by stage without changing the column counts", async () => {
    const all = EngagementList.parse((await list()).body.result!.data);
    const docs = EngagementList.parse((await list({ stage: "documents" })).body.result!.data);
    expect(docs.rows.length).toBe(all.counts.documents);
    expect(docs.rows.every((r) => r.stage === "documents")).toBe(true);
    expect(docs.counts).toEqual(all.counts);
  });

  test("searches household names and filer names, case-insensitively", async () => {
    const all = EngagementList.parse((await list()).body.result!.data);
    const target = all.rows.find((r) => r.filers.length === 2)!;
    const byHousehold = EngagementList.parse((await list({ search: target.householdName.toUpperCase() })).body.result!.data);
    expect(byHousehold.rows.map((r) => r.engagementId)).toContain(target.engagementId);
    const byFiler = EngagementList.parse((await list({ search: target.filers[1]! })).body.result!.data);
    expect(byFiler.rows.map((r) => r.engagementId)).toContain(target.engagementId);
    const none = EngagementList.parse((await list({ search: "zzz-nobody" })).body.result!.data);
    expect(none.rows).toEqual([]);
  });

  test("last season includes the amended return", async () => {
    const data = EngagementList.parse((await list({ taxYear: 2024 })).body.result!.data);
    expect(data.rows.filter((r) => r.kind === "amended")).toHaveLength(1);
  });

  test("returns carry balances, open requests and a derived complexity label", async () => {
    const data = EngagementList.parse((await list()).body.result!.data);
    expect(data.rows.some((r) => r.balanceCents > 0)).toBe(true);
    expect(data.rows.some((r) => r.openRequests > 0)).toBe(true);
    expect(new Set(data.rows.map((r) => r.complexity))).toEqual(new Set(["simple", "involved"]));
  });

  test("rejects bad input", async () => {
    expect((await list({ stage: "done" })).status).toBe(400);
    expect((await list({ taxYear: 1990 })).status).toBe(400);
  });

  test("live mode refuses until preparer sign-in exists", async () => {
    useRuntime({ db, storage, mode: "live" });
    const { status, body } = await list();
    expect(status).toBe(401);
    expect(body.error!.message).toMatch(/Sign-in required/);
  });
});

describe("health", () => {
  test("tRPC health.check reports the mode", async () => {
    const body = (await (await get("/trpc/health.check")).json()) as { result: { data: { status: string; mode: string } } };
    expect(body.result.data).toMatchObject({ status: "ok", mode: "demo" });
  });

  test("/health shows the seeded counts", async () => {
    expect(await (await get("/health")).json()).toMatchObject({ mode: "demo", households: 25, returns: 35 });
  });
});

describe("single host: the SPA", () => {
  test("serves index.html for the root and for client routes", async () => {
    for (const path of ["/", "/portal", "/admin/pipeline?stage=documents"]) {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("<title>app</title>");
    }
  });

  test("serves built assets with a long cache", async () => {
    const res = await get("/assets/app.js");
    expect(await res.text()).toBe("console.log('app')");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  test("never serves files outside the build directory", async () => {
    for (const path of ["/..%2F..%2Fpackage.json", "/%2e%2e/%2e%2e/etc/passwd"]) {
      expect(await (await get(path)).text()).toContain("<title>app</title>");
    }
  });

  test("says so plainly when the web app isn't built", async () => {
    const res = await createFetchHandler({ surface: "admin", webDist: join(tmp, "missing") })(new Request("http://127.0.0.1/"));
    expect(res.status).toBe(503);
    expect(await res.text()).toMatch(/isn't built yet/);
  });
});

describe("CORS for the Vite dev server", () => {
  test("allowed in demo mode for the dev origin only", async () => {
    const dev = await get("/trpc/health.check", { origin: "http://localhost:5173" });
    expect(dev.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const other = await get("/trpc/health.check", { origin: "https://evil.example" });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("never in live mode", async () => {
    useRuntime({ db, storage, mode: "live" });
    const res = await get("/trpc/health.check", { origin: "http://localhost:5173" });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("storage", () => {
  test("round-trips bytes under uploads/", () => {
    const key = storage.keyFor("0190a000-0000-7000-8000-00000000abcd", "pdf");
    storage.put(key, new TextEncoder().encode("hello"));
    expect(new TextDecoder().decode(storage.get(key))).toBe("hello");
    storage.remove(key);
    expect(() => storage.get(key)).toThrow();
  });

  test("refuses keys that could escape the storage root", () => {
    for (const key of ["../secrets.pdf", "uploads/../../x.pdf", "/etc/passwd", "uploads/not-an-id.pdf"]) {
      expect(() => storage.put(key, new Uint8Array([1]))).toThrow(/invalid storage key/);
    }
  });
});
