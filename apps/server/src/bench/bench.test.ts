import { afterAll, beforeAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useRuntime } from "../db/client";
import { applySchema } from "../db/schema";
import { createStorage } from "../storage";
import { LIST_DOCUMENTS_SQL } from "../routes/document";
import { LATEST_DOCUMENT_SQL } from "../routes/request";
import { benchCases, explain, runBench } from "./run";
import { BENCH_TABLES, HOUSEHOLD_TABLES, seedBench } from "./world";

// The CI-sized scale check: 200 households (the real benchmark is `bun run bench`, 2,000). The budget
// is generous so a slow CI runner doesn't flake; what it catches is a query that went linear.

const BUDGET_MS = 250;
const tmp = mkdtempSync(join(tmpdir(), "btp-bench-"));
let db: Database;
let summary: ReturnType<typeof seedBench>;

beforeAll(async () => {
  db = new Database(":memory:", { strict: true });
  await applySchema(db);
  const storage = createStorage(join(tmp, "files"));
  summary = seedBench(db, { storage, copies: 8, anchor: new Date("2026-09-23T17:00:00.000Z") });
  useRuntime({ db, storage, mode: "demo" });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

test("the bench world is 8 copies of the demo, whole: every household table cloned, every key intact", () => {
  expect([...BENCH_TABLES].sort()).toEqual([...HOUSEHOLD_TABLES].sort());
  expect(summary.households).toBe(200);
  expect(summary.returns).toBeGreaterThan(300);
  expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
  expect(db.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
});

test(`every hot path answers within ${BUDGET_MS} ms at 200 households`, async () => {
  const results = await runBench(benchCases(db), 3);
  expect(results.filter((r) => r.medianMs > BUDGET_MS)).toEqual([]);
});

test("a request's documents and a return's person-level documents are found by index, not by scanning", () => {
  expect(explain(db, LATEST_DOCUMENT_SQL, "x")).toContain("SEARCH d USING INDEX documents_request");
  const plan = explain(db, LIST_DOCUMENTS_SQL, "x", "x");
  expect(plan).toContain("SEARCH d USING INDEX documents_engagement (engagement_id=?)");
  expect(plan).toContain("SEARCH d USING INDEX documents_person (person_id=?)");
  expect(plan).not.toMatch(/SCAN d\b/);
});
