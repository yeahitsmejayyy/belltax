import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import type { Config } from "../config";
import { createStorage, type Storage } from "../storage";
import { migrate, migrationStatus } from "./migrate";
import { seedDemo, type SeedSummary } from "./seed/seed";

export const DB_FILE = "belltaxprep.db";

// Open a database file with this project's connection settings. Doesn't touch the schema.
export function connect(file: string) {
  const db = new Database(file, { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

// Demo: wipe, migrate from scratch, re-seed — the demo is always the same known world.
// Live: open what's there and require it to be exactly current. Live never migrates on boot: that's
// `bun run migrate`, run on purpose, after a backup. Real data is never generated, only entered.
export async function bootDatabase(config: Config, opts: { anchor?: Date; storage?: Storage } = {}) {
  let seeded: SeedSummary | null = null;
  if (config.mode === "demo") {
    // Belt and braces on top of config.ts: only ever delete a directory named "demo".
    if (basename(config.dataDir) !== "demo") throw new Error(`refusing to wipe ${config.dataDir}: not a demo directory`);
    rmSync(config.dataDir, { recursive: true, force: true });
  }
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  const db = connect(join(config.dataDir, DB_FILE));

  if (config.mode === "demo") {
    migrate(db);
    seeded = seedDemo(db, { storage: opts.storage ?? createStorage(config.dataDir), anchor: opts.anchor });
  } else {
    const status = migrationStatus(db); // throws on edited or unknown migrations
    if (status.pending.length) {
      db.close();
      const list = status.pending.map((m) => `${String(m.version).padStart(3, "0")}-${m.name}`).join(", ");
      throw new Error(`the live database is behind the code (pending: ${list}). Back it up, then run: bun run migrate`);
    }
  }
  return { db, seeded };
}
