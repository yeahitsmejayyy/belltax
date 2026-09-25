import { TRPCError } from "@trpc/server";
import { DocumentDeleteInput, DocumentListInput, DocumentReviewInput, DocumentView, now } from "@app/schema";
import { z } from "zod";
import { documentFor, engagementFor } from "../access";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import type { SessionUser } from "../identity";
import { authedProcedure, preparerProcedure, router } from "../trpc";

export type DocumentRow = {
  id: string;
  engagement_id: string | null;
  person_id: string | null;
  request_id: string | null;
  kind: string;
  kind_label: string;
  status: DocumentView["status"];
  reject_reason: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string;
};

export const DOCUMENT_COLUMNS = `d.id, d.engagement_id, d.person_id, d.request_id, d.kind, k.label AS kind_label, d.status,
  d.reject_reason, d.filename, d.mime_type, d.size_bytes, d.created_at, d.uploaded_by`;

export const toDocumentView = (r: DocumentRow, user: SessionUser): DocumentView => ({
  id: r.id,
  engagementId: r.engagement_id,
  personId: r.person_id,
  requestId: r.request_id,
  kind: r.kind,
  kindLabel: r.kind_label,
  status: r.status,
  rejectReason: r.reject_reason,
  filename: r.filename,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  uploadedAt: r.created_at,
  mine: r.uploaded_by === user.id,
});

// Two halves so each uses its own index: by return, and by the people on it (person-level documents).
// As one OR, SQLite scanned every document without a return (ticket 35). The + keeps it off that index.
export const LIST_DOCUMENTS_SQL = `SELECT ${DOCUMENT_COLUMNS}
         FROM documents d JOIN document_kinds k ON k.code = d.kind
        WHERE d.engagement_id = ? AND d.purged_at IS NULL
       UNION ALL
       SELECT ${DOCUMENT_COLUMNS}
         FROM return_people rp JOIN documents d ON d.person_id = rp.person_id JOIN document_kinds k ON k.code = d.kind
        WHERE rp.engagement_id = ? AND +d.engagement_id IS NULL AND d.purged_at IS NULL
        ORDER BY created_at DESC, id DESC`;

export function listDocuments(engagementId: string, user: SessionUser): DocumentView[] {
  const rows = runtime()
    .db.query<DocumentRow, [string, string]>(
      LIST_DOCUMENTS_SQL,
    )
    .all(engagementId, engagementId);
  return rows.map((r) => toDocumentView(r, user));
}

export const documentRouter = router({
  // Everything on this return, plus person-level documents (photo IDs) of the people on it.
  list: authedProcedure
    .input(DocumentListInput)
    .output(z.array(DocumentView))
    .query(({ ctx, input }) => {
      engagementFor(ctx.user, input.engagementId);
      return listDocuments(input.engagementId, ctx.user);
    }),

  // Take back a mistaken upload before it's reviewed. The file is purged; the row stays as a tombstone (R34).
  delete: authedProcedure
    .input(DocumentDeleteInput)
    .output(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db, storage } = runtime();
      const doc = documentFor(ctx.user, input.documentId);
      if (doc.uploaded_by !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You can only remove your own uploads." });
      if (doc.status !== "uploaded") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This document has already been reviewed and can't be removed." });
      }
      const household = doc.engagement_id
        ? db.query<{ h: string }, [string]>("SELECT household_id AS h FROM engagements WHERE id = ?").get(doc.engagement_id)!.h
        : null;
      db.transaction(() => {
        db.run("UPDATE documents SET storage_key = NULL, purged_at = ? WHERE id = ?", [now(), doc.id]);
        appendEvent(db, {
          actor: ctx.user,
          type: "document.deleted",
          subjectType: "document",
          subjectId: doc.id,
          householdId: household,
          engagementId: doc.engagement_id,
        });
      })();
      // Bytes go after the commit: a failed delete leaves a stray file, never a row pointing at nothing.
      if (doc.storage_key) storage.remove(doc.storage_key);
      return { id: doc.id };
    }),

  // Accept a document (its request is fulfilled) or reject it with a reason the client will read.
  review: preparerProcedure
    .input(DocumentReviewInput)
    .output(DocumentView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const doc = documentFor(ctx.user, input.documentId);
      if (doc.status !== "uploaded") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This document has already been reviewed." });
      const at = now();
      const eng = doc.engagement_id
        ? db.query<{ household_id: string }, [string]>("SELECT household_id FROM engagements WHERE id = ?").get(doc.engagement_id)
        : null;
      const requestId = db.query<{ request_id: string | null }, [string]>("SELECT request_id FROM documents WHERE id = ?").get(doc.id)!.request_id;
      db.transaction(() => {
        if (input.decision === "accept") {
          db.run("UPDATE documents SET status = 'accepted', reviewed_at = ? WHERE id = ?", [at, doc.id]);
          if (requestId) db.run("UPDATE requests SET status = 'fulfilled', closed_at = ? WHERE id = ? AND status = 'open'", [at, requestId]);
        } else {
          db.run("UPDATE documents SET status = 'rejected', reject_reason = ?, reviewed_at = ? WHERE id = ?", [input.reason, at, doc.id]);
        }
        appendEvent(db, {
          actor: ctx.user,
          type: input.decision === "accept" ? "document.accepted" : "document.rejected",
          subjectType: "document",
          subjectId: doc.id,
          householdId: eng?.household_id ?? null,
          engagementId: doc.engagement_id,
          reason: input.decision === "reject" ? input.reason : null,
          data: { request_id: requestId },
        });
      })();
      const row = db.query<DocumentRow, [string]>(`SELECT ${DOCUMENT_COLUMNS} FROM documents d JOIN document_kinds k ON k.code = d.kind WHERE d.id = ?`).get(doc.id)!;
      return toDocumentView(row, ctx.user);
    }),
});
