import { z } from "zod";

// Every enum here is mirrored as a SQL CHECK in the migrations (apps/server/src/db/migrations/).
// schema.test.ts fails if the two lists ever disagree.

export const UserRole = z.enum(["client", "preparer"]);
export type UserRole = z.infer<typeof UserRole>;

export const EngagementKind = z.enum(["original", "amended"]);
export type EngagementKind = z.infer<typeof EngagementKind>;

export const FilingStatus = z.enum(["single", "mfj", "mfs", "hoh", "qss"]);
export type FilingStatus = z.infer<typeof FilingStatus>;

// Pipeline order matters: index = position on the board.
export const Stage = z.enum(["invited", "intake", "documents", "ready", "preparing", "review", "filed", "complete"]);
export type Stage = z.infer<typeof Stage>;

// A role on one return in one year — never a permanent fact about a person.
export const ReturnRole = z.enum(["primary", "spouse", "dependent"]);
export type ReturnRole = z.infer<typeof ReturnRole>;

export const SourceKind = z.enum([
  "employer",
  "brokerage",
  "bank",
  "rental_property",
  "business",
  "ihss_provider",
  "retirement",
  "other",
]);
export type SourceKind = z.infer<typeof SourceKind>;

export const DocumentCategory = z.enum([
  "income",
  "deduction",
  "credit",
  "identity",
  "prior_year",
  "property",
  "business",
  "other",
]);
export type DocumentCategory = z.infer<typeof DocumentCategory>;

export const DocumentStatus = z.enum(["uploaded", "accepted", "rejected"]);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const RequestKind = z.enum(["document", "question"]);
export type RequestKind = z.infer<typeof RequestKind>;

export const RequestStatus = z.enum(["open", "fulfilled", "cancelled"]);
export type RequestStatus = z.infer<typeof RequestStatus>;

export const LetterStatus = z.enum(["draft", "sent", "signed", "void"]);
export type LetterStatus = z.infer<typeof LetterStatus>;

// Lifecycle only. Paid / partial / failed are derived by the invoice_balances view.
export const InvoiceStatus = z.enum(["draft", "issued", "void"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const PaymentProvider = z.enum(["stripe", "manual"]);
export type PaymentProvider = z.infer<typeof PaymentProvider>;

// How a manually recorded payment arrived.
export const PaymentMethod = z.enum(["cash", "check", "zelle", "other"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

// Who sends us webhooks. Stripe only; manual payments never arrive by webhook.
export const WebhookProvider = z.enum(["stripe"]);
export type WebhookProvider = z.infer<typeof WebhookProvider>;

export const PaymentStatus = z.enum(["pending", "succeeded", "failed", "refunded"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const ActorKind = z.enum(["client", "preparer", "system", "stripe"]);
export type ActorKind = z.infer<typeof ActorKind>;
