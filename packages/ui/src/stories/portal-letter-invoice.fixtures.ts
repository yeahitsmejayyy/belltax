import type { LetterView } from "@app/schema";

import type { ClientInvoice, ReceiptData } from "../components/invoice";

// Invented data for the portal's Letter and Invoice stories: an invented household, an invented practice, .test emails.

export const PREPARER = "Morgan Hale";
export const REPLY_TO = "hello@belltax.example";

const LETTER_BODY = `Engagement letter for the Okafor-Lindqvist household, tax year 2025

This letter explains what Morgan Hale will do for you, what you'll do, and what it costs.

1. What we'll do
Prepare your 2025 federal and California returns from the information you give us.
File them electronically once you've reviewed and approved them.

2. What you'll do
Answer the questions in the portal and upload the documents we ask for.
Tell us about anything that changes before we file.

3. Fees
The fee is set out on your invoice before any work is filed. Nothing is filed until it's paid or arranged.`;

export const letter = (over: Partial<LetterView> = {}): LetterView => ({
  id: "l-demo-1",
  status: "sent",
  householdName: "Okafor-Lindqvist",
  taxYear: 2025,
  templateVersion: 1,
  body: LETTER_BODY,
  bodySha256: "0f".repeat(32),
  sentAt: "2026-10-12T17:00:00.000Z",
  archivedAt: null,
  engagementIds: ["e-demo-1"],
  consentText: "I agree to this engagement letter and to signing it electronically.",
  signers: [
    { personId: "p-1", name: "Ada Okafor-Lindqvist", signedAt: null, isMe: true },
    { personId: "p-2", name: "Tobias Lindqvist", signedAt: null, isMe: false },
  ],
  canSign: true,
  audit: null,
  ...over,
});

export const signedByMe = letter({
  signers: [
    { personId: "p-1", name: "Ada Okafor-Lindqvist", signedAt: "2026-10-14T01:18:00.000Z", isMe: true },
    { personId: "p-2", name: "Tobias Lindqvist", signedAt: null, isMe: false },
  ],
  canSign: false,
});

export const signedByAll = letter({
  status: "signed",
  signers: [
    { personId: "p-1", name: "Ada Okafor-Lindqvist", signedAt: "2026-10-14T01:18:00.000Z", isMe: true },
    { personId: "p-2", name: "Tobias Lindqvist", signedAt: "2026-10-13T16:02:00.000Z", isMe: false },
  ],
  canSign: false,
});

const base: ClientInvoice = {
  id: "i-demo-1",
  number: "2026-0031",
  status: "issued",
  settlement: "unpaid",
  totalCents: 42_500,
  paidCents: 0,
  balanceCents: 42_500,
  dueOn: "2099-04-15",
  lines: [
    { description: "Married filing jointly, federal + California", quantity: 1, unitAmountCents: 35_000 },
    { description: "Rental property (Schedule E)", quantity: 1, unitAmountCents: 7_500 },
  ],
  included: ["IHSS home care income"],
  payments: [],
};

export const unpaid = base;

export const failed: ClientInvoice = {
  ...base,
  settlement: "failed_last_attempt",
  payments: [
    { id: "pay-f1", amountCents: 42_500, status: "failed", provider: "stripe", method: null, receivedOn: null, note: null, failureMessage: "Your card was declined.", createdAt: "2026-10-15T01:18:00.000Z" },
  ],
};

export const paid: ClientInvoice = {
  ...base,
  settlement: "paid",
  paidCents: 42_500,
  balanceCents: 0,
  payments: [{ id: "pay-1", amountCents: 42_500, status: "succeeded", provider: "stripe", method: null, receivedOn: null, note: null, failureMessage: null, createdAt: "2026-10-16T01:18:00.000Z" }],
};

export const partial: ClientInvoice = {
  ...base,
  settlement: "partial",
  paidCents: 20_000,
  balanceCents: 22_500,
  payments: [{ id: "pay-2", amountCents: 20_000, status: "succeeded", provider: "manual", method: "zelle", receivedOn: "2026-10-10", note: null, failureMessage: null, createdAt: "2026-10-10T18:00:00.000Z" }],
};

export const older: ClientInvoice = { ...paid, id: "i-demo-0", number: "2025-0012", totalCents: 31_000, paidCents: 31_000 };

export const receipt: ReceiptData = {
  invoiceId: "i-demo-1",
  invoiceNumber: "2026-0031",
  receiptNumber: "R-2026-0031",
  taxYear: 2025,
  settlement: "partial",
  practice: { practiceName: "Bell Tax", preparerName: PREPARER, preparerCredential: "CRTP", replyToEmail: REPLY_TO, city: "Fresno", state: "CA" },
  billedTo: "Ada Okafor-Lindqvist",
  lines: [
    { description: "Married filing jointly, federal + California", quantity: 1, amountCents: 35_000 },
    { description: "Rental property (Schedule E)", quantity: 1, amountCents: 7_500 },
  ],
  included: ["IHSS home care income"],
  totalCents: 42_500,
  paidCents: 30_000,
  balanceCents: 12_500,
  payments: [
    { id: "pay-3", amountCents: 10_000, paidAt: "2026-10-16T01:18:00.000Z", method: "card", processedBy: "stripe" },
    { id: "pay-2", amountCents: 20_000, paidAt: "2026-10-10T18:00:00.000Z", method: "zelle", processedBy: "preparer" },
  ],
};
