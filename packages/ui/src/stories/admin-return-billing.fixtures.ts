import type { InvoiceAddonOption, InvoicePackageOption, InvoiceSuggestion } from "../components/create-invoice-dialog";
import type { BillingInvoice, BillingPayment } from "../components/return-billing";

// Invented data for a return's Billing tab and its dialogs (ticket 59). Nothing here is real: the demo practice
// (Bell Tax, preparer Morgan Hale), invented households, .test emails. Amounts are in cents.

export const BILLING_PRACTICE = { practiceName: "Bell Tax", preparerName: "Morgan Hale", replyToEmail: "hello@belltax.test" };
export const BILLING_CLIENT = { name: "Dana & Sam Marigold", email: "dana.marigold@example.test" };
export const BILLING_TODAY = "2026-10-22";

/** Sent, partly paid by check, with one included add-on. */
export const PARTIAL_INVOICE: BillingInvoice = {
  id: "inv-2041",
  number: "INV-2041",
  status: "issued",
  settlement: "partial",
  totalCents: 47500,
  paidCents: 20000,
  balanceCents: 27500,
  due: "Nov 5",
  lines: [
    { description: "Married filing jointly", quantity: 1, unitAmountCents: 32500 },
    { description: "Rental property", quantity: 1, unitAmountCents: 15000 },
  ],
  included: ["IHSS income"],
  payments: [{ status: "succeeded" }],
};

/** Sent, unpaid, and the client's card was just declined. */
export const FAILED_INVOICE: BillingInvoice = {
  id: "inv-2042",
  number: "INV-2042",
  status: "issued",
  settlement: "failed_last_attempt",
  totalCents: 37500,
  paidCents: 0,
  balanceCents: 37500,
  due: "Nov 5",
  lines: [
    { description: "Single", quantity: 1, unitAmountCents: 22500 },
    { description: "Schedule C", quantity: 1, unitAmountCents: 15000 },
  ],
  included: [],
  payments: [{ status: "failed" }],
};

/** Not sent yet. Two rental properties. */
export const DRAFT_INVOICE: BillingInvoice = {
  id: "inv-2043",
  number: "INV-2043",
  status: "draft",
  settlement: "draft",
  totalCents: 57500,
  paidCents: 0,
  balanceCents: 57500,
  due: null,
  lines: [
    { description: "Married filing jointly", quantity: 1, unitAmountCents: 32500 },
    { description: "Rental property", quantity: 2, unitAmountCents: 12500 },
  ],
  included: [],
  payments: [],
};

export const VOID_INVOICE: BillingInvoice = {
  id: "inv-2039",
  number: "INV-2039",
  status: "void",
  settlement: "void",
  totalCents: 22500,
  paidCents: 0,
  balanceCents: 22500,
  due: "Oct 20",
  lines: [{ description: "Single", quantity: 1, unitAmountCents: 22500 }],
  included: [],
  payments: [],
};

export const PAID_INVOICE: BillingInvoice = {
  ...PARTIAL_INVOICE,
  id: "inv-2044",
  number: "INV-2044",
  settlement: "paid",
  paidCents: 47500,
  balanceCents: 0,
  payments: [{ status: "succeeded" }, { status: "succeeded" }],
};

export const BILLING_INVOICES: BillingInvoice[] = [PARTIAL_INVOICE, VOID_INVOICE];

export const BILLING_PAYMENTS: BillingPayment[] = [
  { id: "pay-3", when: "Oct 18, 2026", provider: "manual", method: "check", amountCents: 20000, status: "succeeded", failureMessage: null, note: "Check no. 1042." },
  { id: "pay-2", when: "Oct 16, 2026, 2:14 PM", provider: "stripe", method: null, amountCents: 47500, status: "failed", failureMessage: "Your card was declined.", note: null },
  { id: "pay-1", when: "Oct 15, 2026, 9:02 AM", provider: "stripe", method: null, amountCents: 47500, status: "pending", failureMessage: null, note: null },
];

export const FAILED_PAYMENTS: BillingPayment[] = [
  { id: "pay-9", when: "Oct 21, 2026, 6:40 PM", provider: "stripe", method: null, amountCents: 37500, status: "failed", failureMessage: "Your card has insufficient funds.", note: null },
];

// What Settings → Services & pricing offers, and what this return's intake calls for.
export const INVOICE_PACKAGES: InvoicePackageOption[] = [
  { code: "pkg-single", name: "Single", unitAmountCents: 22500, active: true },
  { code: "pkg-mfj", name: "Married filing jointly", unitAmountCents: 32500, active: true },
  { code: "pkg-hoh", name: "Head of household", unitAmountCents: 27500, active: true },
  { code: "pkg-mfs", name: "Married filing separately", unitAmountCents: 27500, active: false },
];
export const INVOICE_ADDONS: InvoiceAddonOption[] = [
  { code: "add-sched-c", name: "Schedule C", unitAmountCents: 15000, active: true },
  { code: "add-rental", name: "Rental property", unitAmountCents: 12500, active: true },
  { code: "add-ihss", name: "IHSS income", unitAmountCents: null, active: true },
  { code: "add-rush", name: "Rush turnaround", unitAmountCents: 7500, active: false },
];
/** Joint filers with two rentals and IHSS income. */
export const INVOICE_SUGGESTION: InvoiceSuggestion = {
  packageCode: "pkg-mfj",
  lines: [
    { priceCode: "pkg-mfj", quantity: 1 },
    { priceCode: "add-rental", quantity: 2 },
  ],
  included: [{ code: "add-ihss" }],
};
/** Nothing on file yet: no package, no add-ons. */
export const EMPTY_SUGGESTION: InvoiceSuggestion = { packageCode: null, lines: [], included: [] };
