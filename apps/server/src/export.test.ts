import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { REPO_ROOT } from "./config";
import { EXPORT_FORMAT, exportDirFor, exportHousehold, flattenRecord, HOUSEHOLD_SCOPE, PRACTICE_WIDE, SEALED_EXT, type ExportRecord } from "./export/household";
import { unsealTo } from "./live/backup";
import { demoWorld } from "./test-harness";

// Ticket 33: the offline copy. Every row that belongs to a household, and nothing that doesn't; the
// files byte for byte; no credentials and no full SSNs.

let w: Awaited<ReturnType<typeof demoWorld>>;
const out = mkdtempSync(join(tmpdir(), "btp-export-test-"));
const PASSPHRASE = "correct horse battery staple, demo only";
beforeAll(async () => {
  w = await demoWorld();
});
afterAll(() => {
  w.cleanup();
  rmSync(out, { recursive: true, force: true });
});

type Row = Record<string, unknown>;
const KEYS: Record<string, string[]> = {
  return_people: ["engagement_id", "person_id"],
  intake_responses: ["engagement_id"],
  source_owners: ["source_id", "person_id"],
  return_sources: ["engagement_id", "source_id"],
  invoice_included: ["invoice_id", "price_code"],
  reminder_preferences: ["user_id", "kind"],
};
const keyOf = (table: string, r: Row) => (KEYS[table] ?? ["id"]).map((k) => r[k]).join("|");
// A database row as the export should show it: no credential, JSON columns parsed.
const asExported = (table: string, r: Row) => {
  const row = { ...r };
  if (table === "users") delete row.password_hash;
  if (table === "intake_responses") row.answers = JSON.parse(row.answers as string);
  if (table === "events") row.data = JSON.parse(row.data as string);
  return row;
};
const readRecord = (dir: string) => JSON.parse(readFileSync(join(dir, "record.json"), "utf8")) as ExportRecord;
const households = () => w.all<{ id: string }>("SELECT id FROM households ORDER BY id").map((h) => h.id);
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? filesUnder(join(dir, f)) : [join(dir, f)]));

test("every table is either part of a household's record or explicitly practice-wide", () => {
  const tables = w.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((t) => t.name);
  const decided = [...Object.keys(HOUSEHOLD_SCOPE), ...PRACTICE_WIDE];
  expect(tables.filter((t) => !decided.includes(t))).toEqual([]);
});

