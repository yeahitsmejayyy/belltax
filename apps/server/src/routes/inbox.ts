import { TRPCError } from "@trpc/server";
import { ActivityListInput, ActivityPage, Inbox, InboxListInput, now, RequestAcknowledgeInput, type InboxItem, type InboxKind } from "@app/schema";
import { z } from "zod";
import { runtime } from "../db/client";
import { ACTOR_NAME_SQL, appendEvent, VIEW_TYPE_SQL } from "../events";
import { preparerProcedure, router } from "../trpc";

// The admin's Inbox and Activity screens. Every inbox item is derived from current state, so it clears
// itself when the underlying thing is dealt with: review the upload, acknowledge the answer, move the
// return, settle the payment. Nothing to "mark as read" except answers, which have acknowledged_at.

const KINDS: InboxKind[] = ["document_review", "question_answered", "letter_signed", "payment_failed", "stale"];
const DAY = 86_400_000;

type Row = { subject_id: string; at: string; engagement_id: string; household: string; tax_year: number; who: string; detail: string | null };

export const inboxRouter = router({
  list: preparerProcedure
    .input(InboxListInput)
    .output(Inbox)
    .query(({ input }) => {
      const { db } = runtime();
      const years = db.query<{ y: number }, []>("SELECT DISTINCT tax_year AS y FROM engagements ORDER BY y DESC").all();
      const taxYear = input?.taxYear ?? years[0]?.y ?? null;
      const counts = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<InboxKind, number>;
      if (taxYear === null) return { taxYear, items: [], counts, total: 0 };
      const staleBefore = new Date(Date.now() - (input?.staleDays ?? 7) * DAY).toISOString();

      const RETURN = "JOIN engagements e ON e.id = X.engagement_id JOIN households h ON h.id = e.household_id";
      const ret = (sql: string) => sql.replaceAll("X.engagement_id", "d.engagement_id");
      const q = (sql: string, ...params: (string | number)[]) => db.query<Row, (string | number)[]>(sql).all(...params);

      const sources: [InboxKind, Row[], InboxItem["action"], (r: Row) => string][] = [
        [
          "document_review",
          q(
            ret(`SELECT d.id AS subject_id, d.created_at AS at, d.engagement_id, h.display_name AS household, e.tax_year,
                        COALESCE((SELECT p.first_name || ' ' || p.last_name FROM users u JOIN people p ON p.id = u.person_id WHERE u.id = d.uploaded_by), 'Preparer') AS who,
                        (SELECT k.label FROM document_kinds k WHERE k.code = d.kind) AS detail
                   FROM documents d ${RETURN}
                  WHERE d.status = 'uploaded' AND d.purged_at IS NULL AND e.tax_year = ?`),
            taxYear,
          ),
          "review_document",
          (r) => `${r.who} uploaded ${r.detail?.toLowerCase() ?? "a document"}.`,
        ],
        [
          "question_answered",
          q(
            `SELECT r.id AS subject_id, r.responded_at AS at, r.engagement_id, h.display_name AS household, e.tax_year,
                    COALESCE((SELECT ev.actor_name FROM (SELECT ${ACTOR_NAME_SQL} AS actor_name, ev.occurred_at FROM events ev
                               WHERE ev.type = 'request.answered' AND ev.subject_id = r.id ORDER BY ev.occurred_at DESC LIMIT 1) ev), 'The client') AS who,
                    r.title AS detail
               FROM requests r JOIN engagements e ON e.id = r.engagement_id JOIN households h ON h.id = e.household_id
              WHERE r.kind = 'question' AND r.response IS NOT NULL AND r.acknowledged_at IS NULL AND e.tax_year = ?`,
            taxYear,
          ),
          "acknowledge_answer",
          (r) => `${r.who} answered "${r.detail}".`,
        ],
        [
          "letter_signed",
          q(
            `SELECT e.id AS subject_id, (SELECT MAX(s.signed_at) FROM signatures s WHERE s.letter_id = l.id) AS at, e.id AS engagement_id,
                    h.display_name AS household, e.tax_year, h.display_name AS who, NULL AS detail
               FROM engagements e JOIN engagement_letters l ON l.id = e.letter_id AND l.status = 'signed'
               JOIN households h ON h.id = e.household_id
              WHERE e.stage = 'ready' AND e.tax_year = ?`,
            taxYear,
          ),
          "advance_stage",
          (r) => `${r.household} signed the engagement letter. The return can move to preparing.`,
        ],
        [
          "payment_failed",
          q(
            `SELECT p.id AS subject_id, p.created_at AS at, i.engagement_id, h.display_name AS household, e.tax_year,
                    h.display_name AS who, p.failure_message AS detail
               FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id
               JOIN payments p ON p.id = (SELECT p2.id FROM payments p2 WHERE p2.invoice_id = i.id ORDER BY p2.created_at DESC, p2.id DESC LIMIT 1)
               JOIN engagements e ON e.id = i.engagement_id JOIN households h ON h.id = e.household_id
              WHERE b.settlement = 'failed_last_attempt' AND e.tax_year = ?`,
            taxYear,
          ),
          "follow_up_payment",
          (r) => `${r.household}'s payment failed${r.detail ? `: ${r.detail}` : "."}`,
        ],
        [
          "stale",
          q(
            `SELECT e.id AS subject_id, e.stage_changed_at AS at, e.id AS engagement_id, h.display_name AS household, e.tax_year,
                    h.display_name AS who, e.stage AS detail
               FROM engagements e JOIN households h ON h.id = e.household_id
              WHERE e.stage NOT IN ('filed', 'complete') AND e.stage_changed_at < ? AND e.tax_year = ?`,
            staleBefore,
            taxYear,
          ),
          "open_return",
          (r) => `${r.household} has been in ${r.detail} for ${Math.floor((Date.now() - Date.parse(r.at)) / DAY)} days.`,
        ],
      ];

      const items: InboxItem[] = sources.flatMap(([kind, rows, action, summary]) =>
        rows.map((r) => ({
          id: `${kind}:${r.subject_id}`,
          kind,
          at: r.at,
          engagementId: r.engagement_id,
          householdName: r.household,
          taxYear: r.tax_year,
          who: r.who,
          summary: summary(r),
          action,
          subjectId: r.subject_id,
        })),
      );
      for (const i of items) counts[i.kind]++;
      items.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
      return { taxYear, items, counts, total: items.length };
    }),
});

