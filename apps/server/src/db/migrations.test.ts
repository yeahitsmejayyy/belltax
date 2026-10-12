import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { now } from "@app/schema";
import type { Config } from "../config";
import { createStorage } from "../storage";
import { loadMigrations, migrate, migrationStatus, MIGRATIONS_DIR } from "./migrate";
import { bootDatabase, connect, DB_FILE } from "./open";
import { seedDemo } from "./seed/seed";

// The migration runner: order, checksums, all-or-nothing, and a real table rebuild on seeded data.

const temps: string[] = [];
afterEach(() => temps.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "btp-mig-"));
  temps.push(d);
  return d;
};
// A migrations folder holding every real migration, plus whatever the test adds after them.
const REAL = loadMigrations();
const next = (n = 1, name = "test") => `${String(REAL.length + n).padStart(3, "0")}-${name}.sql`;
function folder(extra: Record<string, string> = {}) {
  const dir = join(tempDir(), "migrations");
  mkdirSync(dir);
  for (const m of REAL) copyFileSync(join(MIGRATIONS_DIR, `${String(m.version).padStart(3, "0")}-${m.name}.sql`), join(dir, `${String(m.version).padStart(3, "0")}-${m.name}.sql`));
  for (const [name, sql] of Object.entries(extra)) writeFileSync(join(dir, name), sql);
  return dir;
}
const memory = () => {
  const db = new Database(":memory:", { strict: true });
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
};
const tables = (db: Database) =>
  db.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);

describe("applying", () => {
  test("a fresh database gets every migration, recorded with its checksum", () => {
    const db = memory();
    const applied = migrate(db);
    expect(applied.map((m) => m.version)).toEqual(loadMigrations().map((m) => m.version));
    const rows = db.query<{ version: number; checksum: string }, []>("SELECT version, checksum FROM schema_migrations").all();
    expect(rows.map((r) => r.version)).toEqual(applied.map((m) => m.version));
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.checksum))).toBe(true);
    expect(tables(db)).toContain("engagements");
  });

  test("running again changes nothing", () => {
    const db = memory();
    migrate(db);
    expect(migrate(db)).toEqual([]);
    expect(migrationStatus(db).pending).toEqual([]);
  });

  test("new migrations apply on top, in order", () => {
    const dir = folder({ [next(1, "add-preferred-name")]: "ALTER TABLE people ADD COLUMN preferred_name TEXT;" });
    const db = memory();
    migrate(db, join(dir, "..", "migrations"));
    expect(db.query("SELECT name FROM pragma_table_info('people') WHERE name = 'preferred_name'").all()).toHaveLength(1);
  });
});

