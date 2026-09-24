import type { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { now } from "@app/schema";

// Numbered SQL migrations: apps/server/src/db/migrations/NNN-name.sql, applied in order, each in its
// own transaction, recorded with a checksum. The rules that keep a live database safe:
//   - an applied migration is never edited (checksum mismatch = refuse)
//   - the database is never ahead of the code (unknown applied version = refuse)
//   - numbering has no gaps or duplicates
// A migration whose first line is `-- migrate: foreign-keys-off` runs with foreign keys disabled, for
// table rebuilds, and must leave PRAGMA foreign_key_check clean or it rolls back. See docs/migrations.md.

export const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url).pathname;

const FILE = /^(\d{3})-([a-z0-9-]+)\.sql$/;
const FK_OFF = /^--\s*migrate:\s*foreign-keys-off\b/;

export type Migration = { version: number; name: string; sql: string; checksum: string; foreignKeysOff: boolean };
export type MigrationStatus = { applied: number[]; pending: Migration[]; latest: number };

const checksum = (sql: string) => new Bun.CryptoHasher("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");

export function loadMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const migrations = files.map((f) => {
    const m = f.match(FILE);
    if (!m) throw new Error(`migration file name must look like 001-some-name.sql: ${f}`);
    const sql = readFileSync(join(dir, f), "utf8");
    return { version: Number(m[1]), name: m[2]!, sql, checksum: checksum(sql), foreignKeysOff: FK_OFF.test(sql) };
  });
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`migrations must be numbered 001, 002, … with no gaps or duplicates (found ${String(m.version).padStart(3, "0")} at position ${i + 1})`);
  });
  return migrations;
}

function ensureTable(db: Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    checksum    TEXT NOT NULL,
    applied_at  TEXT NOT NULL
  ) STRICT;`);
}

// Where this database stands against the code. Throws if the two can't be reconciled safely.
export function migrationStatus(db: Database, dir = MIGRATIONS_DIR): MigrationStatus {
  ensureTable(db);
  const migrations = loadMigrations(dir);
  const applied = db.query<{ version: number; name: string; checksum: string }, []>("SELECT version, name, checksum FROM schema_migrations ORDER BY version").all();
  for (const a of applied) {
    const m = migrations[a.version - 1];
    if (!m) throw new Error(`the database has migration ${a.version} (${a.name}), which this code doesn't know. Refusing to run older code against a newer database.`);
    if (m.checksum !== a.checksum) {
      throw new Error(`migration ${String(a.version).padStart(3, "0")}-${a.name}.sql was edited after it was applied. Never edit an applied migration; add a new one.`);
    }
  }
  return { applied: applied.map((a) => a.version), pending: migrations.slice(applied.length), latest: migrations.length };
}

// Apply everything pending, one transaction per migration. Returns what was applied.
export function migrate(db: Database, dir = MIGRATIONS_DIR): Migration[] {
  const { pending } = migrationStatus(db, dir);
  for (const m of pending) {
    const label = `${String(m.version).padStart(3, "0")}-${m.name}`;
    // PRAGMA foreign_keys is a no-op inside a transaction, so it's switched outside one.
    if (m.foreignKeysOff) db.exec("PRAGMA foreign_keys = OFF;");
    try {
      db.exec("BEGIN IMMEDIATE;");
      try {
        db.exec(m.sql);
        if (m.foreignKeysOff) {
          const broken = db.query("PRAGMA foreign_key_check").all();
          if (broken.length) throw new Error(`leaves ${broken.length} foreign key violation(s): ${JSON.stringify(broken.slice(0, 3))}`);
        }
        db.run("INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)", [m.version, m.name, m.checksum, now()]);
        db.exec("COMMIT;");
      } catch (e) {
        db.exec("ROLLBACK;");
        throw new Error(`migration ${label} failed and was rolled back: ${(e as Error).message}`);
      }
    } finally {
      db.exec("PRAGMA foreign_keys = ON;");
    }
  }
  return pending;
}
