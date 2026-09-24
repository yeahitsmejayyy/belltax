import { TRPCError } from "@trpc/server";
import { now, RequestAnswerInput, RequestListInput, RequestView } from "@app/schema";
import { z } from "zod";
import { engagementFor } from "../access";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { authedProcedure, router } from "../trpc";
import { DOCUMENT_COLUMNS, toDocumentView, type DocumentRow } from "./document";

type Row = {
  id: string;
  engagement_id: string;
  kind: RequestView["kind"];
  document_kind: string | null;
  title: string;
  note: string | null;
  response: string | null;
  status: RequestView["status"];
  person_id: string | null;
  created_at: string;
};

// What the preparer is asking this return's client for: documents to upload and questions to answer.
export const requestRouter = router({
  list: authedProcedure
    .input(RequestListInput)
    .output(z.array(RequestView))
    .query(({ ctx, input }) => {
      const { db } = runtime();
      engagementFor(ctx.user, input.engagementId);
      const rows = db
        .query<Row, [string]>(
          `SELECT id, engagement_id, kind, document_kind, title, note, response, status, person_id, created_at
             FROM requests WHERE engagement_id = ?
            ORDER BY (status = 'open') DESC, created_at, id`,
        )
        .all(input.engagementId);
      const latest = db.query<DocumentRow, [string]>(
        `SELECT ${DOCUMENT_COLUMNS} FROM documents d JOIN document_kinds k ON k.code = d.kind
          WHERE d.request_id = ? AND d.purged_at IS NULL ORDER BY d.created_at DESC, d.id DESC LIMIT 1`,
      );
      return rows.map((r) => {
        const doc = latest.get(r.id);
        return {
          id: r.id,
          kind: r.kind,
          documentKind: r.document_kind,
          title: r.title,
          note: r.note,
          response: r.response,
          status: r.status,
          personId: r.person_id,
          createdAt: r.created_at,
          latestDocument: doc ? toDocumentView(doc, ctx.user) : null,
        };
      });
    }),

  // Answer a question from the preparer. Document requests are fulfilled by uploading instead.
  answer: authedProcedure
    .input(RequestAnswerInput)
    .output(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const req = db
        .query<{ engagement_id: string; kind: string; status: string }, [string]>("SELECT engagement_id, kind, status FROM requests WHERE id = ?")
        .get(input.requestId);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      const eng = engagementFor(ctx.user, req.engagement_id);
      if (req.kind !== "question") throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a document to fulfil this request." });
      if (req.status !== "open") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This question is already closed." });
      const at = now();
      db.transaction(() => {
        db.run("UPDATE requests SET response = ?, responded_at = ?, status = 'fulfilled', closed_at = ? WHERE id = ?", [input.response, at, at, input.requestId]);
        appendEvent(db, {
          actor: ctx.user,
          type: "request.answered",
          subjectType: "request",
          subjectId: input.requestId,
          householdId: eng.household_id,
          engagementId: eng.id,
        });
      })();
      return { id: input.requestId };
    }),
});