describe("refusing", () => {
  test("gaps, duplicates and bad names", () => {
    expect(() => loadMigrations(folder({ [next(2, "skipped-one")]: "SELECT 1;" }))).toThrow(/no gaps or duplicates/);
    expect(() => loadMigrations(folder({ "2-no-padding.sql": "SELECT 1;" }))).toThrow(/must look like 001-some-name.sql/);
    expect(() => loadMigrations(folder({ [next(1, "Upper")]: "SELECT 1;" }))).toThrow(/must look like/);
  });

  test("an applied migration that was edited", () => {
    const dir = folder({ [next(1, "add-note")]: "ALTER TABLE households ADD COLUMN note TEXT;" });
    const db = memory();
    migrate(db, dir);
    appendFileSync(join(dir, next(1, "add-note")), "\n-- a harmless-looking edit\n");
    expect(() => migrationStatus(db, dir)).toThrow(/was edited after it was applied/);
  });

  test("a database that's ahead of the code", () => {
    const db = memory();
    migrate(db, folder({ [next(1, "add-note")]: "ALTER TABLE households ADD COLUMN note TEXT;" }));
    expect(() => migrationStatus(db, folder())).toThrow(/doesn't know/);
  });

  test("a failing migration rolls back completely and records nothing", () => {
    const dir = folder({ [next(1, "half-done")]: "CREATE TABLE half_done (id TEXT);\nTHIS IS NOT SQL;" });
    const db = memory();
    expect(() => migrate(db, dir)).toThrow(new RegExp(`${next(1, "half-done").replace(".sql", "")} failed and was rolled back`));
    expect(tables(db)).not.toContain("half_done");
    expect(migrationStatus(db, dir).applied).toEqual(REAL.map((m) => m.version));
  });

  test("a foreign-keys-off migration that leaves orphans is rolled back", () => {
    const dir = folder({
      [next(1, "orphan")]: `-- migrate: foreign-keys-off
INSERT INTO people (id, household_id, first_name, last_name, created_at)
VALUES ('0190a000-0000-7000-8000-000000000001', '0190a000-0000-7000-8000-00000000dead', 'Nobody', 'Anywhere', '2026-01-01T00:00:00.000Z');`,
    });
    const db = memory();
    expect(() => migrate(db, dir)).toThrow(/foreign key violation/);
    expect(db.query("SELECT COUNT(*) AS n FROM people").get()).toEqual({ n: 0 });
    expect(db.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
  });
});

describe("rebuilding a table to change a CHECK (docs/migrations.md)", () => {
  // Generated from the live schema, exactly as the doc describes: new table with the change, copy, swap,
  // then recreate the indexes, triggers and views that DROP TABLE took with it.
  function rebuildPaymentsAllowingCard(db: Database) {
    const sqlOf = (type: string, name: string) =>
      db.query<{ sql: string }, [string, string]>("SELECT sql FROM sqlite_master WHERE type = ? AND name = ?").get(type, name)!.sql;
    const table = sqlOf("table", "payments")
      .replace("CREATE TABLE IF NOT EXISTS payments", "CREATE TABLE payments_new")
      .replace("CREATE TABLE payments", "CREATE TABLE payments_new")
      .replace("method IN ('cash', 'check', 'zelle', 'other')", "method IN ('cash', 'check', 'zelle', 'card', 'other')");
    expect(table).toContain("'card'");
    const cols = db.query<{ name: string }, []>("SELECT name FROM pragma_table_info('payments')").all().map((c) => c.name).join(", ");
    const onTable = db
      .query<{ sql: string }, []>("SELECT sql FROM sqlite_master WHERE tbl_name = 'payments' AND type IN ('index', 'trigger') AND sql IS NOT NULL")
      .all()
      .map((r) => `${r.sql};`);
    const views = ["invoice_balances", "pipeline_rows"]; // pipeline_rows reads invoice_balances, which reads payments
    return `-- migrate: foreign-keys-off
DROP VIEW IF EXISTS pipeline_rows;
DROP VIEW IF EXISTS invoice_balances;
${table};
INSERT INTO payments_new (${cols}) SELECT ${cols} FROM payments;
DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;
${onTable.join("\n")}
${views.map((v) => `${sqlOf("view", v)};`).join("\n")}
`;
  }

  test("every row, rule, trigger and view survives on a fully seeded database", () => {
    const dir = folder();
    const db = memory();
    migrate(db, dir);
    seedDemo(db, { storage: createStorage(tempDir()), anchor: new Date("2026-09-23T17:00:00.000Z") });

    const before = {
      payments: db.query("SELECT * FROM payments ORDER BY id").all(),
      balances: db.query("SELECT * FROM invoice_balances ORDER BY invoice_id").all(),
      pipeline: db.query("SELECT engagement_id, balance_cents FROM pipeline_rows ORDER BY engagement_id").all(),
      objects: db.query("SELECT type, name FROM sqlite_master WHERE type IN ('index', 'trigger', 'view') ORDER BY type, name").all(),
    };
    writeFileSync(join(dir, next(1, "payments-allow-card")), rebuildPaymentsAllowingCard(db));
    expect(migrate(db, dir).map((m) => m.name)).toEqual(["payments-allow-card"]);

    // Same rows, same derived balances, same set of indexes/triggers/views.
    expect(db.query("SELECT * FROM payments ORDER BY id").all()).toEqual(before.payments);
    expect(db.query("SELECT * FROM invoice_balances ORDER BY invoice_id").all()).toEqual(before.balances);
    expect(db.query("SELECT engagement_id, balance_cents FROM pipeline_rows ORDER BY engagement_id").all()).toEqual(before.pipeline);
    expect(db.query("SELECT type, name FROM sqlite_master WHERE type IN ('index', 'trigger', 'view') ORDER BY type, name").all()).toEqual(before.objects);
    expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(db.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });

    // The change took, and every old rule still bites.
    const issued = db.query<{ id: string }, []>("SELECT id FROM invoices WHERE status = 'issued' LIMIT 1").get()!.id;
    const draftId = Bun.randomUUIDv7();
    const anyReturn = db.query<{ id: string }, []>("SELECT id FROM engagements LIMIT 1").get()!.id;
    db.run("INSERT INTO invoices (id, engagement_id, number, status, created_at) VALUES (?, ?, '2099-0001', 'draft', ?)", [draftId, anyReturn, now()]);
    const preparer = db.query<{ id: string }, []>("SELECT id FROM users WHERE role = 'preparer'").get()!.id;
    const manual = (invoiceId: string, method: string, over: Record<string, string | number> = {}) =>
      db.run(
        "INSERT INTO payments (id, invoice_id, provider, method, received_on, recorded_by, amount_cents, status, created_at, updated_at) VALUES (?, ?, 'manual', ?, '2026-09-01', ?, ?, 'succeeded', ?, ?)",
        [Bun.randomUUIDv7(), invoiceId, method, preparer, (over.amount as number) ?? 100, now(), now()],
      );
    expect(() => manual(issued, "card")).not.toThrow();
    expect(() => manual(issued, "bitcoin")).toThrow(/CHECK constraint failed/);
    expect(() => manual(issued, "cash", { amount: 0 })).toThrow(/CHECK constraint failed/);
    expect(() => manual("0190a000-0000-7000-8000-00000000dead", "cash")).toThrow(/FOREIGN KEY constraint failed/);
    expect(() => manual(draftId, "cash")).toThrow(/only be taken on an issued invoice/); // the trigger was recreated
  });
});

describe("boot", () => {
  const live = (dataDir: string): Config => ({ mode: "live", port: 0, adminPort: 1, dataDir, publicDemo: null });

  test("live refuses to start behind the code, and starts once migrated", async () => {
    const dir = tempDir();
    await expect(bootDatabase(live(dir))).rejects.toThrow(/behind the code.*bun run migrate/);
    const db = connect(join(dir, DB_FILE));
    migrate(db);
    db.close();
    const booted = await bootDatabase(live(dir));
    expect(booted.seeded).toBeNull();
    booted.db.close();
  });

  test("live refuses to start if an applied migration was edited", async () => {
    const dir = tempDir();
    const db = connect(join(dir, DB_FILE));
    migrate(db);
    db.run("UPDATE schema_migrations SET checksum = 'tampered' WHERE version = 1");
    db.close();
    await expect(bootDatabase(live(dir))).rejects.toThrow(/was edited after it was applied/);
  });

  test("demo still wipes, migrates from scratch and seeds", async () => {
    const dir = join(tempDir(), "demo");
    const booted = await bootDatabase({ mode: "demo", port: 0, adminPort: 1, dataDir: dir, publicDemo: null }, { anchor: new Date("2026-09-23T17:00:00.000Z") });
    expect(migrationStatus(booted.db).pending).toEqual([]);
    expect(booted.seeded!.households).toBe(25);
    booted.db.close();
  });
});
