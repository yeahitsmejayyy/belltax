import { TRPCError } from "@trpc/server";
import {
  InvoiceAllInput,
  InvoicePage,
  InvoiceCreateInput,
  InvoiceListInput,
  InvoiceRefInput,
  InvoiceSuggestInput,
  InvoiceSuggestion,
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
import { nextInvoiceNumber, suggestionFor, type Line } from "../money/pricing";
import { INVOICE_TABS, TAB_RANK_SQL } from "../money/settlement";
import { authedProcedure, preparerProcedure, router } from "../trpc";

// Invoices: lines are facts, the balance is derived (invoice_balances, R28), lines freeze once issued
// (R27). Money arrives by hand today; Stripe (ticket 09) adds a second path into the same payments table.

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
      included: db
        .query<{ name: string }, [string]>("SELECT name FROM invoice_included WHERE invoice_id = ? ORDER BY name")
        .all(r.invoice_id as string)
        .map((x) => x.name),
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

export function invoiceFor(user: SessionUser, invoiceId: string): InvoiceRef & { eng: EngagementRef } {
  const inv = runtime().db.query<InvoiceRef, [string]>("SELECT id, engagement_id, status FROM invoices WHERE id = ?").get(invoiceId);
  if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
  const eng = engagementFor(user, inv.engagement_id);
  if (user.role !== "preparer" && inv.status === "draft") throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
  return { ...inv, eng };
}

type LineIn = Omit<Line, "priceCode"> & { priceCode?: string | null };

// A line's price code must name a current package or add-on; an included code, a current included add-on.
function checkCodes(db: Database, lines: LineIn[], included: string[]) {
  for (const l of lines) {
    if (!l.priceCode) continue;
    const known = db.query("SELECT 1 FROM price_packages WHERE code = ?1 AND retired_at IS NULL UNION ALL SELECT 1 FROM price_addons WHERE code = ?1 AND retired_at IS NULL").get(l.priceCode);
    if (!known) throw new TRPCError({ code: "BAD_REQUEST", message: `"${l.description}" points at a price that isn't in your pricing.` });
  }
  return included.map((code) => {
    const a = db.query<{ name: string; unit_amount_cents: number | null }, [string]>("SELECT name, unit_amount_cents FROM price_addons WHERE code = ? AND retired_at IS NULL").get(code);
    if (!a) throw new TRPCError({ code: "BAD_REQUEST", message: "An included add-on isn't in your pricing." });
    if (a.unit_amount_cents !== null) throw new TRPCError({ code: "BAD_REQUEST", message: `${a.name} has a price; add it as a line instead.` });
    return { code, name: a.name };
  });
}

function writeLines(db: Database, invoiceId: string, lines: LineIn[]) {
  db.run("DELETE FROM invoice_lines WHERE invoice_id = ?", [invoiceId]);
  lines.forEach((l, i) =>
    db.run("INSERT INTO invoice_lines (id, invoice_id, position, description, quantity, unit_amount_cents, price_code) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      Bun.randomUUIDv7(), invoiceId, i + 1, l.description, l.quantity, l.unitAmountCents, l.priceCode ?? null,
    ]),
  );
}

function writeIncluded(db: Database, invoiceId: string, included: { code: string; name: string }[]) {
  db.run("DELETE FROM invoice_included WHERE invoice_id = ?", [invoiceId]);
  for (const x of included) db.run("INSERT INTO invoice_included (invoice_id, price_code, name) VALUES (?, ?, ?)", [invoiceId, x.code, x.name]);
}

const summaryOf = (invoiceId: string, engagementId: string, user: SessionUser) => listInvoices(engagementId, user).find((i) => i.id === invoiceId)!;

