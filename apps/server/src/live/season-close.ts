import type { Database } from "bun:sqlite";
import { join } from "node:path";
import { loadConfig } from "../config";
import { connect, DB_FILE } from "../db/open";
import { exportDirFor, exportHousehold } from "../export/household";
import { createStorage, type Storage } from "../storage";

// Closing a season (ticket 49): copy every finished household to the offline record, so the portal can forget it.
// Finished: every return the household has for that year is filed or complete. A household needs a copy unless it
// already has one made after all its returns were filed and after its newest file arrived. The copy is sealed with
// BACKUP_PASSPHRASE (required in live mode) and recorded in household_exports; `bun run purge` looks for that record.
//
//   bun run season:close <tax year>            list who needs a copy (changes nothing)
//   bun run season:close <tax year> --confirm  make the copies into EXPORT_DIR

export type SeasonCloseItem = { householdId: string; household: string; lastExportAt: string | null; needsExport: boolean };

export function seasonCloseList(db: Database, taxYear: number): SeasonCloseItem[] {
  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) throw new Error("tax year must be a year, like 2026");
  return db
    .query<{ id: string; display_name: string; last_export: string | null; filed_at: string; newest_file: string | null }, [number]>(
      `SELECT h.id, h.display_name,
              (SELECT MAX(x.exported_at) FROM household_exports x WHERE x.household_id = h.id) AS last_export,
              (SELECT MAX(COALESCE((SELECT MIN(f.submitted_at) FROM efile_submissions f WHERE f.engagement_id = e.id), e.stage_changed_at))
                 FROM engagements e WHERE e.household_id = h.id AND e.tax_year = ?1) AS filed_at,
              (SELECT MAX(d.created_at) FROM documents d
                 LEFT JOIN engagements e ON e.id = d.engagement_id LEFT JOIN people p ON p.id = d.person_id
                WHERE d.purged_at IS NULL AND COALESCE(e.household_id, p.household_id) = h.id) AS newest_file
         FROM households h
        WHERE EXISTS (SELECT 1 FROM engagements e WHERE e.household_id = h.id AND e.tax_year = ?1)
          AND NOT EXISTS (SELECT 1 FROM engagements e WHERE e.household_id = h.id AND e.tax_year = ?1 AND e.stage NOT IN ('filed', 'complete'))
        ORDER BY h.display_name, h.id`,
    )
    .all(taxYear)
    .map((r) => ({
      householdId: r.id,
      household: r.display_name,
      lastExportAt: r.last_export,
      needsExport: !r.last_export || r.last_export < r.filed_at || (!!r.newest_file && r.last_export < r.newest_file),
    }));
}

export async function closeSeason(opts: {
  db: Database;
  storage: Storage;
  dataDir: string | undefined;
  taxYear: number;
  outDir: string;
  passphrase?: string;
  at?: Date;
}): Promise<{ household: string; path: string; documents: number }[]> {
  const done: { household: string; path: string; documents: number }[] = [];
  for (const item of seasonCloseList(opts.db, opts.taxYear).filter((i) => i.needsExport)) {
    const r = await exportHousehold({ ...opts, householdId: item.householdId, actor: "system" });
    done.push({ household: item.household, path: r.path, documents: r.documents });
  }
  return done;
}

if (import.meta.main) {
  const config = loadConfig();
  const taxYear = Number(process.argv[2]);
  const confirm = process.argv.includes("--confirm");
  const db = connect(join(config.dataDir, DB_FILE));
  try {
    const list = seasonCloseList(db, taxYear);
    const todo = list.filter((i) => i.needsExport);
    console.log(`${config.mode.toUpperCase()} · ${taxYear} · ${list.length} finished household(s) · ${todo.length} need an offline copy`);
    for (const i of list) console.log(`  ${i.needsExport ? "copy " : "done "} ${i.household}${i.lastExportAt ? ` · last copied ${i.lastExportAt.slice(0, 10)}` : ""}`);
    if (!confirm) {
      console.log(todo.length ? "Dry run: nothing written. Re-run with --confirm to make the copies." : "Every finished household has its copy.");
    } else {
      const outDir = exportDirFor(config.mode);
      if (!outDir) throw new Error("set EXPORT_DIR to a folder outside the repo (your offline vault)");
      // Live copies are always sealed; a demo seals them only if a passphrase is set.
      const passphrase = config.mode === "live" || process.env.BACKUP_PASSPHRASE ? (process.env.BACKUP_PASSPHRASE ?? "") : undefined;
      const done = await closeSeason({ db, storage: createStorage(config.dataDir), dataDir: config.dataDir, taxYear, outDir, passphrase });
      for (const d of done) console.log(`✔ ${d.household} · ${d.documents} file(s) · ${d.path}`);
      console.log(`✔ ${done.length} offline copy(ies) made. Move them to the vault; \`bun run purge\` can now forget what they hold, 30 days after filing.`);
    }
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