describe("all 25 households exported", () => {
  const exported: Record<string, { dir: string; record: ExportRecord; rows: Record<string, Row[]> }> = {};
  let before: Record<string, Row[]>;

  beforeAll(async () => {
    before = Object.fromEntries(Object.keys(HOUSEHOLD_SCOPE).map((t) => [t, w.all<Row>(`SELECT * FROM ${t}`)]));
    for (const id of households()) {
      const r = await exportHousehold({ db: w.db, storage: w.storage, dataDir: undefined, householdId: id, outDir: join(out, "plain"), actor: "system" });
      const record = readRecord(r.path);
      exported[id] = { dir: r.path, record, rows: flattenRecord(record) };
    }
  });

  test("each row appears in exactly one household's export (helpers aside), and every client row appears somewhere", () => {
    for (const table of Object.keys(HOUSEHOLD_SCOPE)) {
      const seen = new Map<string, string>();
      for (const [hh, e] of Object.entries(exported)) {
        for (const r of e.rows[table]!) {
          const k = keyOf(table, r);
          // A helper with no household of their own appears in every household they were given access to.
          const helper = w.get<{ n: number }>(
            "SELECT COUNT(*) AS n FROM people WHERE household_id IS NULL AND id = ?",
            (table === "people" ? r.id : table === "users" ? r.person_id : "") as string,
          ).n;
          if (!helper) expect({ table, k, also: seen.get(k) ?? null }).toEqual({ table, k, also: null });
          seen.set(k, hh);
        }
      }
      // The only rows no household owns: the preparer's own login and practice-level events.
      const expected = before[table]!.filter((r) => {
        if (table === "users") return r.role === "client";
        if (table === "events") return r.household_id !== null || r.engagement_id !== null;
        return true;
      });
      expect({ table, count: seen.size }).toEqual({ table, count: expected.length });
      for (const r of expected) expect({ table, k: keyOf(table, r), found: seen.has(keyOf(table, r)) }).toEqual({ table, k: keyOf(table, r), found: true });
    }
  });

  test("the record round-trips: flattened back, every row equals the database's, column for column", () => {
    for (const e of Object.values(exported)) {
      for (const [table, rows] of Object.entries(e.rows)) {
        const db = new Map(before[table]!.map((r) => [keyOf(table, r), asExported(table, r)]));
        for (const r of rows) expect({ table, row: r }).toEqual({ table, row: db.get(keyOf(table, r))! });
      }
    }
  });

  test("files are the uploads, byte for byte, under their original names", () => {
    let withFiles = 0;
    for (const e of Object.values(exported)) {
      const docs = [...e.record.returns.flatMap((r) => r.documents), ...e.record.personal_documents];
      const onDisk = existsSync(join(e.dir, "documents")) ? filesUnder(join(e.dir, "documents")).map((f) => relative(e.dir, f)).sort() : [];
      expect(onDisk).toEqual(docs.flatMap((d) => (d.file ? [d.file.path] : [])).sort());
      for (const d of docs) {
        if (!d.file) {
          expect(d.purged_at !== null || d.storage_key === null).toBe(true);
          continue;
        }
        withFiles++;
        const bytes = readFileSync(join(e.dir, d.file.path));
        const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
        expect(hash).toBe(d.file.sha256);
        expect(hash).toBe(d.sha256 as string); // what was recorded at upload
        expect(Buffer.from(bytes).equals(Buffer.from(w.storage.get(d.storage_key as string)))).toBe(true);
        expect(d.file.path.split("/").pop()!.replace(/ \(\d+\)(?=\.[^.]+$|$)/, "")).toBe(d.filename as string);
      }
    }
    expect(withFiles).toBe(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM documents WHERE purged_at IS NULL AND storage_key IS NOT NULL").n);
  });

  test("no credentials, no full SSNs, and a README that explains it", () => {
    for (const e of Object.values(exported)) {
      const text = readFileSync(join(e.dir, "record.json"), "utf8") + readFileSync(join(e.dir, "README.txt"), "utf8");
      expect(text).not.toContain("password_hash");
      expect(text).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
      expect(text).not.toMatch(/\b\d{9}\b/);
      for (const p of e.record.people) expect(Object.keys(p).filter((k) => k.includes("ssn"))).toEqual(["ssn_last4"]);
      expect(e.record.export_format).toBe(EXPORT_FORMAT);
      expect(readFileSync(join(e.dir, "README.txt"), "utf8")).toContain(e.record.household.display_name as string);
    }
  });

  test("each export is recorded against its household", () => {
    for (const id of households()) expect(w.eventsOf("household.exported", id).map((e) => JSON.parse(e.data).encrypted)).toContain(false);
  });
});

describe("sealed exports", () => {
  test("one encrypted file that opens back into the same folder; the wrong passphrase opens nothing", async () => {
    const id = households()[0]!;
    const sealedDir = join(out, "sealed");
    const r = await exportHousehold({ db: w.db, storage: w.storage, dataDir: undefined, householdId: id, outDir: sealedDir, actor: "system", passphrase: PASSPHRASE });
    expect(r.encrypted).toBe(true);
    expect(readdirSync(sealedDir)).toEqual([r.path.split("/").pop()!]);
    expect(r.path.endsWith(SEALED_EXT)).toBe(true);
    expect(readFileSync(r.path).subarray(0, 6).toString()).toBe("BTPBK1");

    const opened = join(out, "opened");
    await unsealTo(r.path, PASSPHRASE, opened);
    const [folder] = readdirSync(opened);
    const record = readRecord(join(opened, folder!));
    expect(record.household.id).toBe(id);
    expect(await unsealTo(r.path, "the wrong passphrase, twenty+ chars", join(out, "nope")).catch((e: Error) => e.message)).toContain("wrong passphrase");
    expect(existsSync(join(out, "nope"))).toBe(false);
  });

  test("a short passphrase is refused before anything is written", async () => {
    const dir = join(out, "short");
    const err = await exportHousehold({ db: w.db, storage: w.storage, dataDir: undefined, householdId: households()[0]!, outDir: dir, actor: "system", passphrase: "short" }).catch((e: Error) => e.message);
    expect(err).toContain("at least");
    expect(existsSync(dir)).toBe(false);
  });
});

describe("where exports may go", () => {
  test("never inside the repo or the data directory", async () => {
    const id = households()[0]!;
    const inRepo = await exportHousehold({ db: w.db, storage: w.storage, dataDir: undefined, householdId: id, outDir: join(REPO_ROOT, "exports"), actor: "system" }).catch((e: Error) => e.message);
    expect(inRepo).toContain("outside the repo");
    const data = join(out, "data");
    const inData = await exportHousehold({ db: w.db, storage: w.storage, dataDir: data, householdId: id, outDir: join(data, "x"), actor: "system" }).catch((e: Error) => e.message);
    expect(inData).toContain("outside the data directory");
  });
});

describe("household.export (the procedure)", () => {
  test("the preparer exports to EXPORT_DIR; the path comes back, the contents don't", async () => {
    const id = households()[1]!;
    process.env.EXPORT_DIR = join(out, "procedure");
    try {
      const res = await w.call(w.preparerId, "household.export", { householdId: id }, "mutation");
      expect(res.status).toBe(200);
      const data = res.data as { path: string; encrypted: boolean };
      expect(data.path.startsWith(join(out, "procedure"))).toBe(true);
      expect(data.encrypted).toBe(false);
      expect(readRecord(data.path).household.id).toBe(id);
      expect(JSON.stringify(res.data)).not.toContain("first_name");
    } finally {
      delete process.env.EXPORT_DIR;
    }
  });

  test("not on the portal, not for clients, not for a household that doesn't exist", async () => {
    const id = households()[1]!;
    expect((await w.call(w.preparerId, "household.export", { householdId: id }, "mutation", "portal")).status).toBe(404);
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "household.export", { householdId: id }, "mutation")).status).toBe(403);
    expect((await w.call(w.preparerId, "household.export", { householdId: "00000000-0000-7000-8000-000000000000" }, "mutation")).status).toBe(404);
  });

  test("live has no default folder: EXPORT_DIR or nothing", () => {
    expect(exportDirFor("live", {})).toBeNull();
    expect(exportDirFor("live", { EXPORT_DIR: "/Volumes/Exports" })).toBe("/Volumes/Exports");
    expect(exportDirFor("demo", {})).toStartWith(tmpdir());
  });
});
