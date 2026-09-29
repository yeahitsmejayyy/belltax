import { z } from "zod";
import {
  ActorKind,
  DocumentCategory,
  DocumentStatus,
  EngagementKind,
  FilingStatus,
  InvoiceStatus,
  LetterStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  RequestKind,
  RequestStatus,
  ReturnRole,
  SourceKind,
  Stage,
  UserRole,
  WebhookProvider,
} from "./enums";
import { Cents, Id, IsoDate, Json, Sha256, SsnLast4, TaxYear, Timestamp } from "./primitives";

// One zod object per table, column for column. schema.test.ts fails if a key and a column drift apart.

const text = z.string().min(1);

// ---- People & access ----

export const HouseholdRow = z.object({
  id: Id,
  display_name: text,
  created_at: Timestamp,
  archived_at: Timestamp.nullable(),
});

export const PersonRow = z.object({
  id: Id,
  household_id: Id.nullable(),
  first_name: text,
  middle_name: text.nullable(),
  last_name: text,
  suffix: text.nullable(),
  date_of_birth: IsoDate.nullable(),
  ssn_last4: SsnLast4.nullable(),
  email: z.email().nullable(),
  phone: text.nullable(),
  created_at: Timestamp,
});

export const UserRow = z.object({
  id: Id,
  role: UserRole,
  email: z.email(),
  person_id: Id.nullable(),
  password_hash: text.nullable(),
  activated_at: Timestamp.nullable(),
  created_at: Timestamp,
});

export const HouseholdAccessRow = z.object({
  id: Id,
  user_id: Id,
  household_id: Id,
  granted_by: Id,
  granted_at: Timestamp,
  revoked_at: Timestamp.nullable(),
});

// ---- Returns ----

export const EngagementRow = z.object({
  id: Id,
  household_id: Id,
  tax_year: TaxYear,
  kind: EngagementKind,
  amends_id: Id.nullable(),
  filing_status: FilingStatus.nullable(),
  stage: Stage,
  stage_changed_at: Timestamp,
  letter_id: Id.nullable(),
  created_at: Timestamp,
});

export const ReturnPersonRow = z.object({
  engagement_id: Id,
  person_id: Id,
  tax_year: TaxYear,
  engagement_kind: EngagementKind,
  role: ReturnRole,
  relationship: text.nullable(),
  months_lived_with: z.int().min(0).max(12).nullable(),
});

export const IntakeResponseRow = z.object({
  engagement_id: Id,
  form_version: z.int().positive(),
  answers: Json,
  updated_at: Timestamp,
  submitted_at: Timestamp.nullable(),
});

// ---- Sources ----

export const SourceRow = z.object({
  id: Id,
  household_id: Id,
  kind: SourceKind,
  label: text,
  first_year: TaxYear.nullable(),
  last_year: TaxYear.nullable(),
  created_at: Timestamp,
});

export const SourceOwnerRow = z.object({
  source_id: Id,
  person_id: Id,
});

export const ReturnSourceRow = z.object({
  engagement_id: Id,
  source_id: Id,
  note: text.nullable(),
});

// ---- Requests & documents ----

export const DocumentKindRow = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/),
  form_name: text,
  label: text,
  category: DocumentCategory,
  active: z.union([z.literal(0), z.literal(1)]),
});

export const RequestRow = z.object({
  id: Id,
  engagement_id: Id,
  person_id: Id.nullable(),
  source_id: Id.nullable(),
  kind: RequestKind,
  document_kind: text.nullable(),
  title: text,
  note: text.nullable(),
  response: text.nullable(),
  status: RequestStatus,
  created_by: Id,
  created_at: Timestamp,
  responded_at: Timestamp.nullable(),
  closed_at: Timestamp.nullable(),
  acknowledged_at: Timestamp.nullable(),
});

export const DocumentRow = z.object({
  id: Id,
  person_id: Id.nullable(),
  engagement_id: Id.nullable(),
  tax_year: TaxYear.nullable(),
  request_id: Id.nullable(),
  source_id: Id.nullable(),
  supersedes_id: Id.nullable(),
  kind: text,
  label: text.nullable(),
  status: DocumentStatus,
  reject_reason: text.nullable(),
  filename: text,
  mime_type: text,
  size_bytes: z.int().positive(),
  sha256: Sha256,
  storage_key: text.nullable(),
  uploaded_by: Id,
  created_at: Timestamp,
  reviewed_at: Timestamp.nullable(),
  purge_after: IsoDate.nullable(),
  purged_at: Timestamp.nullable(),
});

// ---- Engagement letter ----

export const EngagementLetterRow = z.object({
  id: Id,
  household_id: Id,
  tax_year: TaxYear,
  template_version: z.int().positive(),
  body: text,
  body_sha256: Sha256,
  status: LetterStatus,
  created_at: Timestamp,
  sent_at: Timestamp.nullable(),
});

