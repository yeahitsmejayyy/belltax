// How an invoice stands, defined once and shared by the invoices list (ticket 39), the dashboard (38) and the
// sidebar badge. Both fragments expect invoice_balances as `b` joined to invoices as `i`, and take today's
// date (YYYY-MM-DD) as their one parameter.

// Issued, still owing, and past its due date.
export const OVERDUE_SQL = "b.status = 'issued' AND b.balance_cents > 0 AND i.due_on IS NOT NULL AND i.due_on < ?";

// The one tab each invoice sits in (admin 29-clients-invoices-and-activity-invoices), most urgent first. A
// failed payment outranks overdue; "open" is anything else still owed, unpaid or partly paid.
export const INVOICE_TABS = ["failed", "overdue", "open", "draft", "paid", "void"] as const;
export type InvoiceTab = (typeof INVOICE_TABS)[number];
export const TAB_RANK_SQL = `CASE
    WHEN b.status = 'void' THEN 5
    WHEN b.status = 'draft' THEN 3
    WHEN b.settlement = 'failed_last_attempt' THEN 0
    WHEN b.status = 'issued' AND b.balance_cents > 0 AND i.due_on IS NOT NULL AND i.due_on < ?1 THEN 1
    WHEN b.balance_cents > 0 THEN 2
    ELSE 4
  END`;