// Every invoice in a tax year, one tab each, most urgent first (failed, overdue, open, draft, paid, void),
// paged on (tab, due date, id) so a page never shifts when new invoices arrive.
function invoicesPage(db: Database, input: z.infer<typeof InvoiceAllInput>, today = new Date().toISOString().slice(0, 10)): InvoicePage {
  const taxYear = input?.taxYear ?? db.query<{ y: number | null }, []>("SELECT MAX(tax_year) AS y FROM engagements").get()!.y;
  const empty = { all: 0, failed: 0, overdue: 0, open: 0, draft: 0, paid: 0, void: 0 };
  if (taxYear === null) return { taxYear, items: [], next: null, counts: empty, outstandingCents: 0 };
  const limit = input?.limit ?? 50;
  const params: (string | number)[] = [today, taxYear];
  const where = ["e.tax_year = ?2"];
  if (input?.tab) {
    params.push(INVOICE_TABS.indexOf(input.tab));
    where.push(`rank = ?${params.length}`);
  }
  if (input?.cursor) {
    params.push(input.cursor.rank, input.cursor.due, input.cursor.id);
    where.push(`(rank, due_key, b.invoice_id) > (?${params.length - 2}, ?${params.length - 1}, ?${params.length})`);
  }
  params.push(limit + 1);
  const rows = db
    .query<Record<string, string | number | null>, (string | number)[]>(
      `SELECT * FROM (
         SELECT b.invoice_id, i.number, b.engagement_id, e.household_id, e.tax_year, b.settlement, b.total_cents, b.paid_cents, b.balance_cents,
                i.due_on, i.issued_at, ${TAB_RANK_SQL} AS rank, COALESCE(i.due_on, '9999-12-31') AS due_key,
                COALESCE(pr.filers || ' ' || pr.household_name, pr.household_name) AS name
           FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id JOIN engagements e ON e.id = b.engagement_id
           JOIN pipeline_rows pr ON pr.engagement_id = b.engagement_id
          WHERE e.tax_year = ?2) b
        WHERE ${where.join(" AND ").replace("e.tax_year = ?2", "b.tax_year = ?2")}
        ORDER BY rank, due_key, b.invoice_id
        LIMIT ?${params.length}`,
    )
    .all(...params);
  const page = rows.slice(0, limit);
  const lastPayment = db.query<{ status: string; amount_cents: number; provider: string; method: string | null; failure_message: string | null; created_at: string }, [string]>(
    "SELECT status, amount_cents, provider, method, failure_message, created_at FROM payments WHERE invoice_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
  );
  const items = page.map((r) => {
    const p = lastPayment.get(r.invoice_id as string);
    return {
      id: r.invoice_id as string,
      number: r.number as string,
      engagementId: r.engagement_id as string,
      householdId: r.household_id as string,
      name: r.name as string,
      taxYear: r.tax_year as number,
      tab: INVOICE_TABS[r.rank as number]!,
      settlement: r.settlement as InvoiceSummary["settlement"],
      totalCents: r.total_cents as number,
      paidCents: r.paid_cents as number,
      balanceCents: r.balance_cents as number,
      dueOn: r.due_on as string | null,
      issuedAt: r.issued_at as string | null,
      lastPayment: p
        ? {
            status: p.status as InvoiceSummary["payments"][number]["status"],
            amountCents: p.amount_cents,
            provider: p.provider as InvoiceSummary["payments"][number]["provider"],
            method: p.method as InvoiceSummary["payments"][number]["method"],
            failureMessage: p.failure_message,
            at: p.created_at,
          }
        : null,
    };
  });
  const last = page.at(-1);

  const tally = db
    .query<{ rank: number; n: number; owed: number | null }, [string, number]>(
      `SELECT ${TAB_RANK_SQL} AS rank, COUNT(*) AS n, SUM(CASE WHEN b.status = 'issued' AND b.balance_cents > 0 THEN b.balance_cents ELSE 0 END) AS owed
         FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id JOIN engagements e ON e.id = b.engagement_id
        WHERE e.tax_year = ?2 GROUP BY rank`,
    )
    .all(today, taxYear);
  const counts = { ...empty };
  for (const t of tally) counts[INVOICE_TABS[t.rank]!] = t.n;
  counts.all = tally.reduce((a, t) => a + t.n, 0);

  return {
    taxYear,
    items,
    next: rows.length > limit && last ? { rank: last.rank as number, due: last.due_key as string, id: last.invoice_id as string } : null,
    counts,
    outstandingCents: tally.reduce((a, t) => a + (t.owed ?? 0), 0),
  };
}

export const invoiceRouter = router({
  // The Invoices screen: the whole practice for a tax year, problems first.
  all: preparerProcedure
    .input(InvoiceAllInput)
    .output(InvoicePage)
    .query(({ input }) => invoicesPage(runtime().db, input)),

  // A client's view of what they owe on a return; the preparer also sees drafts.
  list: authedProcedure
    .input(InvoiceListInput)
    .output(z.array(InvoiceSummary))
    .query(({ ctx, input }) => {
      engagementFor(ctx.user, input.engagementId);
      return listInvoices(input.engagementId, ctx.user);
    }),

  // Pricing applied to what's on this return: its package, the add-ons its facts call for, the included ones.
  // A starting point the preparer edits (admin 23-dialogs-and-sheets-dlg-invoice).
  suggest: preparerProcedure
    .input(InvoiceSuggestInput)
    .output(InvoiceSuggestion)
    .query(({ ctx, input }) => {
      engagementFor(ctx.user, input.engagementId);
      return suggestionFor(runtime().db, input.engagementId);
    }),

  create: preparerProcedure
    .input(InvoiceCreateInput)
    .output(InvoiceSummary)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const eng = engagementFor(ctx.user, input.engagementId);
      const suggestion = input.lines ? null : suggestionFor(db, eng.id);
      const lines: LineIn[] = input.lines ?? suggestion!.lines;
      if (!lines.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nothing to charge yet: set the filing status, or add lines by hand." });
      const included = checkCodes(db, lines, input.included ?? suggestion?.included.map((x) => x.code) ?? []);
      const id = Bun.randomUUIDv7();
      db.transaction(() => {
        const number = nextInvoiceNumber(db, eng.tax_year + 1);
        db.run("INSERT INTO invoices (id, engagement_id, number, status, due_on, created_at) VALUES (?, ?, ?, 'draft', ?, ?)", [
          id, eng.id, number, input.dueOn ?? null, now(),
        ]);
        writeLines(db, id, lines);
        writeIncluded(db, id, included);
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
      const included = checkCodes(db, input.lines, input.included ?? []);
      db.transaction(() => {
        writeLines(db, inv.id, input.lines);
        if (input.included) writeIncluded(db, inv.id, included); // left out: what it already includes stays
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
