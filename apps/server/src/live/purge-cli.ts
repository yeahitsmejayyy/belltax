import { join } from "node:path";
import { loadConfig } from "../config";
import { connect, DB_FILE } from "../db/open";
import { createStorage } from "../storage";
import { DEFAULT_RETENTION_DAYS, findOrphans, findPurgeable, purge } from "./purge";

// bun run purge            list what retention would delete (changes nothing)
// bun run purge --confirm  delete it. In live mode, back up first.
// RETENTION_DAYS overrides the 730-day default.

const config = loadConfig();
const db = connect(join(config.dataDir, DB_FILE));
const storage = createStorage(config.dataDir);
const retentionDays = Number(process.env.RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
const confirm = process.argv.includes("--confirm");

try {
  const items = findPurgeable(db, { retentionDays });
  const orphans = findOrphans(db, storage);
  console.log(`${config.mode.toUpperCase()} · retention ${retentionDays} days · ${items.length} document(s) eligible · ${orphans.length} stray file(s)`);
  for (const i of items) console.log(`  ${i.reason === "purge_after" ? "date " : "aged "} ${i.household ?? "(no household)"} · ${i.kind} · ${i.filename}`);
  if (!confirm) {
    console.log(items.length || orphans.length ? "Dry run: nothing deleted. Re-run with --confirm to delete." : "Nothing to purge.");
  } else {
    if (config.mode === "live") console.log("Live mode: this assumes you ran `bun run backup` first.");
    const done = purge(db, storage, items);
    console.log(`✔ purged ${done.purged} document(s), removed ${done.orphansRemoved} stray file(s)`);
  }
} catch (e) {
  console.error(`✖ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