export const SignatureRow = z.object({
  id: Id,
  letter_id: Id,
  person_id: Id,
  user_id: Id,
  body_sha256: Sha256,
  typed_name: text,
  consent_text: text,
  ip: text,
  user_agent: text,
  signed_at: Timestamp,
});

// ---- Money ----

export const InvoiceRow = z.object({
  id: Id,
  engagement_id: Id,
  number: z.string().regex(/^[0-9]{4}-[0-9]+$/),
  status: InvoiceStatus,
  due_on: IsoDate.nullable(),
  issued_at: Timestamp.nullable(),
  created_at: Timestamp,
});

export const InvoiceLineRow = z.object({
  id: Id,
  invoice_id: Id,
  position: z.int().positive(),
  description: text,
  quantity: z.int().positive(),
  unit_amount_cents: Cents,
  price_code: z.string().min(1).max(40).nullable(), // the package or add-on it came from (migration 006)
});

// An add-on covered by the package: named on the invoice, never charged (migration 006).
export const InvoiceIncludedRow = z.object({
  invoice_id: Id,
  price_code: z.string().min(1).max(40),
  name: text,
});

export const PaymentRow = z.object({
  id: Id,
  invoice_id: Id,
  provider: PaymentProvider,
  checkout_session_id: text.nullable(),
  payment_intent_id: text.nullable(),
  method: PaymentMethod.nullable(),
  received_on: IsoDate.nullable(),
  note: text.nullable(),
  recorded_by: Id.nullable(),
  amount_cents: Cents,
  status: PaymentStatus,
  failure_message: text.nullable(),
  created_at: Timestamp,
  updated_at: Timestamp,
});

export const WebhookReceiptRow = z.object({
  provider: WebhookProvider,
  event_id: text,
  received_at: Timestamp,
});

// ---- Practice settings (migration 003) ----

export const LetterTemplateRow = z.object({
  version: z.int().positive(),
  body: text,
  created_at: Timestamp,
  created_by: Id.nullable(),
});

// The practice's own details, one row (migration 007).
export const PracticeSettingsRow = z.object({
  id: z.literal(1),
  practice_name: text,
  preparer_name: text,
  preparer_credential: text.nullable(),
  reply_to_email: z.string().email(),
  phone: z.string().nullable(),
  city: text.nullable(),
  state: z.string().regex(/^[A-Z]{2}$/).nullable(),
  updated_at: Timestamp,
});

// Pricing (migration 006): a package per filing status, and add-ons on top. NULL price means "Included".
const PriceCode = z.string().regex(/^[a-z0-9_]{1,40}$/);
const Flag = z.union([z.literal(0), z.literal(1)]);
export const PricePackageRow = z.object({
  code: PriceCode,
  filing_status: z.enum(["single", "mfj", "mfs", "hoh"]),
  name: text,
  description: z.string(),
  unit_amount_cents: Cents,
  active: Flag,
  position: z.int().positive(),
  retired_at: Timestamp.nullable(),
  updated_at: Timestamp,
});
export const AddonTrigger = z.enum(["self_employment", "rental", "investments", "ihss", "covered_california", "other_state", "amended"]);
export type AddonTrigger = z.infer<typeof AddonTrigger>;
export const PriceAddonRow = z.object({
  code: PriceCode,
  name: text,
  description: z.string(),
  unit_amount_cents: Cents.nullable(),
  applies_when: AddonTrigger.nullable(),
  active: Flag,
  position: z.int().positive(),
  retired_at: Timestamp.nullable(),
  updated_at: Timestamp,
});

// ---- Audit ----

export const EventRow = z.object({
  id: Id,
  occurred_at: Timestamp,
  actor_kind: ActorKind,
  actor_user_id: Id.nullable(),
  household_id: Id.nullable(),
  engagement_id: Id.nullable(),
  type: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  subject_type: text,
  subject_id: text,
  reason: text.nullable(),
  data: Json,
});

// Table name → row schema. The drift test walks this map.
export const tables = {
  households: HouseholdRow,
  people: PersonRow,
  users: UserRow,
  household_access: HouseholdAccessRow,
  engagements: EngagementRow,
  return_people: ReturnPersonRow,
  intake_responses: IntakeResponseRow,
  sources: SourceRow,
  source_owners: SourceOwnerRow,
  return_sources: ReturnSourceRow,
  document_kinds: DocumentKindRow,
  requests: RequestRow,
  documents: DocumentRow,
  engagement_letters: EngagementLetterRow,
  signatures: SignatureRow,
  invoices: InvoiceRow,
  invoice_lines: InvoiceLineRow,
  invoice_included: InvoiceIncludedRow,
  payments: PaymentRow,
  webhook_receipts: WebhookReceiptRow,
  events: EventRow,
  letter_templates: LetterTemplateRow,
  price_packages: PricePackageRow,
  price_addons: PriceAddonRow,
  practice_settings: PracticeSettingsRow,
} as const;

export type TableName = keyof typeof tables;
export type Row<T extends TableName> = z.infer<(typeof tables)[T]>;
