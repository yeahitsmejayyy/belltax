import { TRPCError } from "@trpc/server";
import { runtime } from "./db/client";
import type { SessionUser } from "./identity";

// The one place that decides what a signed-in user may open (rule R2).
// Denials are NOT_FOUND, never FORBIDDEN: a client must not learn that someone else's return exists.

const notFound = (what: string) => new TRPCError({ code: "NOT_FOUND", message: `${what} not found.` });

export type EngagementRef = { id: string; household_id: string; tax_year: number; stage: string };

export function engagementFor(user: SessionUser, engagementId: string): EngagementRef {
  const { db } = runtime();
  const row = db
    .query<EngagementRef, [string]>("SELECT id, household_id, tax_year, stage FROM engagements WHERE id = ?")
    .get(engagementId);
  if (!row) throw notFound("Return");
  if (user.role === "preparer") return row;
  const allowed = db
    .query<{ ok: number }, [string, string]>("SELECT 1 AS ok FROM client_access WHERE user_id = ? AND engagement_id = ? LIMIT 1")
    .get(user.id, engagementId);
  if (!allowed) throw notFound("Return");
  return row;
}

export type DocumentRef = {
  id: string;
  engagement_id: string | null;
  person_id: string | null;
  status: string;
  uploaded_by: string;
  storage_key: string | null;
  filename: string;
  mime_type: string;
};

export function documentFor(user: SessionUser, documentId: string): DocumentRef {
  const { db } = runtime();
  const doc = db
    .query<DocumentRef, [string]>(
      "SELECT id, engagement_id, person_id, status, uploaded_by, storage_key, filename, mime_type FROM documents WHERE id = ? AND purged_at IS NULL",
    )
    .get(documentId);
  if (!doc) throw notFound("Document");
  if (user.role === "preparer") return doc;
  if (doc.engagement_id) {
    engagementFor(user, doc.engagement_id); // throws NOT_FOUND
    return doc;
  }
  // A person-level document (photo ID): the person themself, or someone granted their current household.
  const allowed = db
    .query<{ ok: number }, [string, string, string]>(
      `SELECT 1 AS ok FROM people p
        WHERE p.id = ?
          AND (p.id = ? OR EXISTS (SELECT 1 FROM household_access ha
                                   WHERE ha.user_id = ? AND ha.household_id = p.household_id AND ha.revoked_at IS NULL))`,
    )
    .get(doc.person_id!, user.personId ?? "", user.id);
  if (!allowed) throw notFound("Document");
  return doc;
}
