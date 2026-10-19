import { TRPCError } from "@trpc/server";
import { now, RequestAnswerInput, RequestCancelInput, RequestCreateInput, RequestListInput, RequestView } from "@app/schema";
import { z } from "zod";
import { engagementFor } from "../access";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import type { SessionUser } from "../identity";
import { authedProcedure, preparerProcedure, router } from "../trpc";
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
  person_name: string | null;
  created_at: string;
};

export const LATEST_DOCUMENT_SQL = `SELECT ${DOCUMENT_COLUMNS} FROM documents d JOIN document_kinds k ON k.code = d.kind
  WHERE d.request_id = ? AND d.purged_at IS NULL ORDER BY d.created_at DESC, d.id DESC LIMIT 1`;

export function listRequests(engagementId: string, user: SessionUser): RequestView[] {
  const { db } = runtime();
  const rows = db
    .query<Row, [string]>(
      `SELECT r.id, r.engagement_id, r.kind, r.document_kind, r.title, r.note, r.response, r.status, r.person_id, r.created_at,
              (SELECT p.first_name FROM people p WHERE p.id = r.person_id) AS person_name
         FROM requests r WHERE r.engagement_id = ?
        ORDER BY (status = 'open') DESC, created_at, id`,
    )
    .all(engagementId);
  const latest = db.query<DocumentRow, [string]>(LATEST_DOCUMENT_SQL);
  return rows.map((r) => {
    const doc = latest.get(r.id);
    return {
      id: r.id,
      kind: r.kind,
      documentKind: r.document_kind,
      title: r.title,
      note: r.note,
      // Send-only (ticket 52): a client sees that a question was answered, not their answer again.
      response: user.role === "client" && r.status === "fulfilled" ? null : r.response,
      status: r.status,
      personId: r.person_id,
      personName: r.person_name,
      createdAt: r.created_at,
      latestDocument: doc ? toDocumentView(doc, user) : null,
    };
  });
}

// What the preparer is asking this return's client for: documents to upload and questions to answer.
export const requestRouter = router({
  // The document types a request can ask for (admin 22-dialogs-and-sheets-sheet-request), active ones only.
  documentKinds: preparerProcedure
    .output(z.array(z.object({ code: z.string(), formName: z.string(), label: z.string(), category: z.string() })))
    .query(() =>
      runtime()
        .db.query<{ code: string; form_name: string; label: string; category: string }, []>("SELECT code, form_name, label, category FROM document_kinds WHERE active = 1 ORDER BY category, label")
        .all()
        .map((k) => ({ code: k.code, formName: k.form_name, label: k.label, category: k.category })),
    ),

  list: authedProcedure
    .input(RequestListInput)
    .output(z.array(RequestView))
    .query(({ ctx, input }) => {
      engagementFor(ctx.user, input.engagementId);
      return listRequests(input.engagementId, ctx.user);
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

  // Ask the client for a document or an answer. The client sees it on their to-do list.
  create: preparerProcedure
    .input(RequestCreateInput)
    .output(RequestView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const eng = engagementFor(ctx.user, input.engagementId);
      if (input.personId && !db.query("SELECT 1 FROM return_people WHERE engagement_id = ? AND person_id = ?").get(eng.id, input.personId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That person isn't on this return." });
      }
      let title = input.title;
      if (input.kind === "document") {
        const kind = db.query<{ form_name: string; label: string }, [string]>("SELECT form_name, label FROM document_kinds WHERE code = ? AND active = 1").get(input.documentKind);
        if (!kind) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown document kind." });
        if (input.sourceId && !db.query("SELECT 1 FROM return_sources WHERE engagement_id = ? AND source_id = ?").get(eng.id, input.sourceId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That source isn't on this return." });
        }
        title ??= `Upload your ${kind.form_name}`;
      }
      const id = Bun.randomUUIDv7();
      db.transaction(() => {
        db.run(
          `INSERT INTO requests (id, engagement_id, person_id, source_id, kind, document_kind, title, note, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
          [
            id, eng.id, input.personId ?? null, input.kind === "document" ? input.sourceId ?? null : null, input.kind,
            input.kind === "document" ? input.documentKind : null, title!, input.note ?? null, ctx.user.id, now(),
          ],
        );
        appendEvent(db, {
          actor: ctx.user,
          type: "request.created",
          subjectType: "request",
          subjectId: id,
          householdId: eng.household_id,
          engagementId: eng.id,
          data: { kind: input.kind, document_kind: input.kind === "document" ? input.documentKind : null },
        });
      })();
      return listRequests(eng.id, ctx.user).find((r) => r.id === id)!;
    }),

  // Withdraw a request the client no longer needs to act on.
  cancel: preparerProcedure
    .input(RequestCancelInput)
    .output(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const req = db.query<{ engagement_id: string; status: string }, [string]>("SELECT engagement_id, status FROM requests WHERE id = ?").get(input.requestId);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      const eng = engagementFor(ctx.user, req.engagement_id);
      if (req.status !== "open") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This request is already closed." });
      db.transaction(() => {
        db.run("UPDATE requests SET status = 'cancelled', closed_at = ? WHERE id = ?", [now(), input.requestId]);
        appendEvent(db, {
          actor: ctx.user,
          type: "request.cancelled",
          subjectType: "request",
          subjectId: input.requestId,
          householdId: eng.household_id,
          engagementId: eng.id,
          reason: input.reason,
        });
      })();
      return { id: input.requestId };
    }),
});
