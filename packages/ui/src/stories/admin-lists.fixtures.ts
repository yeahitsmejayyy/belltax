import type { InboxKind } from "@app/schema";

import type { ActivityFeedItem } from "../components/activity-feed";
import type { InboxRowItem } from "../components/inbox-list";
import type { InvoiceListRow, InvoiceListTab } from "../components/invoice-list";
import type { OutboxMessage } from "../components/outbox";

// Invented data for the admin Inbox, Activity, Outbox and Invoices stories (ticket 58). Nothing here is real. Times
// come already worded ("2:14 PM", "Yesterday") the way the app words them, so the stories read the same any day.

// ---------- Inbox ----------

export type InboxFixture = InboxRowItem & { subjectId: string };

export const INBOX_ITEMS: InboxFixture[] = [
  { id: "document_review:doc-w2", kind: "document_review", at: "2026-02-10T19:14:00.000Z", when: "2:14 PM", householdName: "Okafor", taxYear: 2025, summary: "Okafor sent a W-2 from Lakeside Community College", action: "review_document", subjectId: "doc-w2" },
  { id: "question_answered:req-move", kind: "question_answered", at: "2026-02-10T16:02:00.000Z", when: "11:02 AM", householdName: "Lindqvist", taxYear: 2025, summary: "Lindqvist answered: did you move in 2025?", action: "acknowledge_answer", subjectId: "req-move" },
  { id: "letter_signed:letter-1", kind: "letter_signed", at: "2026-02-09T21:40:00.000Z", when: "Yesterday", householdName: "Marchetti", taxYear: 2025, summary: "Marchetti signed the engagement letter", action: "advance_stage", subjectId: "letter-1" },
  { id: "payment_failed:pay-1", kind: "payment_failed", at: "2026-02-08T14:00:00.000Z", when: "Feb 8", householdName: "Abara", taxYear: 2025, summary: "A card payment from Abara was declined", action: "follow_up_payment", subjectId: "pay-1" },
  { id: "efile_rejected:ef-1", kind: "efile_rejected", at: "2026-02-06T18:30:00.000Z", when: "Feb 6", householdName: "Thornbury", taxYear: 2025, summary: "Thornbury's state e-file was rejected", action: "resubmit_efile", subjectId: "ef-1" },
  { id: "stale:eng-9", kind: "stale", at: "2026-02-01T15:00:00.000Z", when: "Feb 1", householdName: "Delacroix-Ng", taxYear: 2025, summary: "Delacroix-Ng has been in Documents for 9 days", action: "open_return", subjectId: "eng-9" },
];

export const inboxCounts = (items: InboxFixture[]) => {
  const counts: Partial<Record<InboxKind, number>> = {};
  for (const i of items) counts[i.kind] = (counts[i.kind] ?? 0) + 1;
  return counts;
};

// ---------- Activity ----------

export const ACTIVITY_CLIENTS = [
  { id: "hh-okafor", name: "Okafor" },
  { id: "hh-lindqvist", name: "Lindqvist" },
  { id: "hh-marchetti", name: "Marchetti" },
];

export const ACTIVITY_ITEMS: ActivityFeedItem[] = [
  { id: "ev-1", occurredAt: "2026-02-10T19:14:00.000Z", day: "Today", type: "document.uploaded", actorKind: "client", actorName: "Ada Okafor", householdId: "hh-okafor", householdName: "Okafor" },
  { id: "ev-2", occurredAt: "2026-02-10T18:50:00.000Z", day: "Today", type: "document.rejected", actorKind: "preparer", actorName: "Preparer", reason: "The bottom of the page is cut off.", householdId: "hh-okafor", householdName: "Okafor" },
  { id: "ev-3", occurredAt: "2026-02-10T16:02:00.000Z", day: "Today", type: "payment.succeeded", actorKind: "stripe", actorName: "Stripe", householdId: "hh-lindqvist", householdName: "Lindqvist" },
  { id: "ev-4", occurredAt: "2026-02-09T21:40:00.000Z", day: "Yesterday", type: "letter.signed", actorKind: "client", actorName: "Rosa Marchetti", householdId: "hh-marchetti", householdName: "Marchetti" },
  { id: "ev-5", occurredAt: "2026-02-09T12:00:00.000Z", day: "Yesterday", type: "settings.price_updated", actorKind: "preparer", actorName: "Preparer" },
  { id: "ev-6", occurredAt: "2026-02-08T06:00:00.000Z", day: "Sunday, Feb 8", type: "invoice.issued", actorKind: "system", actorName: "System", householdId: "hh-lindqvist", householdName: "Lindqvist" },
  { id: "ev-7", occurredAt: "2026-02-08T05:00:00.000Z", day: "Sunday, Feb 8", type: "engagement.viewed", actorKind: "preparer", actorName: "Preparer", householdId: "hh-marchetti", householdName: "Marchetti" },
];

