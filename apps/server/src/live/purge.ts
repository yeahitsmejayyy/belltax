import type { Database } from "bun:sqlite";
import { now } from "@app/schema";
import { appendEvent } from "../events";
import type { Storage } from "../storage";

// A mailbox, not a vault (ticket 49; WISP §V.1, Attachment A; FTC Safeguards Rule 314.4(c)(6)). The portal keeps a
// client's files only while the return needs them. The lasting copy is the offline record (bun run export, made for
// every finished household by bun run season:close); the preparer's copy of each return lives in ProSeries (IRC §6107).
//
// The rules:
//   1. Uploaded files go `daysAfterFiling` (30) days after the return is filed, and only once an export of the
//      household was made after the file arrived, so the record holds it. No export, no purge: ever.
//      Filed is the first e-file submission (the stage change, for a return with none). A return whose latest
//      attempt for a jurisdiction was rejected still needs its papers, so it waits.
//   2. A person's own files (no return) go the same way once every return they're on is filed that long ago.
//   3. A photo ID (any identity document) goes as soon as the preparer verifies it, with no export: the record keeps
//      only the note that it was checked, when, and what kind it was. document.review does this; findPurgeable
//      also catches any verified ID still holding its file.
//   4. A signed engagement letter's text moves to the offline record on the same terms as rule 1 (all its returns
//      filed that long ago, an export after the last signature). The portal keeps the fingerprint and the dates.
//   An explicit purge_after date on a document is honoured early, but still never without an export.
//
// Purging deletes the bytes and keeps the row as a tombstone (R34); every step is an event, so the audit trail says a
// thing existed and when it went. Never runs by itself: `bun run purge` lists, `bun run purge --confirm` deletes.

export const DEFAULT_DAYS_AFTER_FILING = 30;

export type PurgeReason = "purge_after" | "after_filing" | "id_verified";
export type Purgeable = {
  id: string;
  storageKey: string;
  filename: string;
  kind: string;
  household: string | null;
  reason: PurgeReason;
};
export type Archivable = { id: string; household: string; taxYear: number };

// When each return was filed, and whether it's settled enough to let its papers go.
const FILED = `
  SELECT e.id, e.household_id,
         COALESCE((SELECT MIN(f.submitted_at) FROM efile_submissions f WHERE f.engagement_id = e.id), e.stage_changed_at) AS filed_at,
         EXISTS (SELECT 1 FROM efile_submissions f WHERE f.engagement_id = e.id AND f.status = 'rejected'
                   AND NOT EXISTS (SELECT 1 FROM efile_submissions g WHERE g.engagement_id = f.engagement_id
                                     AND g.jurisdiction = f.jurisdiction AND g.submitted_at > f.submitted_at)) AS held
    FROM engagements e
   WHERE e.stage IN ('filed', 'complete')`;

// A household's offline copy made at or after `?` (a document's arrival, a letter's last signature).
const EXPORTED_SINCE = (household: string, since: string) =>
  `EXISTS (SELECT 1 FROM household_exports x WHERE x.household_id = ${household} AND x.exported_at >= ${since})`;

function checkDays(days: number) {
  if (!Number.isInteger(days) || days < 0) throw new Error("days after filing must be a whole number, 0 or more");
}

export function findPurgeable(db: Database, opts: { at?: Date; daysAfterFiling?: number } = {}): Purgeable[] {
  const at = opts.at ?? new Date();
  const days = opts.daysAfterFiling ?? DEFAULT_DAYS_AFTER_FILING;
  checkDays(days);
  const today = at.toISOString().slice(0, 10);
  const cutoff = new Date(at.getTime() - days * 86_400_000).toISOString();
  return db
    .query<{ id: string; storage_key: string; filename: string; kind: string; household: string | null; reason: PurgeReason }, [string, string]>(
      `WITH filed AS (${FILED})
       SELECT d.id, d.storage_key, d.filename, d.kind, h.display_name AS household,
              CASE WHEN k.category = 'identity' AND d.status = 'accepted' THEN 'id_verified'
                   WHEN d.purge_after IS NOT NULL AND d.purge_after <= ?1 THEN 'purge_after'
                   ELSE 'after_filing' END AS reason
         FROM documents d
         JOIN document_kinds k ON k.code = d.kind
         LEFT JOIN engagements e ON e.id = d.engagement_id
         LEFT JOIN people p ON p.id = d.person_id
         LEFT JOIN households h ON h.id = COALESCE(e.household_id, p.household_id)
        WHERE d.purged_at IS NULL
          AND (
            (k.category = 'identity' AND d.status = 'accepted')
            OR (h.id IS NOT NULL AND ${EXPORTED_SINCE("h.id", "d.created_at")} AND (
              (d.purge_after IS NOT NULL AND d.purge_after <= ?1)
              OR (d.engagement_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM filed f WHERE f.id = d.engagement_id AND NOT f.held AND f.filed_at <= ?2))
              OR (d.engagement_id IS NULL
                  AND EXISTS (SELECT 1 FROM return_people rp WHERE rp.person_id = d.person_id)
                  AND NOT EXISTS (SELECT 1 FROM return_people rp
                                   WHERE rp.person_id = d.person_id
                                     AND NOT EXISTS (SELECT 1 FROM filed f WHERE f.id = rp.engagement_id AND NOT f.held AND f.filed_at <= ?2)))
            ))
          )
        ORDER BY household, d.created_at`,
    )
    .all(today, cutoff)
    .map((r) => ({ id: r.id, storageKey: r.storage_key, filename: r.filename, kind: r.kind, household: r.household, reason: r.reason }));
}

