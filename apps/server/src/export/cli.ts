import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isInside, loadConfig, REPO_ROOT } from "../config";
import { DB_FILE, connect } from "../db/open";
import { unsealTo } from "../live/backup";
import { createStorage } from "../storage";
import { exportDirFor, exportHousehold } from "./household";

// bun run export <householdId> [--encrypt]   one household's offline copy into EXPORT_DIR
// bun run export --all [--encrypt]           every household, archived ones included
// bun run export:open <file> <empty-dir>     unseal an encrypted export
// Env: EXPORT_DIR (outside the repo; demo defaults to a temp folder), BACKUP_PASSPHRASE for --encrypt.

const args = process.argv.slice(2);
const config = loadConfig();

async function main() {
  if (args[0] === "open") {
    const [file, target] = [need(args[1], "export file"), need(args[2], "empty target directory")];
    if (existsSync(target) && readdirSync(target).length) throw new Error(`target must be empty or not exist yet: ${target}`);
    if (isInside(REPO_ROOT, target)) throw new Error("target must be outside the repo");
    await unsealTo(file, process.env.BACKUP_PASSPHRASE, target);
    console.log(`✔ opened into ${target}`);
    return;
  }
  const encrypt = args.includes("--encrypt");
  const which = args.filter((a) => a !== "--encrypt");
  const outDir = exportDirFor(config.mode);
  if (!outDir) throw new Error("set EXPORT_DIR to a folder outside the repo");
  const db = connect(join(config.dataDir, DB_FILE));
  try {
    const ids =
      which[0] === "--all"
        ? db.query<{ id: string }, []>("SELECT id FROM households ORDER BY display_name").all().map((r) => r.id)
        : [need(which[0], "household id (or --all)")];
    const storage = createStorage(config.dataDir);
    for (const householdId of ids) {
      const r = await exportHousehold({
        db, storage, dataDir: config.dataDir, householdId, outDir, actor: "system",
        passphrase: encrypt ? (process.env.BACKUP_PASSPHRASE ?? "") : undefined,
      });
      console.log(`✔ ${r.path}  (${r.documents} documents${r.encrypted ? ", encrypted" : ""})`);
    }
  } finally {
    db.close();
  }
}

function need(v: string | undefined, what: string) {
  if (!v) throw new Error(`missing ${what}`);
  return v;
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
