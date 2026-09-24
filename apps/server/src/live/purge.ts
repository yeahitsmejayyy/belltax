import type { Database } from "bun:sqlite";
import { now } from "@app/schema";
import { appendEvent } from "../events";
import type { Storage } from "../storage";

// Retention (WISP §V.1, Attachment A; FTC Safeguards Rule 314.4(c)(6)): portal uploads are disposed of
// no later than two years after last use. The preparer's own copy of each return lives in ProSeries
// (IRC §6107), not here. Purging deletes the bytes and keeps the row as a tombstone (rule R34), so
// the audit trail still says a document existed and when it went.
//
// Eligible:
//   - any document whose purge_after date has passed (an explicit decision), or
//   - a document on a return that has been complete for `retentionDays`, or
//   - a person-level document (a photo ID) whose person is on no open return and whose most recent
//     return was completed at least `retentionDays` ago.
// Never runs by itself. `bun run purge` lists; `bun run purge --confirm` deletes (docs/live-runbook.md).

export const DEFAULT_RETENTION_DAYS = 730;

export type Purgeable = {
  id: string;
  storageKey: string;
  filename: string;
  kind: string;
  household: string | null;
  reason: "purge_after" | "retention";
};

export function findPurgeable(db: Database, opts: { at?: Date; retentionDays?: number } = {}): Purgeable[] {
  const at = opts.at ?? new Date();
  const days = opts.retentionDays ?? DEFAULT_RETENTION_DAYS;
  if (!Number.isInteger(days) || days < 1) throw new Error("retention days must be a positive integer");
  const today = at.toISOString().slice(0, 10);
  const cutoff = new Date(at.getTime() - days * 86_400_000).toISOString();
  return db
    .query<{ id: string; storage_key: string; filename: string; kind: string; household: string | null; reason: Purgeable["reason"] }, [string, string]>(
      `SELECT d.id, d.storage_key, d.filename, d.kind,
              COALESCE(h1.display_name, h2.display_name) AS household,
              CASE WHEN d.purge_after IS NOT NULL AND d.purge_after <= ?1 THEN 'purge_after' ELSE 'retention' END AS reason
         FROM documents d
         LEFT JOIN engagements e ON e.id = d.engagement_id
         LEFT JOIN households h1 ON h1.id = e.household_id
         LEFT JOIN people p ON p.id = d.person_id
         LEFT JOIN households h2 ON h2.id = p.household_id
        WHERE d.purged_at IS NULL
          AND (
            (d.purge_after IS NOT NULL AND d.purge_after <= ?1)
            OR (d.purge_after IS NULL AND d.engagement_id IS NOT NULL
                AND e.stage = 'complete' AND e.stage_changed_at <= ?2)
            OR (d.purge_after IS NULL AND d.engagement_id IS NULL
                AND NOT EXISTS (SELECT 1 FROM return_people rp JOIN engagements x ON x.id = rp.engagement_id
                                 WHERE rp.person_id = d.person_id AND x.stage <> 'complete')
                AND (SELECT MAX(x.stage_changed_at) FROM return_people rp JOIN engagements x ON x.id = rp.engagement_id
                      WHERE rp.person_id = d.person_id) <= ?2)
          )
        ORDER BY household, d.created_at`,
    )
    .all(today, cutoff)
    .map((r) => ({ id: r.id, storageKey: r.storage_key, filename: r.filename, kind: r.kind, household: r.household, reason: r.reason }));
}

// Stored files no row points at: left behind if a purge stopped between its commit and the delete.
export function findOrphans(db: Database, storage: Storage): string[] {
  const known = new Set(
    db.query<{ k: string }, []>("SELECT storage_key AS k FROM documents WHERE storage_key IS NOT NULL").all().map((r) => r.k),
  );
  return storage.list().filter((k) => !known.has(k));
}

// Row first (tombstone + event, one transaction), then the bytes. A crash in between leaves a stray
// file that the next run removes as an orphan, never a row pointing at nothing.
export function purge(db: Database, storage: Storage, items: Purgeable[]): { purged: number; orphansRemoved: number } {
  let purged = 0;
  for (const item of items) {
    const at = now();
    const changed = db.transaction(() => {
      const res = db.run("UPDATE documents SET storage_key = NULL, purged_at = ? WHERE id = ? AND purged_at IS NULL", [at, item.id]);
      if (!res.changes) return false;
      const where = db
        .query<{ household_id: string | null; engagement_id: string | null }, [string]>(
          `SELECT COALESCE(e.household_id, p.household_id) AS household_id, d.engagement_id
             FROM documents d LEFT JOIN engagements e ON e.id = d.engagement_id LEFT JOIN people p ON p.id = d.person_id WHERE d.id = ?`,
        )
        .get(item.id)!;
      appendEvent(db, {
        actor: "system",
        type: "document.purged",
        subjectType: "document",
        subjectId: item.id,
        householdId: where.household_id,
        engagementId: where.engagement_id,
        data: { reason: item.reason },
      });
      return true;
    })();
    if (changed) {
      storage.remove(item.storageKey);
      purged++;
    }
  }
  const orphans = findOrphans(db, storage);
  for (const k of orphans) storage.remove(k);
  return { purged, orphansRemoved: orphans.length };
}