// Signed letters whose text can leave: every return they cover filed long enough ago, and an export after the last signature.
export function findArchivableLetters(db: Database, opts: { at?: Date; daysAfterFiling?: number } = {}): Archivable[] {
  const at = opts.at ?? new Date();
  const days = opts.daysAfterFiling ?? DEFAULT_DAYS_AFTER_FILING;
  checkDays(days);
  const cutoff = new Date(at.getTime() - days * 86_400_000).toISOString();
  return db
    .query<{ id: string; household: string; tax_year: number }, [string]>(
      `WITH filed AS (${FILED})
       SELECT l.id, h.display_name AS household, l.tax_year
         FROM engagement_letters l JOIN households h ON h.id = l.household_id
        WHERE l.status = 'signed' AND l.archived_at IS NULL
          AND EXISTS (SELECT 1 FROM engagements e WHERE e.letter_id = l.id)
          AND NOT EXISTS (SELECT 1 FROM engagements e WHERE e.letter_id = l.id
                           AND NOT EXISTS (SELECT 1 FROM filed f WHERE f.id = e.id AND NOT f.held AND f.filed_at <= ?1))
          AND ${EXPORTED_SINCE("l.household_id", "(SELECT MAX(s.signed_at) FROM signatures s WHERE s.letter_id = l.id)")}
        ORDER BY household, l.tax_year`,
    )
    .all(cutoff)
    .map((r) => ({ id: r.id, household: r.household, taxYear: r.tax_year }));
}

// What an archived letter's body says instead of its text.
export const archivedLetterNote = (sha256: string, signedAt: string, archivedAt: string) =>
  `This engagement letter was signed on ${signedAt.slice(0, 10)}. Its full text moved to the practice's offline client record on ${archivedAt.slice(0, 10)}. ` +
  `The signed text's fingerprint (SHA-256) is ${sha256}.`;

export function archiveLetters(db: Database, items: Archivable[]): number {
  let archived = 0;
  for (const item of items) {
    const at = now();
    db.transaction(() => {
      const l = db
        .query<{ household_id: string; body_sha256: string; signed_at: string }, [string]>(
          `SELECT l.household_id, l.body_sha256, (SELECT MAX(signed_at) FROM signatures s WHERE s.letter_id = l.id) AS signed_at
             FROM engagement_letters l WHERE l.id = ? AND l.status = 'signed' AND l.archived_at IS NULL`,
        )
        .get(item.id);
      if (!l) return;
      db.run("UPDATE engagement_letters SET body = ?, archived_at = ? WHERE id = ?", [archivedLetterNote(l.body_sha256, l.signed_at, at), at, item.id]);
      appendEvent(db, { actor: "system", type: "letter.archived", subjectType: "letter", subjectId: item.id, householdId: l.household_id, data: { body_sha256: l.body_sha256 } });
      archived++;
    })();
  }
  return archived;
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
export function purgeDocuments(db: Database, storage: Storage, items: Pick<Purgeable, "id" | "storageKey" | "reason">[]): number {
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
  return purged;
}

export function purge(db: Database, storage: Storage, items: Purgeable[], letters: Archivable[] = []): { purged: number; lettersArchived: number; orphansRemoved: number } {
  const purged = purgeDocuments(db, storage, items);
  const lettersArchived = archiveLetters(db, letters);
  const orphans = findOrphans(db, storage);
  for (const k of orphans) storage.remove(k);
  return { purged, lettersArchived, orphansRemoved: orphans.length };
}