// The preparer has read a client's answer: it leaves the Inbox.
export const acknowledgeProcedure = preparerProcedure
  .input(RequestAcknowledgeInput)
  .output(z.object({ id: z.string() }))
  .mutation(({ ctx, input }) => {
    const { db } = runtime();
    const r = db
      .query<{ engagement_id: string; household_id: string; responded_at: string | null; acknowledged_at: string | null }, [string]>(
        "SELECT r.engagement_id, e.household_id, r.responded_at, r.acknowledged_at FROM requests r JOIN engagements e ON e.id = r.engagement_id WHERE r.id = ?",
      )
      .get(input.requestId);
    if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
    if (!r.responded_at) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "There's no answer to acknowledge yet." });
    if (r.acknowledged_at) return { id: input.requestId };
    db.transaction(() => {
      db.run("UPDATE requests SET acknowledged_at = ? WHERE id = ?", [now(), input.requestId]);
      appendEvent(db, { actor: ctx.user, type: "request.acknowledged", subjectType: "request", subjectId: input.requestId, householdId: r.household_id, engagementId: r.engagement_id });
    })();
    return { id: input.requestId };
  });

export const activityRouter = router({
  // The whole audit trail, newest first, filtered and paged by (occurred_at, id) so pages stay stable
  // while new events arrive.
  list: preparerProcedure
    .input(ActivityListInput)
    .output(ActivityPage)
    .query(({ input }) => {
      const { db } = runtime();
      const where: string[] = [];
      const params: (string | number)[] = [];
      const add = (sql: string, ...p: (string | number)[]) => {
        where.push(sql);
        params.push(...p);
      };
      if (input?.householdId) add("ev.household_id = ?", input.householdId);
      if (input?.engagementId) add("ev.engagement_id = ?", input.engagementId);
      if (input?.actorKind) add("ev.actor_kind = ?", input.actorKind);
      if (input?.typePrefix) add("substr(ev.type, 1, length(?)) = ?", input.typePrefix, input.typePrefix);
      if (input?.views === "hide") add(`NOT ${VIEW_TYPE_SQL}`);
      if (input?.views === "only") add(VIEW_TYPE_SQL);
      if (input?.from) add("ev.occurred_at >= ?", input.from);
      if (input?.to) add("ev.occurred_at < ?", input.to);
      if (input?.cursor) add("(ev.occurred_at, ev.id) < (?, ?)", input.cursor.occurredAt, input.cursor.id);
      const limit = input?.limit ?? 50;
      const rows = db
        .query<Record<string, string | null>, (string | number)[]>(
          `SELECT ev.id, ev.occurred_at, ev.type, ev.actor_kind, ev.subject_type, ev.subject_id, ev.reason,
                  ev.household_id, h.display_name AS household_name, ev.engagement_id, ${ACTOR_NAME_SQL} AS actor_name
             FROM events ev LEFT JOIN households h ON h.id = ev.household_id
            ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
            ORDER BY ev.occurred_at DESC, ev.id DESC
            LIMIT ?`,
        )
        .all(...params, limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: page.map((r) => ({
          id: r.id!,
          occurredAt: r.occurred_at!,
          type: r.type!,
          actorKind: r.actor_kind as "client" | "preparer" | "system" | "stripe",
          actorName: r.actor_name!,
          subjectType: r.subject_type!,
          subjectId: r.subject_id!,
          reason: r.reason ?? null,
          householdId: r.household_id ?? null,
          householdName: r.household_name ?? null,
          engagementId: r.engagement_id ?? null,
        })),
        next: rows.length > limit && last ? { occurredAt: last.occurred_at!, id: last.id! } : null,
      };
    }),
});
