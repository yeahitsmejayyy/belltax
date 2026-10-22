import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DocumentView, LetterView } from "@app/schema";
import { z } from "zod";
import { exportHousehold } from "../export/household";
import { ANCHOR, demoWorld } from "../test-harness";
import { archivedLetterNote, findArchivableLetters, findOrphans, findPurgeable, purge } from "./purge";
import { closeSeason, seasonCloseList } from "./season-close";

// A mailbox, not a vault (ticket 49), against the demo world. Its 2024 returns were completed about a year before the
// anchor; this season's 2025 returns were filed within the last few weeks. Nothing has been exported yet, so the
// first thing every rule has to show is that it forgets nothing until an export exists.

type World = Awaited<ReturnType<typeof demoWorld>>;
const later = (days: number) => new Date(ANCHOR.getTime() + days * 86_400_000);
const outDirs: string[] = [];
afterAll(() => outDirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function exporter(w: World) {
  const outDir = mkdtempSync(join(tmpdir(), "btp-purge-export-"));
  outDirs.push(outDir);
  return (householdId: string, at = ANCHOR) => exportHousehold({ db: w.db, storage: w.storage, dataDir: undefined, householdId, outDir, actor: "system", at });
}

// A household whose 2024 return is complete and still holds files.
const finished2024 = (w: World) =>
  w.get<{ household_id: string; id: string }>(
    `SELECT e.household_id, e.id FROM engagements e WHERE e.tax_year = 2024 AND e.kind = 'original' AND e.stage = 'complete'
       AND EXISTS (SELECT 1 FROM documents d WHERE d.engagement_id = e.id AND d.purged_at IS NULL) ORDER BY e.id LIMIT 1`,
  );
const docsOn = (w: World, engagementId: string) =>
  w.all<{ id: string }>("SELECT id FROM documents WHERE engagement_id = ? AND purged_at IS NULL", engagementId).map((d) => d.id);
const householdOf = (w: World, documentId: string) =>
  w.get<{ h: string }>(
    `SELECT COALESCE(e.household_id, p.household_id) AS h FROM documents d LEFT JOIN engagements e ON e.id = d.engagement_id
       LEFT JOIN people p ON p.id = d.person_id WHERE d.id = ?`,
    documentId,
  ).h;

describe("nothing without an export", () => {
  let w: World;
  beforeAll(async () => {
    w = await demoWorld();
  });
  beforeEach(() => w.use("demo"));
  afterAll(() => w.cleanup());

  test("however long ago a return was filed, no file and no letter goes until its household is exported", () => {
    expect(findPurgeable(w.db, { at: later(10_000) })).toEqual([]);
    expect(findArchivableLetters(w.db, { at: later(10_000) })).toEqual([]);
  });

  test("a purge_after date is honoured early, but still not without an export", async () => {
    const { household_id, id } = finished2024(w);
    const doc = docsOn(w, id)[0]!;
    w.db.run("UPDATE documents SET purge_after = '2026-09-01' WHERE id = ?", [doc]);
    expect(findPurgeable(w.db, { at: ANCHOR })).toEqual([]);
    await exporter(w)(household_id);
    expect(findPurgeable(w.db, { at: ANCHOR }).find((d) => d.id === doc)?.reason).toBe("purge_after");
  });
});

describe("files go 30 days after filing, once exported", () => {
  let w: World;
  let exportOf: ReturnType<typeof exporter>;
  beforeAll(async () => {
    w = await demoWorld();
    exportOf = exporter(w);
  });
  beforeEach(() => w.use("demo"));
  afterAll(() => w.cleanup());

  test("an export lets a long-filed return's files go, and only that household's", async () => {
    const { household_id, id } = finished2024(w);
    await exportOf(household_id);
    const due = findPurgeable(w.db, { at: ANCHOR });
    expect(due.map((d) => d.id)).toEqual(expect.arrayContaining(docsOn(w, id)));
    expect(new Set(due.map((d) => householdOf(w, d.id)))).toEqual(new Set([household_id]));
    expect(due.every((d) => d.reason === "after_filing")).toBe(true);
  });

  test("a return filed this month keeps its files until 30 days have passed", async () => {
    const recent = w.get<{ household_id: string; id: string; filed: string }>(
      `SELECT e.household_id, e.id, MIN(f.submitted_at) AS filed FROM engagements e JOIN efile_submissions f ON f.engagement_id = e.id
        WHERE e.tax_year = 2025 AND e.stage = 'complete' AND EXISTS (SELECT 1 FROM documents d WHERE d.engagement_id = e.id AND d.purged_at IS NULL)
        GROUP BY e.id HAVING MIN(f.submitted_at) > ? ORDER BY e.id LIMIT 1`,
      new Date(ANCHOR.getTime() - 30 * 86_400_000).toISOString(),
    );
    await exportOf(recent.household_id);
    const ids = (at: Date) => findPurgeable(w.db, { at }).map((d) => d.id);
    expect(ids(ANCHOR)).not.toContain(docsOn(w, recent.id)[0]);
    const thirtyOneDaysOn = new Date(Date.parse(recent.filed) + 31 * 86_400_000);
    expect(ids(thirtyOneDaysOn)).toEqual(expect.arrayContaining(docsOn(w, recent.id)));
  });

  test("a return still being worked on keeps its files, export or not", async () => {
    const open = w.get<{ household_id: string; id: string }>(
      `SELECT e.household_id, e.id FROM engagements e WHERE e.stage IN ('documents', 'preparing', 'review')
         AND EXISTS (SELECT 1 FROM documents d WHERE d.engagement_id = e.id AND d.purged_at IS NULL) ORDER BY e.id LIMIT 1`,
    );
    await exportOf(open.household_id);
    const ids = findPurgeable(w.db, { at: later(10_000) }).map((d) => d.id);
    for (const d of docsOn(w, open.id)) expect(ids).not.toContain(d);
  });

  test("a rejected e-file holds the papers until it's resubmitted and answered", async () => {
    const held = w.get<{ household_id: string; id: string }>(
      `SELECT e.household_id, e.id FROM engagements e JOIN efile_submissions f ON f.engagement_id = e.id
        WHERE f.status = 'rejected' AND EXISTS (SELECT 1 FROM documents d WHERE d.engagement_id = e.id AND d.purged_at IS NULL) LIMIT 1`,
    );
    await exportOf(held.household_id);
    const ids = () => findPurgeable(w.db, { at: later(10_000) }).map((d) => d.id);
    expect(ids()).not.toContain(docsOn(w, held.id)[0]);
    w.db.run("INSERT INTO efile_submissions (id, engagement_id, jurisdiction, status, submitted_at, decided_at) VALUES (?, ?, 'federal', 'accepted', ?, ?)", [
      Bun.randomUUIDv7(), held.id, ANCHOR.toISOString(), ANCHOR.toISOString(),
    ]);
    expect(ids()).toEqual(expect.arrayContaining(docsOn(w, held.id)));
  });

  test("a file that arrived after the export waits for the next one", async () => {
    const { household_id, id } = finished2024(w);
    await exportOf(household_id, ANCHOR);
    const late = w.get<{ id: string }>("SELECT id FROM documents WHERE engagement_id = ? AND purged_at IS NULL LIMIT 1", id).id;
    w.db.run("UPDATE documents SET created_at = ? WHERE id = ?", [later(1).toISOString(), late]);
    expect(findPurgeable(w.db, { at: later(2) }).map((d) => d.id)).not.toContain(late);
    await exportOf(household_id, later(2));
    expect(findPurgeable(w.db, { at: later(2) }).map((d) => d.id)).toContain(late);
  });

  test("a person's own files go once every return they're on is filed long enough ago", async () => {
    const person = w.get<{ id: string; household_id: string; uploader: string }>(
      `SELECT p.id, p.household_id, (SELECT id FROM users WHERE role = 'preparer') AS uploader FROM people p
        WHERE p.household_id IS NOT NULL AND EXISTS (SELECT 1 FROM return_people rp WHERE rp.person_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM return_people rp JOIN engagements e ON e.id = rp.engagement_id WHERE rp.person_id = p.id AND e.stage NOT IN ('filed', 'complete'))
          AND NOT EXISTS (SELECT 1 FROM return_people rp JOIN efile_submissions f ON f.engagement_id = rp.engagement_id WHERE rp.person_id = p.id AND f.status = 'rejected')
        ORDER BY p.id LIMIT 1`,
    );
    const docId = Bun.randomUUIDv7();
    const key = w.storage.keyFor(docId, "pdf");
    w.storage.put(key, new TextEncoder().encode("%PDF-1.4 demo"));
    w.db.run(
      `INSERT INTO documents (id, person_id, kind, filename, mime_type, size_bytes, sha256, storage_key, uploaded_by, created_at)
       VALUES (?, ?, 'other', 'letter.pdf', 'application/pdf', 13, ?, ?, ?, ?)`,
      [docId, person.id, "0".repeat(64), key, person.uploader, "2025-01-01T00:00:00.000Z"],
    );
    await exportOf(person.household_id);
    expect(findPurgeable(w.db, { at: later(10_000) }).map((d) => d.id)).toContain(docId);
    // A new open return for them holds it again.
    const open = w.get<{ id: string }>("SELECT id FROM engagements WHERE stage = 'documents' LIMIT 1").id;
    w.db.run(
      "INSERT INTO return_people (engagement_id, person_id, tax_year, engagement_kind, role, relationship, months_lived_with) SELECT id, ?, tax_year, kind, 'dependent', 'other', 12 FROM engagements WHERE id = ?",
      [person.id, open],
    );
    expect(findPurgeable(w.db, { at: later(10_000) }).map((d) => d.id)).not.toContain(docId);
  });
});

describe("verifying a photo ID deletes it at once", () => {
  let w: World;
  beforeAll(async () => {
    w = await demoWorld();
  });
  beforeEach(() => w.use("demo"));
  afterAll(() => w.cleanup());

  test("accepting it deletes the file with no export, keeps the note, and logs why", async () => {
    const id = w.get<{ id: string; storage_key: string; engagement_id: string }>(
      `SELECT d.id, d.storage_key, rp.engagement_id FROM documents d JOIN return_people rp ON rp.person_id = d.person_id
        WHERE d.kind = 'photo_id' AND d.status = 'uploaded' AND d.purged_at IS NULL LIMIT 1`,
    );
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM household_exports").n).toBe(0);
    const res = await w.call(w.preparerId, "document.review", { documentId: id.id, decision: "accept" }, "mutation");
    const view = DocumentView.parse(res.data);
    expect(view).toMatchObject({ status: "accepted", identity: true, kind: "photo_id" });
    expect(view.deletedAt).not.toBeNull();

    expect(() => w.storage.get(id.storage_key)).toThrow();
    expect(w.get<{ storage_key: string | null; purged_at: string | null; reviewed_at: string | null }>("SELECT storage_key, purged_at, reviewed_at FROM documents WHERE id = ?", id.id)).toMatchObject({
      storage_key: null,
    });
    expect(w.eventsOf("document.purged", id.id).map((e) => JSON.parse(e.data))).toEqual([{ reason: "id_verified" }]);

    // The note stays on the return's list; the file is gone from download.
    const listed = z.array(DocumentView).parse((await w.call(w.preparerId, "document.list", { engagementId: id.engagement_id })).data);
    expect(listed.find((d) => d.id === id.id)).toMatchObject({ status: "accepted", deletedAt: view.deletedAt });
    const file = await w.handler(new Request(`http://127.0.0.1/api/documents/${id.id}/file`, { headers: { "x-demo-user": w.preparerId } }));
    expect(file.status).toBe(404);
  });

  test("any other accepted document keeps its file", async () => {
    const w2 = w.get<{ id: string; storage_key: string }>("SELECT id, storage_key FROM documents WHERE kind = 'w2' AND status = 'uploaded' AND purged_at IS NULL LIMIT 1");
    const view = DocumentView.parse((await w.call(w.preparerId, "document.review", { documentId: w2.id, decision: "accept" }, "mutation")).data);
    expect(view.deletedAt).toBeNull();
    expect(() => w.storage.get(w2.storage_key)).not.toThrow();
  });

  test("a verified ID that somehow still holds its file is caught by the next purge, export or not", () => {
    const id = w.get<{ id: string }>("SELECT id FROM documents WHERE kind = 'photo_id' AND status = 'uploaded' AND purged_at IS NULL LIMIT 1").id;
    w.db.run("UPDATE documents SET status = 'accepted', reviewed_at = ? WHERE id = ?", [ANCHOR.toISOString(), id]);
    expect(findPurgeable(w.db, { at: ANCHOR })).toEqual([expect.objectContaining({ id, reason: "id_verified" })]);
  });
});

describe("a signed letter's text moves to the offline record", () => {
  let w: World;
  let exportOf: ReturnType<typeof exporter>;
  beforeAll(async () => {
    w = await demoWorld();
    exportOf = exporter(w);
  });
  beforeEach(() => w.use("demo"));
  afterAll(() => w.cleanup());

  const signed2024 = () =>
    w.get<{ id: string; household_id: string; body: string; body_sha256: string; engagement_id: string }>(
      `SELECT l.id, l.household_id, l.body, l.body_sha256, e.id AS engagement_id FROM engagement_letters l JOIN engagements e ON e.letter_id = l.id
        WHERE l.status = 'signed' AND l.tax_year = 2024 AND e.stage = 'complete' AND l.archived_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM engagements x WHERE x.letter_id = l.id AND x.stage <> 'complete') ORDER BY l.id LIMIT 1`,
    );

  test("only after its returns are filed and the household is exported; then the portal keeps the fingerprint and dates", async () => {
    const letter = signed2024();
    expect(findArchivableLetters(w.db, { at: ANCHOR })).toEqual([]);
    const exported = await exportOf(letter.household_id);
    expect(exported.documents).toBeGreaterThan(0);
    const due = findArchivableLetters(w.db, { at: ANCHOR });
    expect(due.map((l) => l.id)).toEqual([letter.id]);

    expect(purge(w.db, w.storage, [], due).lettersArchived).toBe(1);
    const row = w.get<{ body: string; body_sha256: string; archived_at: string | null }>("SELECT body, body_sha256, archived_at FROM engagement_letters WHERE id = ?", letter.id);
    expect(row.body_sha256).toBe(letter.body_sha256);
    expect(row.archived_at).not.toBeNull();
    expect(row.body).not.toContain(letter.body.slice(0, 40));
    expect(row.body).toBe(archivedLetterNote(letter.body_sha256, w.get<{ s: string }>("SELECT MAX(signed_at) AS s FROM signatures WHERE letter_id = ?", letter.id).s, row.archived_at!));
    expect(w.eventsOf("letter.archived", letter.id)).toHaveLength(1);

    // The preparer's view still shows every signature bound to the signed text.
    const view = LetterView.parse((await w.call(w.preparerId, "letter.get", { engagementId: letter.engagement_id })).data);
    expect(view.archivedAt).toBe(row.archived_at);
    expect(view.audit!.length).toBeGreaterThan(0);
    expect(view.audit!.every((a) => a.hashMatches)).toBe(true);
    expect(findArchivableLetters(w.db, { at: ANCHOR })).toEqual([]);
  });

  test("the database allows no other rewrite of a sent letter, and archives once", () => {
    const archived = w.get<{ id: string }>("SELECT id FROM engagement_letters WHERE archived_at IS NOT NULL").id;
    expect(() => w.db.run("UPDATE engagement_letters SET body = 'changed' WHERE id = ?", [archived])).toThrow(/frozen/);
    expect(() => w.db.run("UPDATE engagement_letters SET archived_at = ? WHERE id = ?", [later(1).toISOString(), archived])).toThrow(/only once/);
    const signed = signed2024();
    expect(() => w.db.run("UPDATE engagement_letters SET body = 'changed' WHERE id = ?", [signed.id])).toThrow(/frozen/);
    expect(() => w.db.run("UPDATE engagement_letters SET body = 'x', body_sha256 = ?, archived_at = ? WHERE id = ?", ["f".repeat(64), ANCHOR.toISOString(), signed.id])).toThrow(/frozen/);
    const sent = w.get<{ id: string } | null>("SELECT id FROM engagement_letters WHERE status = 'sent' LIMIT 1");
    if (sent) expect(() => w.db.run("UPDATE engagement_letters SET body = 'x', archived_at = ? WHERE id = ?", [ANCHOR.toISOString(), sent.id])).toThrow();
  });
});

describe("closing a season", () => {
  let w: World;
  let outDir: string;
  beforeAll(async () => {
    w = await demoWorld();
    outDir = mkdtempSync(join(tmpdir(), "btp-season-close-"));
    outDirs.push(outDir);
  });
  beforeEach(() => w.use("demo"));
  afterAll(() => w.cleanup());

  test("copies every finished household once, records it, and the record can't be changed", async () => {
    const list = seasonCloseList(w.db, 2024);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.needsExport && i.lastExportAt === null)).toBe(true);
    // A household with a 2024 return still open (the amended one) isn't finished.
    const unfinished = w.get<{ household_id: string }>("SELECT household_id FROM engagements WHERE tax_year = 2024 AND stage NOT IN ('filed', 'complete') LIMIT 1");
    expect(list.map((i) => i.householdId)).not.toContain(unfinished.household_id);

    const done = await closeSeason({ db: w.db, storage: w.storage, dataDir: undefined, taxYear: 2024, outDir, at: ANCHOR });
    expect(done).toHaveLength(list.length);
    const rows = w.all<{ household_id: string; sha256: string; encrypted: number }>("SELECT household_id, sha256, encrypted FROM household_exports");
    expect(new Set(rows.map((r) => r.household_id))).toEqual(new Set(list.map((i) => i.householdId)));
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.sha256) && r.encrypted === 0)).toBe(true);
    expect(seasonCloseList(w.db, 2024).some((i) => i.needsExport)).toBe(false);
    expect(await closeSeason({ db: w.db, storage: w.storage, dataDir: undefined, taxYear: 2024, outDir, at: ANCHOR })).toEqual([]);

    expect(() => w.db.run("UPDATE household_exports SET encrypted = 1")).toThrow(/permanent/);
    expect(() => w.db.run("DELETE FROM household_exports")).toThrow(/permanent/);
  });

  test("a year that isn't a year is refused", () => {
    expect(() => seasonCloseList(w.db, 26)).toThrow(/tax year/);
  });
});

