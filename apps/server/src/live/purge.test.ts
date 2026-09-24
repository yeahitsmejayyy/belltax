import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { DocumentView } from "@app/schema";
import { z } from "zod";
import { ANCHOR, demoWorld } from "../test-harness";
import { findOrphans, findPurgeable, purge } from "./purge";

// Retention purge against the demo world. The seed's last-season returns (2024) were completed about a
// year before the anchor; this season's (2025) within weeks. Moving the clock decides who's eligible.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const later = (days: number) => new Date(ANCHOR.getTime() + days * 86_400_000);

describe("what's eligible", () => {
  test("nothing today: every completed return is well inside two years", () => {
    expect(findPurgeable(w.db, { at: ANCHOR })).toEqual([]);
  });

  test("a year on, only documents on returns completed more than two years ago", () => {
    const due = findPurgeable(w.db, { at: later(400) });
    expect(due.length).toBeGreaterThan(0);
    const years = new Set(
      due.map((d) => w.get<{ tax_year: number | null }>("SELECT e.tax_year FROM documents x LEFT JOIN engagements e ON e.id = x.engagement_id WHERE x.id = ?", d.id).tax_year),
    );
    expect([...years]).toEqual([2024]); // last season's only; this season's are protected
    expect(due.every((d) => d.reason === "retention")).toBe(true);
    // Nothing on a return that isn't complete, however old.
    const onOpen = due.filter((d) => w.get<{ stage: string }>("SELECT e.stage FROM documents x JOIN engagements e ON e.id = x.engagement_id WHERE x.id = ?", d.id)?.stage !== "complete");
    expect(onOpen).toEqual([]);
  });

  test("a return that isn't complete is never aged out, however long it has sat", () => {
    const stale = w.get<{ id: string; stage_changed_at: string }>(
      "SELECT id, stage_changed_at FROM engagements WHERE stage = 'documents' AND tax_year = 2025 AND EXISTS (SELECT 1 FROM documents d WHERE d.engagement_id = engagements.id) LIMIT 1",
    );
    w.db.run("UPDATE engagements SET stage_changed_at = '2019-01-01T00:00:00.000Z' WHERE id = ?", [stale.id]);
    const due = findPurgeable(w.db, { at: ANCHOR });
    expect(due.filter((d) => w.get<{ engagement_id: string | null }>("SELECT engagement_id FROM documents WHERE id = ?", d.id).engagement_id === stale.id)).toEqual([]);
    w.db.run("UPDATE engagements SET stage_changed_at = ? WHERE id = ?", [stale.stage_changed_at, stale.id]);
  });

  test("an explicit purge_after date is honoured even on an active return", () => {
    const doc = w.get<{ id: string }>(
      "SELECT d.id FROM documents d JOIN engagements e ON e.id = d.engagement_id WHERE e.stage = 'documents' AND d.purged_at IS NULL LIMIT 1",
    );
    w.db.run("UPDATE documents SET purge_after = '2026-09-01' WHERE id = ?", [doc.id]);
    const due = findPurgeable(w.db, { at: ANCHOR });
    expect(due.map((d) => ({ id: d.id, reason: d.reason }))).toEqual([{ id: doc.id, reason: "purge_after" }]);
    w.db.run("UPDATE documents SET purge_after = NULL WHERE id = ?", [doc.id]);
  });

  test("a photo ID stays while its person has any open return", () => {
    const ids = findPurgeable(w.db, { at: later(10_000) }).map((d) => d.id);
    const photoOfActive = w.get<{ id: string }>(
      `SELECT d.id FROM documents d WHERE d.kind = 'photo_id' AND EXISTS (
         SELECT 1 FROM return_people rp JOIN engagements e ON e.id = rp.engagement_id WHERE rp.person_id = d.person_id AND e.stage <> 'complete')`,
    );
    expect(ids).not.toContain(photoOfActive.id);
  });
});

describe("purging", () => {
  test("deletes the bytes, keeps the row as a tombstone, logs a system event, and is idempotent", async () => {
    const due = findPurgeable(w.db, { at: later(400) });
    const sample = due[0]!;
    expect(() => w.storage.get(sample.storageKey)).not.toThrow();

    const result = purge(w.db, w.storage, due);
    expect(result.purged).toBe(due.length);

    expect(() => w.storage.get(sample.storageKey)).toThrow();
    const row = w.get<{ storage_key: string | null; purged_at: string | null; filename: string }>("SELECT storage_key, purged_at, filename FROM documents WHERE id = ?", sample.id);
    expect(row).toMatchObject({ storage_key: null, filename: sample.filename });
    expect(row.purged_at).not.toBeNull();
    const ev = w.get<{ actor_kind: string; data: string }>("SELECT actor_kind, data FROM events WHERE type = 'document.purged' AND subject_id = ?", sample.id);
    expect(ev.actor_kind).toBe("system");
    expect(JSON.parse(ev.data)).toEqual({ reason: "retention" });

    // Gone from the client's view and from download.
    const eng = w.get<{ engagement_id: string }>("SELECT engagement_id FROM documents WHERE id = ?", sample.id).engagement_id;
    const listed = z.array(DocumentView).parse((await w.call(w.preparerId, "document.list", { engagementId: eng })).data);
    expect(listed.map((d) => d.id)).not.toContain(sample.id);
    const res = await w.handler(new Request(`http://127.0.0.1/api/documents/${sample.id}/file`, { headers: { "x-demo-user": w.preparerId } }));
    expect(res.status).toBe(404);

    // Nothing left to do the second time.
    expect(findPurgeable(w.db, { at: later(400) })).toEqual([]);
    expect(purge(w.db, w.storage, due)).toEqual({ purged: 0, orphansRemoved: 0 });
  });

  test("stray files left by an interrupted run are cleaned up; unrelated files are left alone", () => {
    const stray = w.storage.keyFor("0190a000-0000-7000-8000-00000000beef", "pdf");
    w.storage.put(stray, new TextEncoder().encode("left behind"));
    expect(findOrphans(w.db, w.storage)).toEqual([stray]);
    expect(purge(w.db, w.storage, []).orphansRemoved).toBe(1);
    expect(findOrphans(w.db, w.storage)).toEqual([]);
  });

  test("retention must be a positive number of days", () => {
    expect(() => findPurgeable(w.db, { retentionDays: 0 })).toThrow(/positive integer/);
  });
});
