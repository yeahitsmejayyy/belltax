import { z } from "zod";
import {
  ActorKind,
  DocumentStatus,
  EngagementKind,
  FilingStatus,
  InvoiceStatus,
  LetterStatus,
  PaymentStatus,
  RequestKind,
  RequestStatus,
  ReturnRole,
  SourceKind,
  Stage,
} from "./enums";
import { Id, TaxYear, Timestamp } from "./primitives";

// Shapes that cross the wire. The server validates outputs against these, so the web app can trust them.

export const EngagementListInput = z
  .object({
    taxYear: TaxYear.optional(),
    stage: Stage.optional(),
    search: z.string().trim().max(100).optional(),
  })
  .optional();
export type EngagementListInput = z.infer<typeof EngagementListInput>;

export const PipelineRow = z.object({
  engagementId: Id,
  householdId: Id,
  householdName: z.string(),
  taxYear: TaxYear,
  kind: EngagementKind,
  filingStatus: FilingStatus.nullable(),
  stage: Stage,
  stageChangedAt: Timestamp,
  daysInStage: z.int().nonnegative(),
  filers: z.array(z.string()),
  openRequests: z.int().nonnegative(),
  balanceCents: z.int(),
  complexity: z.enum(["simple", "involved"]),
});
export type PipelineRow = z.infer<typeof PipelineRow>;

export const EngagementList = z.object({
  taxYear: TaxYear.nullable(),
  years: z.array(TaxYear), // newest first, for the tax year switcher
  counts: z.record(Stage, z.int().nonnegative()), // per stage, before the stage filter: the board's column headers
  rows: z.array(PipelineRow), // board order: by stage, then longest-waiting first
});
export type EngagementList = z.infer<typeof EngagementList>;

// ---- Client side: intake, requests, documents ----

const EngagementRef = z.object({ engagementId: Id });

// The questionnaire itself is designed with the portal UI; until then answers are a bounded JSON object.
export const IntakeAnswers = z
  .record(z.string().min(1).max(64), z.json())
  .refine((a) => JSON.stringify(a).length <= 64_000, "Answers are too large.");
export type IntakeAnswers = z.infer<typeof IntakeAnswers>;

export const INTAKE_FORM_VERSION = 1;

export const IntakeGetInput = EngagementRef;
export const IntakeSaveInput = EngagementRef.extend({
  answers: IntakeAnswers, // merged over what's saved, so each step can send only its own fields
  submit: z.boolean().optional(),
});
export const IntakeView = z.object({
  engagementId: Id,
  formVersion: z.int().positive(),
  answers: IntakeAnswers,
  updatedAt: Timestamp,
  submittedAt: Timestamp.nullable(),
});
export type IntakeView = z.infer<typeof IntakeView>;