// ---------- Outbox ----------

const email = (heading: string, body: string) =>
  `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:24px;color:#1f1f1f"><h1 style="font-size:20px">${heading}</h1><p>${body}</p><p><a href="#">Open the portal</a></p></body></html>`;

export const OUTBOX_MESSAGES: OutboxMessage[] = [
  { id: "mail-1", at: "2026-02-10T19:20:00.000Z", to: "ada.okafor@example.test", from: "Example Tax <hello@example.test>", subject: "You're invited to your client portal", html: email("Welcome", "Your tax agent invited you to the client portal. The link works once and expires in 7 days.") },
  { id: "mail-2", at: "2026-02-09T15:05:00.000Z", to: "rosa.marchetti@example.test", from: "Example Tax <hello@example.test>", subject: "Reset your password", html: email("Reset your password", "Someone asked to reset the password on your portal account. If that wasn't you, ignore this email.") },
  { id: "mail-3", at: "2026-02-08T11:30:00.000Z", to: "jon.lindqvist@example.test", from: "Example Tax <hello@example.test>", subject: "Your sign-in changed", html: email("Your sign-in changed", "A passkey was added to your portal account.") },
];

// ---------- Invoices ----------

export const INVOICE_ROWS: InvoiceListRow[] = [
  { id: "inv-1", number: "INV-2026-0012", name: "Abara", totalCents: 42500, tab: "failed", settlement: "failed_last_attempt", due: "Feb 15", lastPayment: { status: "failed", provider: "stripe", method: null, failureMessage: "Card declined", when: "Feb 8" } },
  { id: "inv-2", number: "INV-2026-0011", name: "Thornbury", totalCents: 61000, tab: "overdue", settlement: "unpaid", due: "Feb 1", lastPayment: null },
  { id: "inv-3", number: "INV-2026-0010", name: "Lindqvist", totalCents: 38000, tab: "open", settlement: "partial", due: "Feb 28", lastPayment: { status: "succeeded", provider: "manual", method: "zelle", failureMessage: null, when: "Yesterday" } },
  { id: "inv-4", number: "INV-2026-0009", name: "Okafor", totalCents: 29500, tab: "open", settlement: "unpaid", due: null, lastPayment: { status: "pending", provider: "stripe", method: null, failureMessage: null, when: "2:14 PM" } },
  { id: "inv-5", number: "INV-2026-0008", name: "Marchetti", totalCents: 51000, tab: "paid", settlement: "paid", due: "Jan 31", lastPayment: { status: "succeeded", provider: "manual", method: "check", failureMessage: null, when: "Jan 30" } },
  { id: "inv-6", number: "INV-2026-0007", name: "Delacroix-Ng", totalCents: 33000, tab: "draft", settlement: "draft", due: null, lastPayment: null },
];

export const invoiceCounts = (rows: InvoiceListRow[]): Record<InvoiceListTab, number> => {
  const counts: Record<InvoiceListTab, number> = { all: rows.length, open: 0, failed: 0, overdue: 0, paid: 0, draft: 0, void: 0 };
  for (const r of rows) counts[r.tab] += 1;
  return counts;
};
