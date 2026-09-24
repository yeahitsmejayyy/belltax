import { TRPCError } from "@trpc/server";
import {
  InvoiceCreateInput,
  InvoiceListInput,
  InvoiceRefInput,
  InvoiceSuggestInput,
  InvoiceSummary,
  InvoiceUpdateLinesInput,
  InvoiceVoidInput,
  now,
  PaymentRecordInput,
} from "@app/schema";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import { engagementFor, type EngagementRef } from "../access";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import type { SessionUser } from "../identity";
import { nextInvoiceNumber, suggestedLinesFor, type Line } from "../money/pricing";
import { authedProcedure, preparerProcedure, router } from "../trpc";

// Invoices: lines are facts, the balance is derived (invoice_balances, R28), lines freeze once issued
// (R27). Money arrives by hand today; Stripe (ticket 09) adds a second path into the same payments table.

const Line = z.object({ description: z.string(), quantity: z.int(), unitAmountCents: z.int() });

// Clients never see drafts: an invoice exists for them once it's issued.
export function listInvoices(engagementId: string, user: SessionUser): InvoiceSummary[] {
  const { db } = runtime();
  return db
    .query<Record<string, string | number | null>, [string, number]>(
      `SELECT b.invoice_id, i.number, b.status, b.settlement, b.total_cents, b.paid_cents, b.balance_cents, i.due_on
         FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id
        WHERE b.engagement_id = ? AND (? OR b.status <> 'draft')
        ORDER BY i.created_at, i.id`,
    )
    .all(engagementId, user.role === "preparer" ? 1 : 0)
    .map((r) => ({
      id: r.invoice_id as string,
      number: r.number as string,
      status: r.status as InvoiceSummary["status"],
      settlement: r.settlement as InvoiceSummary["settlement"],
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
        .query<Record<string, string | number | null>, [string]>(
          `SELECT id, amount_cents, status, provider, method, received_on, note, failure_message, created_at
             FROM payments WHERE invoice_id = ? ORDER BY created_at DESC, id DESC`,
        )
        .all(r.invoice_id as string)
        .map((p) => ({
          id: p.id as string,
          amountCents: p.amount_cents as number,
          status: p.status as InvoiceSummary["payments"][number]["status"],
          provider: p.provider as InvoiceSummary["payments"][number]["provider"],
          method: p.method as InvoiceSummary["payments"][number]["method"],
          receivedOn: p.received_on as string | null,
          note: p.note as string | null,
          failureMessage: p.failure_message as string | null,
          createdAt: p.created_at as string,
        })),
    }));
}

type InvoiceRef = { id: string; engagement_id: string; status: "draft" | "issued" | "void" };

function invoiceFor(user: SessionUser, invoiceId: string): InvoiceRef & { eng: EngagementRef } {
  const inv = runtime().db.query<InvoiceRef, [string]>("SELECT id, engagement_id, status FROM invoices WHERE id = ?").get(invoiceId);
  if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
  const eng = engagementFor(user, inv.engagement_id);
  if (user.role !== "preparer" && inv.status === "draft") throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
  return { ...inv, eng };
}

function writeLines(db: Database, invoiceId: string, lines: Line[]) {
  db.run("DELETE FROM invoice_lines WHERE invoice_id = ?", [invoiceId]);
  lines.forEach((l, i) =>
    db.run("INSERT INTO invoice_lines (id, invoice_id, position, description, quantity, unit_amount_cents) VALUES (?, ?, ?, ?, ?, ?)", [
      Bun.randomUUIDv7(), invoiceId, i + 1, l.description, l.quantity, l.unitAmountCents,
    ]),
  );
}

const summaryOf = (invoiceId: string, engagementId: string, user: SessionUser) => listInvoices(engagementId, user).find((i) => i.id === invoiceId)!;

