import { join } from "node:path";
import { loadConfig } from "../config";
import { DB_FILE, connect } from "../db/open";
import { createBackup, restoreBackup, rotateBackups, verifyBackup } from "./backup";
import { checkHost } from "./hardening";

// bun run backup                        encrypted snapshot of the current RUN_MODE's data, then rotate
// bun run backup:verify <file>          decrypt and check a backup without restoring it
// bun run restore <file> <empty-dir>    restore into a new directory (never over live data)
// bun run live:check                    is this machine fit to hold client data?
// Env: BACKUP_DIR (outside the repo), BACKUP_PASSPHRASE (password manager), BACKUP_KEEP (default 30).

const [command, ...args] = process.argv.slice(2);
const config = loadConfig();
const backupDir = process.env.BACKUP_DIR;
const passphrase = process.env.BACKUP_PASSPHRASE;

async function main() {
  switch (command) {
    case "backup": {
      if (!backupDir) throw new Error("set BACKUP_DIR to a folder outside the repo (ideally another disk)");
      const db = connect(join(config.dataDir, DB_FILE));
      try {
        const { file, manifest } = await createBackup({ db, dataDir: config.dataDir, backupDir, passphrase });
        const removed = rotateBackups(backupDir, Number(process.env.BACKUP_KEEP ?? 30));
        console.log(`✔ backup written: ${file}`);
        console.log(`  schema v${manifest.schemaVersion} · db ${manifest.db.bytes} bytes · ${manifest.uploads.files} uploads`);
        if (removed.length) console.log(`  rotated out ${removed.length} old backup(s)`);
      } finally {
        db.close();
      }
      break;
    }
    case "verify": {
      const m = await verifyBackup(need(args[0], "backup file"), passphrase);
      console.log(`✔ backup is intact: taken ${m.createdAt}, schema v${m.schemaVersion}, ${m.uploads.files} uploads`);
      break;
    }
    case "restore": {
      const m = await restoreBackup(need(args[0], "backup file"), passphrase, need(args[1], "empty target directory"));
      console.log(`✔ restored into ${args[1]} (taken ${m.createdAt}, schema v${m.schemaVersion}, ${m.uploads.files} uploads)`);
      console.log(`  try it: RUN_MODE=live LIVE_DATA_DIR=${args[1]} PORT=3100 bun run start`);
      break;
    }
    case "check": {
      const checks = checkHost(config, { backupDir });
      for (const c of checks) console.log(`${c.status === "ok" ? "✔" : c.status === "warn" ? "!" : "✖"} ${c.name.padEnd(22)} ${c.detail}`);
      if (checks.some((c) => c.status === "fail")) process.exitCode = 1;
      break;
    }
    default:
      throw new Error("usage: backup | verify <file> | restore <file> <empty-dir> | check");
  }
}

function need(v: string | undefined, what: string) {
  if (!v) throw new Error(`missing ${what}`);
  return v;
}

main().catch((e) => {
  console.error(`✖ ${(e as Error).message}`);
  process.exitCode = 1;
});