export const DocumentView = z.object({
  id: Id,
  engagementId: Id.nullable(),
  personId: Id.nullable(),
  requestId: Id.nullable(),
  kind: z.string(),
  kindLabel: z.string(),
  status: DocumentStatus,
  rejectReason: z.string().nullable(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.int().positive(),
  uploadedAt: Timestamp,
  mine: z.boolean(), // uploaded by the signed-in user (and so deletable while unreviewed)
});
export type DocumentView = z.infer<typeof DocumentView>;

export const RequestView = z.object({
  id: Id,
  kind: RequestKind,
  documentKind: z.string().nullable(),
  title: z.string(),
  note: z.string().nullable(),
  response: z.string().nullable(),
  status: RequestStatus,
  personId: Id.nullable(),
  createdAt: Timestamp,
  latestDocument: DocumentView.nullable(), // newest upload against this request, if any
});
export type RequestView = z.infer<typeof RequestView>;

export const RequestListInput = EngagementRef;
export const RequestAnswerInput = z.object({ requestId: Id, response: z.string().trim().min(1).max(2000) });
export const DocumentListInput = EngagementRef;
export const DocumentDeleteInput = z.object({ documentId: Id });

// Upload is multipart on POST /api/documents (the REST escape hatch: tRPC isn't built for files).
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const UPLOAD_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"] as const;

// A client's own returns, across households and years (filer path + grants). Drives the portal home.
export const MyEngagement = z.object({
  engagementId: Id,
  householdName: z.string(),
  taxYear: TaxYear,
  kind: EngagementKind,
  filingStatus: FilingStatus.nullable(),
  stage: Stage,
  via: z.enum(["filer", "grant"]),
  openRequests: z.int().nonnegative(),
  balanceCents: z.int(),
});
export type MyEngagement = z.infer<typeof MyEngagement>;

// ---- Preparer: one return in full, stage moves, requests, review ----

export const EngagementDetailInput = EngagementRef;

export const ReturnPerson = z.object({
  personId: Id,
  firstName: z.string(),
  lastName: z.string(),
  role: ReturnRole,
  relationship: z.string().nullable(),
  monthsLivedWith: z.int().nullable(),
  dateOfBirth: z.string().nullable(),
  ssnLast4: z.string().nullable(), // last four only, ever
  hasLogin: z.boolean(),
});

export const LetterSummary = z.object({
  id: Id,
  status: LetterStatus,
  sentAt: Timestamp.nullable(),
  signers: z.array(z.object({ personId: Id, name: z.string(), signedAt: Timestamp.nullable() })),
});

export const InvoiceSummary = z.object({
  id: Id,
  number: z.string(),
  status: InvoiceStatus,
  settlement: z.enum(["draft", "void", "unpaid", "partial", "paid", "failed_last_attempt"]),
  totalCents: z.int(),
  paidCents: z.int(),
  balanceCents: z.int(),
  dueOn: z.string().nullable(),
  lines: z.array(z.object({ description: z.string(), quantity: z.int(), unitAmountCents: z.int() })),
  payments: z.array(z.object({ id: Id, amountCents: z.int(), status: PaymentStatus, failureMessage: z.string().nullable(), createdAt: Timestamp })),
});

export const TimelineEvent = z.object({
  id: Id,
  occurredAt: Timestamp,
  type: z.string(), // e.g. document.uploaded — the UI turns it into words
  actorKind: ActorKind,
  actorName: z.string(), // "Dana Reyes", "Preparer", "Stripe", "System"
  subjectType: z.string(),
  subjectId: z.string(),
  reason: z.string().nullable(),
});

export const EngagementDetail = z.object({
  engagementId: Id,
  household: z.object({ id: Id, displayName: z.string() }),
  taxYear: TaxYear,
  kind: EngagementKind,
  amendsId: Id.nullable(),
  filingStatus: FilingStatus.nullable(),
  stage: Stage,
  stageChangedAt: Timestamp,
  nextStage: Stage.nullable(),
  blockers: z.array(z.string()), // why it can't move to nextStage yet; empty = it can
  people: z.array(ReturnPerson),
  sources: z.array(z.object({ id: Id, kind: SourceKind, label: z.string() })),
  intake: IntakeView.nullable(),
  requests: z.array(RequestView),
  documents: z.array(DocumentView),
  letter: LetterSummary.nullable(),
  invoices: z.array(InvoiceSummary),
  timeline: z.array(TimelineEvent), // newest first
});
export type EngagementDetail = z.infer<typeof EngagementDetail>;

// Forward moves go one stage at a time and must pass the gate; backward moves need a reason.
export const AdvanceStageInput = EngagementRef.extend({
  to: Stage,
  reason: z.string().trim().min(3).max(500).optional(),
});
export const SetFilingStatusInput = EngagementRef.extend({ filingStatus: FilingStatus });

export const RequestCreateInput = z.discriminatedUnion("kind", [
  EngagementRef.extend({
    kind: z.literal("document"),
    documentKind: z.string().regex(/^[a-z0-9_]+$/),
    personId: Id.optional(),
    sourceId: Id.optional(),
    title: z.string().trim().min(1).max(200).optional(), // defaults to "Upload your <form>"
    note: z.string().trim().max(1000).optional(),
  }),
  EngagementRef.extend({
    kind: z.literal("question"),
    title: z.string().trim().min(1).max(200),
    note: z.string().trim().max(1000).optional(),
    personId: Id.optional(),
  }),
]);
export const RequestCancelInput = z.object({ requestId: Id, reason: z.string().trim().min(3).max(500) });

export const DocumentReviewInput = z.discriminatedUnion("decision", [
  z.object({ documentId: Id, decision: z.literal("accept") }),
  z.object({ documentId: Id, decision: z.literal("reject"), reason: z.string().trim().min(3).max(500) }),
]);
