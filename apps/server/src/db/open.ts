import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import type { Config } from "../config";
import { applySchema } from "./schema";
import { seedDemo, type SeedSummary } from "./seed/seed";

export const DB_FILE = "belltaxprep.db";

export async function openDatabase(file: string) {
  const db = new Database(file, { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL;");
  await applySchema(db);
  return db;
}

// Demo: wipe and re-seed on every boot, so the demo is always the same known world.
// Live: open what's there and never seed. Real data is never generated, only entered.
export async function bootDatabase(config: Config, opts: { anchor?: Date } = {}) {
  let seeded: SeedSummary | null = null;
  if (config.mode === "demo") {
    // Belt and braces on top of config.ts: only ever delete a directory named "demo".
    if (basename(config.dataDir) !== "demo") throw new Error(`refusing to wipe ${config.dataDir}: not a demo directory`);
    rmSync(config.dataDir, { recursive: true, force: true });
  }
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  const db = await openDatabase(join(config.dataDir, DB_FILE));
  if (config.mode === "demo") seeded = seedDemo(db, { filesDir: config.dataDir, anchor: opts.anchor });
  return { db, seeded };
}
