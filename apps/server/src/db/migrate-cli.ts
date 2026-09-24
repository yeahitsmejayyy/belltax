import { join } from "node:path";
import { loadConfig } from "../config";
import { migrate, migrationStatus } from "./migrate";
import { connect, DB_FILE } from "./open";

// `bun run migrate` — bring the database for the current RUN_MODE up to date.
// `bun run migrate --status` — show where it stands without changing anything.
// In live mode, take a backup first (ticket 18 adds `bun run backup`).
const config = loadConfig();
const file = join(config.dataDir, DB_FILE);
const db = connect(file);
const statusOnly = process.argv.includes("--status");

try {
  const status = migrationStatus(db);
  console.log(`${config.mode.toUpperCase()} database: ${file}`);
  console.log(`  applied ${status.applied.length} of ${status.latest} migrations`);
  if (!status.pending.length) {
    console.log("  up to date");
  } else if (statusOnly) {
    for (const m of status.pending) console.log(`  pending  ${String(m.version).padStart(3, "0")}-${m.name}`);
  } else {
    for (const m of migrate(db)) console.log(`  applied  ${String(m.version).padStart(3, "0")}-${m.name}`);
    console.log("  up to date");
  }
} catch (e) {
  console.error(`✖ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
