import { join } from "node:path";
import { loadConfig } from "../config";
import { connect, DB_FILE } from "../db/open";
import { createStorage } from "../storage";
import { DEFAULT_DAYS_AFTER_FILING, findArchivableLetters, findOrphans, findPurgeable, purge } from "./purge";

// bun run purge            list what the portal would forget (changes nothing)
// bun run purge --confirm  forget it. In live mode, back up first.
// DAYS_AFTER_FILING overrides the 30-day wait. Nothing goes without an export (bun run season:close) except verified IDs.

const config = loadConfig();
const db = connect(join(config.dataDir, DB_FILE));
const storage = createStorage(config.dataDir);
const daysAfterFiling = Number(process.env.DAYS_AFTER_FILING ?? DEFAULT_DAYS_AFTER_FILING);
const confirm = process.argv.includes("--confirm");
const LABEL = { id_verified: "id    ", purge_after: "date  ", after_filing: "filed " } as const;

try {
  const items = findPurgeable(db, { daysAfterFiling });
  const letters = findArchivableLetters(db, { daysAfterFiling });
  const orphans = findOrphans(db, storage);
  console.log(
    `${config.mode.toUpperCase()} · ${daysAfterFiling} days after filing · ${items.length} document(s) · ${letters.length} letter(s) to archive · ${orphans.length} stray file(s)`,
  );
  for (const i of items) console.log(`  ${LABEL[i.reason]} ${i.household ?? "(no household)"} · ${i.kind} · ${i.filename}`);
  for (const l of letters) console.log(`  letter ${l.household} · ${l.taxYear} engagement letter`);
  const any = items.length || letters.length || orphans.length;
  if (!confirm) {
    console.log(any ? "Dry run: nothing changed. Re-run with --confirm to forget these." : "Nothing to forget.");
  } else {
    if (config.mode === "live") console.log("Live mode: this assumes you ran `bun run backup` first.");
    const done = purge(db, storage, items, letters);
    console.log(`✔ purged ${done.purged} document(s), archived ${done.lettersArchived} letter(s), removed ${done.orphansRemoved} stray file(s)`);
  }
} catch (e) {
  console.error(`✖ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
