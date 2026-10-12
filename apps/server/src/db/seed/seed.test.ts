import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Stage, tables } from "@app/schema";
import type { Config } from "../../config";
import { migrate } from "../migrate";
import { bootDatabase, connect, DB_FILE } from "../open";
import { applySchema } from "../schema";
import { seedDemo, type SeedSummary } from "./seed";
import { createStorage } from "../../storage";

const ANCHOR = new Date("2026-09-23T17:00:00.000Z");
const tmp = mkdtempSync(join(tmpdir(), "btp-seed-"));

async function seeded(dir: string, seed = 2026) {
  const db = new Database(":memory:", { strict: true });
  await applySchema(db);
  const summary = seedDemo(db, { storage: createStorage(dir), anchor: ANCHOR, seed });
  return { db, summary };
}

let db: Database;
let summary: SeedSummary;
const filesDir = join(tmp, "a");

beforeAll(async () => {
  ({ db, summary } = await seeded(filesDir));
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const all = <T>(sql: string, ...params: string[]) => db.query(sql).all(...params) as T[];
const one = <T>(sql: string, ...params: string[]) => db.query(sql).get(...params) as T;

function dump(d: Database) {
  const out: Record<string, unknown[]> = {};
  for (const table of Object.keys(tables)) out[table] = d.query(`SELECT * FROM ${table} ORDER BY rowid`).all();
  return out;
}

describe("determinism", () => {
  test("the same seed and anchor produce byte-identical data", async () => {
    const again = await seeded(join(tmp, "b"));
    expect(dump(again.db)).toEqual(dump(db));
  });

  test("ids don't depend on the anchor, so demo links survive reboots", async () => {
    const later = new Database(":memory:", { strict: true });
    await applySchema(later);
    seedDemo(later, { storage: createStorage(join(tmp, "c")), anchor: new Date("2026-12-01T00:00:00.000Z") });
    const ids = (d: Database) => d.query("SELECT id FROM households ORDER BY id").all();
    expect(ids(later)).toEqual(ids(db));
  });

  test("a different seed produces a different world", async () => {
    const other = await seeded(join(tmp, "d"), 7);
    expect(other.db.query("SELECT display_name FROM households").all()).not.toEqual(db.query("SELECT display_name FROM households").all());
  });
});

describe("coverage", () => {
  test("25 households for the season before the anchor year", () => {
    expect(summary.households).toBe(25);
    expect(summary.taxYear).toBe(2025);
  });

  test("every pipeline stage has at least one current return", () => {
    const stages = all<{ stage: string }>("SELECT DISTINCT stage FROM engagements WHERE tax_year = 2025 AND kind = 'original'").map((r) => r.stage);
    expect(stages.sort()).toEqual([...Stage.options].sort());
  });

  test("single, joint, separate and head-of-household returns all appear", () => {
    const statuses = all<{ filing_status: string }>("SELECT DISTINCT filing_status FROM engagements WHERE filing_status IS NOT NULL").map((r) => r.filing_status);
    expect(statuses.sort()).toEqual(["hoh", "mfj", "mfs", "single"]);
    // Married filing separately: two returns, one household, one shared letter.
    const mfs = one<{ returns: number; letters: number }>(
      "SELECT COUNT(*) AS returns, COUNT(DISTINCT letter_id) AS letters FROM engagements WHERE filing_status = 'mfs' AND tax_year = 2025",
    );
    expect(mfs).toEqual({ returns: 2, letters: 1 });
  });

  test("dependents, including a teen who is claimed and also files", () => {
    expect(one<{ n: number }>("SELECT COUNT(*) AS n FROM return_people WHERE role = 'dependent' AND tax_year = 2025").n).toBeGreaterThan(5);
    const both = one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM return_people d JOIN return_people f
         ON f.person_id = d.person_id AND f.tax_year = d.tax_year AND f.role = 'primary'
       WHERE d.role = 'dependent' AND d.tax_year = 2025`,
    );
    expect(both.n).toBe(1);
  });

  test("IHSS caregivers, gig workers, landlords, investors and retirees", () => {
    const kinds = all<{ kind: string; n: number }>("SELECT kind, COUNT(*) AS n FROM sources GROUP BY kind");
    const n = Object.fromEntries(kinds.map((k) => [k.kind, k.n]));
    expect(n.ihss_provider).toBeGreaterThanOrEqual(3);
    expect(n.business).toBeGreaterThanOrEqual(2);
    expect(n.rental_property).toBeGreaterThanOrEqual(2);
    expect(n.brokerage).toBeGreaterThanOrEqual(2);
    expect(n.retirement).toBeGreaterThanOrEqual(3);
    const kindsOnFile = all<{ kind: string }>("SELECT DISTINCT kind FROM documents").map((d) => d.kind);
    expect(kindsOnFile).toEqual(expect.arrayContaining(["w2", "1099_nec", "1099_b", "1099_r", "ihss_paystub", "rent_ledger", "photo_id"]));
  });

  test("an amended return in progress for last season", () => {
    const amended = all<{ stage: string; tax_year: number }>("SELECT stage, tax_year FROM engagements WHERE kind = 'amended'");
    expect(amended).toEqual([{ stage: "preparing", tax_year: 2024 }]);
  });

  test("every settlement state appears on an issued invoice", () => {
    const states = all<{ settlement: string }>("SELECT DISTINCT settlement FROM invoice_balances").map((r) => r.settlement);
    expect(states.sort()).toEqual(["failed_last_attempt", "paid", "partial", "unpaid"]);
  });

  test("a rejected document with a reason, and an answered question", () => {
    expect(one<{ n: number }>("SELECT COUNT(*) AS n FROM documents WHERE status = 'rejected' AND reject_reason IS NOT NULL").n).toBe(1);
    expect(one<{ n: number }>("SELECT COUNT(*) AS n FROM requests WHERE kind = 'question' AND response IS NOT NULL").n).toBe(1);
  });

  test("returning clients get a checklist from last year; closed jobs drop off it", () => {
    const expected = all<{ source_label: string }>("SELECT source_label FROM expected_documents");
    expect(expected.length).toBeGreaterThan(0);
    const closed = all<{ id: string }>("SELECT id FROM sources WHERE last_year IS NOT NULL");
    expect(closed.length).toBe(1);
    expect(all("SELECT 1 FROM expected_documents WHERE source_id = ?", closed[0]!.id)).toEqual([]);
  });

  test("a delegate reaches a household only through a grant", () => {
    const delegates = all<{ via: string }>(
      `SELECT ca.via FROM client_access ca JOIN users u ON u.id = ca.user_id JOIN people p ON p.id = u.person_id
       WHERE p.household_id IS NULL`,
    );
    expect(delegates.length).toBeGreaterThan(0);
    expect(new Set(delegates.map((d) => d.via))).toEqual(new Set(["grant"]));
  });
});

describe("the seed respects the API's stage gates", () => {
  test("from documents on, every return has a filing status; before, none do", () => {
    const bad = all("SELECT id FROM engagements WHERE (stage IN ('invited','intake')) = (filing_status IS NOT NULL)");
    expect(bad).toEqual([]);
  });

  test("a spouse is on the return if and only if it's a joint return", () => {
    const bad = all(
      `SELECT e.id FROM engagements e WHERE e.filing_status IS NOT NULL AND
         (e.filing_status = 'mfj') <> EXISTS (SELECT 1 FROM return_people rp WHERE rp.engagement_id = e.id AND rp.role = 'spouse')`,
    );
    expect(bad).toEqual([]);
  });

  test("ready and beyond: no open document requests", () => {
    const bad = all(
      `SELECT r.id FROM requests r JOIN engagements e ON e.id = r.engagement_id
       WHERE r.status = 'open' AND r.kind = 'document' AND e.stage NOT IN ('invited','intake','documents')`,
    );
    expect(bad).toEqual([]);
  });

  test("preparing and beyond: every filer has signed the letter", () => {
    const bad = all(
      `SELECT e.id FROM engagements e JOIN return_people rp ON rp.engagement_id = e.id AND rp.role IN ('primary','spouse')
       WHERE e.stage IN ('preparing','review','filed','complete')
         AND NOT EXISTS (SELECT 1 FROM signatures s WHERE s.letter_id = e.letter_id AND s.person_id = rp.person_id)`,
    );
    expect(bad).toEqual([]);
  });

  test("complete means a zero balance", () => {
    const bad = all(
      `SELECT e.id FROM engagements e JOIN invoice_balances b ON b.engagement_id = e.id
       WHERE e.stage = 'complete' AND b.balance_cents <> 0`,
    );
    expect(bad).toEqual([]);
  });
});

describe("two data worlds", () => {
  test("every login is on a reserved .test domain", () => {
    const emails = all<{ email: string }>("SELECT email FROM users").map((u) => u.email);
    expect(emails.every((e) => e.endsWith(".test"))).toBe(true);
  });

  test("every uploaded file exists, matches its hash, and is stamped DEMO", () => {
    const docs = all<{ storage_key: string; sha256: string; size_bytes: number }>("SELECT storage_key, sha256, size_bytes FROM documents");
    expect(docs.length).toBe(summary.documents);
    for (const d of docs) {
      const bytes = readFileSync(join(filesDir, d.storage_key));
      expect(bytes.byteLength).toBe(d.size_bytes);
      expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(d.sha256);
      const text = bytes.toString("latin1");
      expect(text.startsWith("%PDF-1.4")).toBe(true);
      expect(text).toContain("DEMO - NOT A REAL DOCUMENT");
      expect(text).toContain("SSN: 9XX-XX-");
    }
  });

  test("every seeded row parses with its zod row schema", () => {
    for (const [table, schema] of Object.entries(tables)) {
      for (const row of db.query(`SELECT * FROM ${table}`).all()) {
        const parsed = schema.safeParse(row);
        if (!parsed.success) throw new Error(`${table}: ${parsed.error.message}`);
      }
    }
  });
});

describe("boot", () => {
  const config = (mode: "demo" | "live", dataDir: string): Config => ({ mode, port: 0, adminPort: 1, dataDir, publicDemo: null });

  test("demo mode wipes the directory and re-seeds", async () => {
    const dir = join(tmp, "boot", "demo");
    const first = await bootDatabase(config("demo", dir), { anchor: ANCHOR });
    first.db.close();
    writeFileSync(join(dir, "stray.txt"), "left over");
    const second = await bootDatabase(config("demo", dir), { anchor: ANCHOR });
    expect(existsSync(join(dir, "stray.txt"))).toBe(false);
    expect((second.db.query("SELECT COUNT(*) AS n FROM households").get() as { n: number }).n).toBe(25);
    second.db.close();
  });

  test("demo mode refuses to wipe a directory that isn't named demo", async () => {
    await expect(bootDatabase(config("demo", join(tmp, "not-demo")))).rejects.toThrow(/not a demo directory/);
  });

  test("live mode never seeds and never wipes", async () => {
    const dir = join(tmp, "live");
    mkdirSync(dir, { recursive: true });
    const setup = connect(join(dir, DB_FILE));
    migrate(setup); // live never migrates on boot; `bun run migrate` does this
    setup.close();
    const first = await bootDatabase(config("live", dir));
    first.db.run("INSERT INTO households (id, display_name, created_at) VALUES ('0190a000-0000-7000-8000-000000000001', 'Kept', '2026-09-23T00:00:00.000Z')");
    first.db.close();
    const second = await bootDatabase(config("live", dir));
    expect(second.seeded).toBeNull();
    expect(second.db.query("SELECT display_name FROM households").all()).toEqual([{ display_name: "Kept" }]);
    expect(existsSync(join(dir, DB_FILE))).toBe(true);
    second.db.close();
  });
});
