import { TRPCError } from "@trpc/server";
import { InvoiceRefInput, Receipt } from "@app/schema";
import { runtime } from "../db/client";
import { recordView } from "../events";
import { authedProcedure } from "../trpc";
import { invoiceFor } from "./invoice";
import { practice } from "./practice";

// invoice.receipt (portal 19-invoice-paid, 20-receipt): the data for a branded receipt; the portal renders it
// and prints it to PDF. One receipt per invoice listing every payment on it, numbered after the invoice, so
// there's no second numbering scheme to keep. Who may open it is who may open the invoice: its return's
// clients (never a draft) and the preparer. A void invoice has no receipt.

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Receipt not found." });

export const receiptProcedure = authedProcedure
  .input(InvoiceRefInput)
  .output(Receipt)
  .query(({ ctx, input }) => {
    const { db } = runtime();
    const inv = invoiceFor(ctx.user, input.invoiceId); // NOT_FOUND for anyone else's
    if (inv.status !== "issued") throw notFound();
    const b = db
      .query<{ number: string; settlement: string; total_cents: number; paid_cents: number; balance_cents: number }, [string]>(
        "SELECT i.number, b.settlement, b.total_cents, b.paid_cents, b.balance_cents FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id WHERE i.id = ?",
      )
      .get(inv.id)!;
    if (b.paid_cents <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing has been paid on this invoice yet." });

    const filers = db
      .query<{ name: string }, [string]>(
        `SELECT p.first_name || COALESCE(' ' || substr(p.middle_name, 1, 1) || '.', '') || ' ' || p.last_name AS name
           FROM return_people rp JOIN people p ON p.id = rp.person_id
          WHERE rp.engagement_id = ? AND rp.role IN ('primary', 'spouse') ORDER BY rp.role = 'spouse'`,
      )
      .all(inv.engagement_id)
      .map((r) => r.name);

    recordView(db, { actor: ctx.user, type: "receipt.viewed", subjectType: "invoice", subjectId: inv.id, householdId: inv.eng.household_id, engagementId: inv.engagement_id, hourly: true });

    const { practiceName, preparerName, preparerCredential, replyToEmail, city, state } = practice(db);
    return {
      invoiceId: inv.id,
      invoiceNumber: b.number,
      receiptNumber: `R-${b.number}`,
      taxYear: inv.eng.tax_year,
      settlement: b.settlement === "paid" ? "paid" : "partial",
      practice: { practiceName, preparerName, preparerCredential, replyToEmail, city, state },
      billedTo: filers.join(" & "),
      lines: db
        .query<{ description: string; quantity: number; amount: number }, [string]>(
          "SELECT description, quantity, quantity * unit_amount_cents AS amount FROM invoice_lines WHERE invoice_id = ? ORDER BY position",
        )
        .all(inv.id)
        .map((l) => ({ description: l.description, quantity: l.quantity, amountCents: l.amount })),
      included: db.query<{ name: string }, [string]>("SELECT name FROM invoice_included WHERE invoice_id = ? ORDER BY name").all(inv.id).map((x) => x.name),
      totalCents: b.total_cents,
      paidCents: b.paid_cents,
      balanceCents: b.balance_cents,
      payments: db
        .query<{ id: string; amount_cents: number; created_at: string; received_on: string | null; provider: "stripe" | "manual"; method: "cash" | "check" | "zelle" | "other" | null }, [string]>(
          "SELECT id, amount_cents, created_at, received_on, provider, method FROM payments WHERE invoice_id = ? AND status = 'succeeded' ORDER BY COALESCE(received_on, created_at) DESC, id DESC",
        )
        .all(inv.id)
        .map((p) => ({
          id: p.id,
          amountCents: p.amount_cents,
          paidAt: p.received_on ? `${p.received_on}T12:00:00.000Z` : p.created_at, // a hand-recorded payment has a day, not a time
          method: p.method ?? "card",
          processedBy: p.provider === "stripe" ? ("stripe" as const) : ("preparer" as const),
        })),
    };
  });
