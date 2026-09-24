import { TRPCError } from "@trpc/server";
import {
  AdvanceStageInput,
  EngagementDetail,
  EngagementDetailInput,
  EngagementList,
  EngagementListInput,
  MyEngagement,
  now,
  SetFilingStatusInput,
  Stage,
} from "@app/schema";
import { z } from "zod";
import { engagementFor } from "../access";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { blockersFor, nextStage } from "../gates";
import { listDocuments } from "./document";
import { readIntake } from "./intake";
import { listRequests } from "./request";
import { authedProcedure, preparerProcedure, router } from "../trpc";

const DAY = 86_400_000;

type Row = {
  engagement_id: string;
  household_id: string;
  household_name: string;
  tax_year: number;
  kind: "original" | "amended";
  filing_status: EngagementList["rows"][number]["filingStatus"];
  stage: Stage;
  stage_changed_at: string;
  filers: string | null;
  open_requests: number;
  balance_cents: number;
  complexity: "simple" | "involved";
};

export const engagementRouter = router({
  // The preparer's pipeline for one tax year: board columns, counts, and every return in them.
  list: preparerProcedure
    .input(EngagementListInput)
    .output(EngagementList)
    .query(({ input }) => {
      const { db } = runtime();
      const years = db
        .query<{ tax_year: number }, []>("SELECT DISTINCT tax_year FROM engagements ORDER BY tax_year DESC")
        .all()
        .map((r) => r.tax_year);
      const taxYear = input?.taxYear ?? years[0] ?? null;
      const counts = Object.fromEntries(Stage.options.map((s) => [s, 0])) as Record<Stage, number>;
      if (taxYear === null) return { taxYear, years, counts, rows: [] };

      const search = input?.search?.toLowerCase() ?? "";
      const all = db
        .query<Row, [number, string, string, string]>(
          `SELECT p.*, c.label AS complexity
             FROM pipeline_rows p
             JOIN return_complexity c ON c.engagement_id = p.engagement_id
            WHERE p.tax_year = ?
              AND (? = '' OR instr(lower(p.household_name), ?) > 0 OR instr(lower(coalesce(p.filers, '')), ?) > 0)`,
        )
        .all(taxYear, search, search, search);

      for (const r of all) counts[r.stage]++;
      const now = Date.now();
      const rows = all
        .filter((r) => !input?.stage || r.stage === input.stage)
        .sort(
          (a, b) =>
            Stage.options.indexOf(a.stage) - Stage.options.indexOf(b.stage) || a.stage_changed_at.localeCompare(b.stage_changed_at),
        )
        .map((r) => ({
          engagementId: r.engagement_id,
          householdId: r.household_id,
          householdName: r.household_name,
          taxYear: r.tax_year,
          kind: r.kind,
          filingStatus: r.filing_status,
          stage: r.stage,
          stageChangedAt: r.stage_changed_at,
          daysInStage: Math.max(0, Math.floor((now - Date.parse(r.stage_changed_at)) / DAY)),
          filers: r.filers ? r.filers.split(" & ") : [],
          openRequests: r.open_requests,
          balanceCents: r.balance_cents,
          complexity: r.complexity,
        }));
      return { taxYear, years, counts, rows };
    }),

  // The signed-in client's own returns, newest season first. Filer access wins over a grant.
  mine: authedProcedure.output(z.array(MyEngagement)).query(({ ctx }) => {
    const rows = runtime()
      .db.query<Record<string, string | number | null>, [string]>(
        `SELECT p.engagement_id, p.household_name, p.tax_year, p.kind, p.filing_status, p.stage, p.open_requests, p.balance_cents,
                MIN(ca.via) AS via
           FROM client_access ca JOIN pipeline_rows p ON p.engagement_id = ca.engagement_id
          WHERE ca.user_id = ?
          GROUP BY p.engagement_id
          ORDER BY p.tax_year DESC, p.kind, p.household_name`,
      )
      .all(ctx.user.id);
    return rows.map((r) => ({
      engagementId: r.engagement_id as string,
      householdName: r.household_name as string,
      taxYear: r.tax_year as number,
      kind: r.kind as MyEngagement["kind"],
      filingStatus: r.filing_status as MyEngagement["filingStatus"],
      stage: r.stage as MyEngagement["stage"],
      via: r.via as MyEngagement["via"],
      openRequests: r.open_requests as number,
      balanceCents: r.balance_cents as number,
    }));
  }),

  // One return in full: everything the preparer's detail screen shows, plus why it can't move yet.
  detail: preparerProcedure
    .input(EngagementDetailInput)
    .output(EngagementDetail)
    .query(({ ctx, input }) => {
      const { db } = runtime();
      engagementFor(ctx.user, input.engagementId);
      const e = db
        .query<
          { id: string; household_id: string; display_name: string; tax_year: number; kind: "original" | "amended"; amends_id: string | null;
            filing_status: EngagementDetail["filingStatus"]; stage: Stage; stage_changed_at: string; letter_id: string | null },
          [string]
        >(
          `SELECT e.*, h.display_name FROM engagements e JOIN households h ON h.id = e.household_id WHERE e.id = ?`,
        )
        .get(input.engagementId)!;
      const next = nextStage(e.stage);

      const people = db
        .query<Record<string, string | number | null>, [string]>(
          `SELECT p.id, p.first_name, p.last_name, rp.role, rp.relationship, rp.months_lived_with, p.date_of_birth, p.ssn_last4,
                  EXISTS (SELECT 1 FROM users u WHERE u.person_id = p.id) AS has_login
             FROM return_people rp JOIN people p ON p.id = rp.person_id
            WHERE rp.engagement_id = ?
            ORDER BY CASE rp.role WHEN 'primary' THEN 0 WHEN 'spouse' THEN 1 ELSE 2 END, p.date_of_birth`,
        )
        .all(e.id)
        .map((r) => ({
          personId: r.id as string,
          firstName: r.first_name as string,
          lastName: r.last_name as string,
          role: r.role as "primary" | "spouse" | "dependent",
          relationship: r.relationship as string | null,
          monthsLivedWith: r.months_lived_with as number | null,
          dateOfBirth: r.date_of_birth as string | null,
          ssnLast4: r.ssn_last4 as string | null,
          hasLogin: r.has_login === 1,
        }));

      const sources = db
        .query<{ id: string; kind: EngagementDetail["sources"][number]["kind"]; label: string }, [string]>(
          "SELECT s.id, s.kind, s.label FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = ? ORDER BY s.kind, s.label",
        )
        .all(e.id);

      let letter: EngagementDetail["letter"] = null;
      if (e.letter_id) {
        const l = db.query<{ id: string; status: "draft" | "sent" | "signed" | "void"; sent_at: string | null }, [string]>(
          "SELECT id, status, sent_at FROM engagement_letters WHERE id = ?",
        ).get(e.letter_id)!;
        const signers = db
          .query<{ person_id: string; name: string; signed_at: string | null }, [string, string]>(
            `SELECT p.id AS person_id, p.first_name || ' ' || p.last_name AS name, s.signed_at
               FROM return_people rp JOIN people p ON p.id = rp.person_id
               LEFT JOIN signatures s ON s.letter_id = ? AND s.person_id = p.id
              WHERE rp.engagement_id = ? AND rp.role IN ('primary', 'spouse')
              ORDER BY rp.role DESC`,
          )
          .all(l.id, e.id)
          .map((r) => ({ personId: r.person_id, name: r.name, signedAt: r.signed_at }));
        letter = { id: l.id, status: l.status, sentAt: l.sent_at, signers };
      }

      const invoices = db
        .query<Record<string, string | number | null>, [string]>(
          `SELECT b.invoice_id, i.number, b.status, b.settlement, b.total_cents, b.paid_cents, b.balance_cents, i.due_on
             FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id
            WHERE b.engagement_id = ? ORDER BY i.created_at`,
        )
        .all(e.id)
        .map((r) => ({
          id: r.invoice_id as string,
          number: r.number as string,
          status: r.status as "draft" | "issued" | "void",
          settlement: r.settlement as EngagementDetail["invoices"][number]["settlement"],
          totalCents: r.total_cents as number,
          paidCents: r.paid_cents as number,
          balanceCents: r.balance_cents as number,
          dueOn: r.due_on as string | null,
          lines: db
            .query<{ description: string; quantity: number; unit_amount_cents: number }, [string]>(
              "SELECT description, quantity, unit_amount_cents FROM invoice_lines WHERE invoice_id = ? ORDER BY position",
            )
            .all(r.invoice_id as string)
            .map((l) => ({ description: l.description, quantity: l.quantity, unitAmountCents: l.unit_amount_cents })),
          payments: db
            .query<{ id: string; amount_cents: number; status: "pending" | "succeeded" | "failed" | "refunded"; failure_message: string | null; created_at: string }, [string]>(
              "SELECT id, amount_cents, status, failure_message, created_at FROM payments WHERE invoice_id = ? ORDER BY created_at DESC",
            )
            .all(r.invoice_id as string)
            .map((p) => ({ id: p.id, amountCents: p.amount_cents, status: p.status, failureMessage: p.failure_message, createdAt: p.created_at })),
        }));

      // This return's events, plus household-level ones (grants, letters) that don't name a return.
      const timeline = db
        .query<Record<string, string | null>, [string, string]>(
          `SELECT ev.id, ev.occurred_at, ev.type, ev.actor_kind, ev.subject_type, ev.subject_id, ev.reason,
                  CASE ev.actor_kind
                    WHEN 'preparer' THEN 'Preparer'
                    WHEN 'stripe' THEN 'Stripe'
                    WHEN 'system' THEN 'System'
                    ELSE COALESCE((SELECT p.first_name || ' ' || p.last_name FROM users u JOIN people p ON p.id = u.person_id WHERE u.id = ev.actor_user_id), 'Client')
                  END AS actor_name
             FROM events ev
            WHERE ev.engagement_id = ? OR (ev.engagement_id IS NULL AND ev.household_id = ?)
            ORDER BY ev.occurred_at DESC, ev.id DESC
            LIMIT 200`,
        )
        .all(e.id, e.household_id)
        .map((r) => ({
          id: r.id!,
          occurredAt: r.occurred_at!,
          type: r.type!,
          actorKind: r.actor_kind as "client" | "preparer" | "system" | "stripe",
          actorName: r.actor_name!,
          subjectType: r.subject_type!,
          subjectId: r.subject_id!,
          reason: r.reason ?? null,
        }));

      return {
        engagementId: e.id,
        household: { id: e.household_id, displayName: e.display_name },
        taxYear: e.tax_year,
        kind: e.kind,
        amendsId: e.amends_id,
        filingStatus: e.filing_status,
        stage: e.stage,
        stageChangedAt: e.stage_changed_at,
        nextStage: next,
        blockers: next ? blockersFor(db, e.id, next) : [],
        people,
        sources,
        intake: readIntake(e.id),
        requests: listRequests(e.id, ctx.user),
        documents: listDocuments(e.id, ctx.user),
        letter,
        invoices,
        timeline,
      };
    }),

  // Move a return. Forward: exactly one stage, through its gate. Backward: any earlier stage, with a reason.
  advanceStage: preparerProcedure
    .input(AdvanceStageInput)
    .output(z.object({ stage: Stage, stageChangedAt: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const e = engagementFor(ctx.user, input.engagementId);
      const from = e.stage as Stage;
      const delta = Stage.options.indexOf(input.to) - Stage.options.indexOf(from);
      if (delta === 0) throw new TRPCError({ code: "BAD_REQUEST", message: `This return is already in ${from}.` });
      if (delta > 1) throw new TRPCError({ code: "BAD_REQUEST", message: `Move one stage at a time: next is ${nextStage(from)}.` });
      if (delta < 0 && !input.reason) throw new TRPCError({ code: "BAD_REQUEST", message: "Say why the return is moving back." });
      if (delta === 1) {
        const blockers = blockersFor(db, e.id, input.to);
        if (blockers.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: blockers.join(" ") });
      }
      const at = now();
      db.transaction(() => {
        db.run("UPDATE engagements SET stage = ?, stage_changed_at = ? WHERE id = ?", [input.to, at, e.id]);
        appendEvent(db, {
          actor: ctx.user,
          type: "engagement.stage_changed",
          subjectType: "engagement",
          subjectId: e.id,
          householdId: e.household_id,
          engagementId: e.id,
          reason: input.reason ?? null,
          data: { from, to: input.to },
        });
      })();
      return { stage: input.to, stageChangedAt: at };
    }),

  setFilingStatus: preparerProcedure
    .input(SetFilingStatusInput)
    .output(z.object({ filingStatus: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const e = engagementFor(ctx.user, input.engagementId);
      db.transaction(() => {
        db.run("UPDATE engagements SET filing_status = ? WHERE id = ?", [input.filingStatus, e.id]);
        appendEvent(db, {
          actor: ctx.user,
          type: "engagement.filing_status_set",
          subjectType: "engagement",
          subjectId: e.id,
          householdId: e.household_id,
          engagementId: e.id,
          data: { filing_status: input.filingStatus },
        });
      })();
      return { filingStatus: input.filingStatus };
    }),
});