describe("purging", () => {
  let w: World;
  beforeAll(async () => {
    w = await demoWorld();
  });
  beforeEach(() => w.use("demo"));
  afterAll(() => w.cleanup());

  test("deletes the bytes, keeps the row as a tombstone, logs a system event, and is idempotent", async () => {
    const { household_id } = finished2024(w);
    await exporter(w)(household_id);
    const due = findPurgeable(w.db, { at: ANCHOR });
    const sample = due[0]!;
    expect(() => w.storage.get(sample.storageKey)).not.toThrow();

    expect(purge(w.db, w.storage, due).purged).toBe(due.length);
    expect(() => w.storage.get(sample.storageKey)).toThrow();
    const row = w.get<{ storage_key: string | null; purged_at: string | null; filename: string }>("SELECT storage_key, purged_at, filename FROM documents WHERE id = ?", sample.id);
    expect(row).toMatchObject({ storage_key: null, filename: sample.filename });
    expect(row.purged_at).not.toBeNull();
    const ev = w.get<{ actor_kind: string; data: string }>("SELECT actor_kind, data FROM events WHERE type = 'document.purged' AND subject_id = ?", sample.id);
    expect(ev.actor_kind).toBe("system");
    expect(JSON.parse(ev.data)).toEqual({ reason: "after_filing" });

    // Gone from the return's list and from download.
    const eng = w.get<{ engagement_id: string }>("SELECT engagement_id FROM documents WHERE id = ?", sample.id).engagement_id;
    const listed = z.array(DocumentView).parse((await w.call(w.preparerId, "document.list", { engagementId: eng })).data);
    expect(listed.map((d) => d.id)).not.toContain(sample.id);
    const res = await w.handler(new Request(`http://127.0.0.1/api/documents/${sample.id}/file`, { headers: { "x-demo-user": w.preparerId } }));
    expect(res.status).toBe(404);

    expect(findPurgeable(w.db, { at: ANCHOR })).toEqual([]);
    expect(purge(w.db, w.storage, due)).toEqual({ purged: 0, lettersArchived: 0, orphansRemoved: 0 });
  });

  test("stray files left by an interrupted run are cleaned up; unrelated files are left alone", () => {
    const stray = w.storage.keyFor("0190a000-0000-7000-8000-00000000beef", "pdf");
    w.storage.put(stray, new TextEncoder().encode("left behind"));
    expect(findOrphans(w.db, w.storage)).toEqual([stray]);
    expect(purge(w.db, w.storage, []).orphansRemoved).toBe(1);
    expect(findOrphans(w.db, w.storage)).toEqual([]);
  });

  test("the wait after filing must be a whole number of days", () => {
    expect(() => findPurgeable(w.db, { daysAfterFiling: -1 })).toThrow(/whole number/);
    expect(() => findArchivableLetters(w.db, { daysAfterFiling: 1.5 })).toThrow(/whole number/);
  });
});