export const invoiceRouter = router({
  // A client's view of what they owe on a return; the preparer also sees drafts.
  list: authedProcedure
    .input(InvoiceListInput)
    .output(z.array(InvoiceSummary))
    .query(({ ctx, input }) => {
      engagementFor(ctx.user, input.engagementId);
      return listInvoices(input.engagementId, ctx.user);
    }),

  // The fee schedule applied to what's on this return. A starting point the preparer edits.
  suggest: preparerProcedure
    .input(InvoiceSuggestInput)
    .output(z.array(Line))
    .query(({ ctx, input }) => {
      engagementFor(ctx.user, input.engagementId);
      return suggestedLinesFor(runtime().db, input.engagementId);
    }),

  create: preparerProcedure
    .input(InvoiceCreateInput)
    .output(InvoiceSummary)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const eng = engagementFor(ctx.user, input.engagementId);
      const lines = input.lines ?? suggestedLinesFor(db, eng.id);
      const id = Bun.randomUUIDv7();
      db.transaction(() => {
        const number = nextInvoiceNumber(db, eng.tax_year + 1);
        db.run("INSERT INTO invoices (id, engagement_id, number, status, due_on, created_at) VALUES (?, ?, ?, 'draft', ?, ?)", [
          id, eng.id, number, input.dueOn ?? null, now(),
        ]);
        writeLines(db, id, lines);
        appendEvent(db, { actor: ctx.user, type: "invoice.created", subjectType: "invoice", subjectId: id, householdId: eng.household_id, engagementId: eng.id, data: { number } });
      })();
      return summaryOf(id, eng.id, ctx.user);
    }),

  // Replace a draft's lines. Issued invoices are frozen by the database (R27); say so plainly first.
  updateLines: preparerProcedure
    .input(InvoiceUpdateLinesInput)
    .output(InvoiceSummary)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const inv = invoiceFor(ctx.user, input.invoiceId);
      if (inv.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a draft invoice can be edited. Void it and create a new one." });
      db.transaction(() => {
        writeLines(db, inv.id, input.lines);
        appendEvent(db, { actor: ctx.user, type: "invoice.updated", subjectType: "invoice", subjectId: inv.id, householdId: inv.eng.household_id, engagementId: inv.eng.id, data: { lines: input.lines.length } });
      })();
      return summaryOf(inv.id, inv.eng.id, ctx.user);
    }),

  issue: preparerProcedure
    .input(InvoiceRefInput)
    .output(InvoiceSummary)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const inv = invoiceFor(ctx.user, input.invoiceId);
      if (inv.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This invoice has already been issued or voided." });
      db.transaction(() => {
        db.run("UPDATE invoices SET status = 'issued', issued_at = ? WHERE id = ?", [now(), inv.id]);
        appendEvent(db, { actor: ctx.user, type: "invoice.issued", subjectType: "invoice", subjectId: inv.id, householdId: inv.eng.household_id, engagementId: inv.eng.id });
      })();
      return summaryOf(inv.id, inv.eng.id, ctx.user);
    }),

  // Voiding a paid invoice would hide money that was received; refunds come with Stripe (09).
  void: preparerProcedure
    .input(InvoiceVoidInput)
    .output(InvoiceSummary)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const inv = invoiceFor(ctx.user, input.invoiceId);
      if (inv.status === "void") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This invoice is already void." });
      if (db.query("SELECT 1 FROM payments WHERE invoice_id = ? AND status = 'succeeded'").get(inv.id)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Money has been received on this invoice, so it can't be voided." });
      }
      db.transaction(() => {
        db.run("UPDATE invoices SET status = 'void' WHERE id = ?", [inv.id]);
        appendEvent(db, { actor: ctx.user, type: "invoice.voided", subjectType: "invoice", subjectId: inv.id, householdId: inv.eng.household_id, engagementId: inv.eng.id, reason: input.reason });
      })();
      return summaryOf(inv.id, inv.eng.id, ctx.user);
    }),
});

export const paymentRouter = router({
  // Money received outside the portal: cash, a check, Zelle. Recorded by the preparer, never more than is owed.
  record: preparerProcedure
    .input(PaymentRecordInput)
    .output(InvoiceSummary)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const inv = invoiceFor(ctx.user, input.invoiceId);
      if (inv.status !== "issued") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payments can only be recorded on an issued invoice." });
      const balance = db.query<{ balance_cents: number }, [string]>("SELECT balance_cents FROM invoice_balances WHERE invoice_id = ?").get(inv.id)!.balance_cents;
      if (input.amountCents > balance) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `That's more than the $${(balance / 100).toFixed(2)} still owed.` });
      }
      if (input.receivedOn > now().slice(0, 10)) throw new TRPCError({ code: "BAD_REQUEST", message: "The received date can't be in the future." });
      const id = Bun.randomUUIDv7();
      const at = now();
      db.transaction(() => {
        db.run(
          `INSERT INTO payments (id, invoice_id, provider, method, received_on, note, recorded_by, amount_cents, status, created_at, updated_at)
           VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, 'succeeded', ?, ?)`,
          [id, inv.id, input.method, input.receivedOn, input.note || null, ctx.user.id, input.amountCents, at, at],
        );
        appendEvent(db, {
          actor: ctx.user,
          type: "payment.recorded",
          subjectType: "payment",
          subjectId: id,
          householdId: inv.eng.household_id,
          engagementId: inv.eng.id,
          data: { method: input.method, amount_cents: input.amountCents },
        });
      })();
      return summaryOf(inv.id, inv.eng.id, ctx.user);
    }),
});
