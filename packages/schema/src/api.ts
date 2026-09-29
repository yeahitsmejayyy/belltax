import { z } from "zod";
import {
  ActorKind,
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
} from "./enums";
import { Id, IsoDate as IsoDateString, TaxYear, Timestamp } from "./primitives";
import { AddonTrigger } from "./rows";
import { INTAKE_VERSION, IntakeAnswersV1 } from "./intake/v1";

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

// Answers are validated against the questionnaire itself (intake/v1.ts): known questions only,
// each value the right shape, partial saves allowed.
export const IntakeAnswers = IntakeAnswersV1;
export type IntakeAnswers = z.infer<typeof IntakeAnswers>;

export const INTAKE_FORM_VERSION = INTAKE_VERSION;

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
  missing: z.array(z.string()), // ids of required questions the client can see and hasn't answered
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
  included: z.array(z.string()), // add-ons covered at no charge, by name: "IHSS home care income"
  payments: z.array(
    z.object({
      id: Id,
      amountCents: z.int(),
      status: PaymentStatus,
      provider: PaymentProvider,
      method: PaymentMethod.nullable(), // manual payments: cash, check, zelle, other
      receivedOn: z.string().nullable(),
      note: z.string().nullable(),
      failureMessage: z.string().nullable(),
      createdAt: Timestamp,
    }),
  ),
});
export type InvoiceSummary = z.infer<typeof InvoiceSummary>;

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

// ---- Engagement letter ----

export const LetterCreateInput = z.object({
  // Returns this letter covers: one, or a married couple's two separate returns. Same household and year.
  engagementIds: z.array(Id).min(1).max(4),
});
export const LetterRefInput = z.object({ letterId: Id });
export const LetterVoidInput = z.object({ letterId: Id, reason: z.string().trim().min(3).max(500) });
export const LetterGetInput = EngagementRef;
export const LetterSignInput = z.object({
  letterId: Id,
  typedName: z.string().trim().min(2).max(120),
  consent: z.literal(true), // the checkbox; anything else is a 400
  bodySha256: z.string().regex(/^[0-9a-f]{64}$/), // the text the signer actually read
});

export const LetterView = z.object({
  id: Id,
  status: LetterStatus,
  householdName: z.string(),
  taxYear: TaxYear,
  templateVersion: z.int().positive(),
  body: z.string(),
  bodySha256: z.string(),
  sentAt: Timestamp.nullable(),
  engagementIds: z.array(Id),
  consentText: z.string(),
  signers: z.array(z.object({ personId: Id, name: z.string(), signedAt: Timestamp.nullable(), isMe: z.boolean() })),
  canSign: z.boolean(), // the viewer files one of these returns, the letter is out for signature, and they haven't signed
  // Preparer only: the signature record. Null for clients.
  audit: z
    .array(
      z.object({
        personId: Id,
        typedName: z.string(),
        signedAt: Timestamp,
        ip: z.string(),
        userAgent: z.string(),
        hashMatches: z.boolean(), // the signature's hash equals the letter text's hash, recomputed now
      }),
    )
    .nullable(),
});
export type LetterView = z.infer<typeof LetterView>;

// ---- Invoices and manual payments (Stripe arrives with ticket 09) ----

export const InvoiceLineInput = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.int().min(1).max(99),
  unitAmountCents: z.int().min(1).max(10_000_000),
  priceCode: z.string().regex(/^[a-z0-9_]{1,40}$/).nullable().optional(), // the package or add-on it came from
});
// A starting invoice for a return: its package, the add-ons its facts call for, and the included ones.
export const InvoiceSuggestion = z.object({
  packageCode: z.string().nullable(),
  lines: z.array(InvoiceLineInput.required({ priceCode: true })),
  included: z.array(z.object({ code: z.string(), name: z.string() })),
});
export type InvoiceSuggestion = z.infer<typeof InvoiceSuggestion>;
const IncludedCodes = z.array(z.string().regex(/^[a-z0-9_]{1,40}$/)).max(20);
export const InvoiceListInput = EngagementRef;
export const InvoiceSuggestInput = EngagementRef;
export const InvoiceCreateInput = EngagementRef.extend({
  lines: z.array(InvoiceLineInput).min(1).max(20).optional(), // omitted: the suggestion, included add-ons too
  included: IncludedCodes.optional(), // included add-ons by code; with `lines`, none unless listed
  dueOn: IsoDateString.optional(),
});
export const InvoiceUpdateLinesInput = z.object({ invoiceId: Id, lines: z.array(InvoiceLineInput).min(1).max(20), included: IncludedCodes.optional() });
export const InvoiceRefInput = z.object({ invoiceId: Id });
export const InvoiceVoidInput = z.object({ invoiceId: Id, reason: z.string().trim().min(3).max(500) });
export const PaymentRecordInput = z.object({
  invoiceId: Id,
  amountCents: z.int().min(1).max(10_000_000),
  method: PaymentMethod,
  receivedOn: IsoDateString,
  note: z.string().trim().max(500).optional(),
});

// ---- Onboarding: households, people, returns, logins (preparer) ----

const Name = z.string().trim().min(1).max(80);
const PersonFields = {
  firstName: Name,
  lastName: Name,
  middleName: Name.nullable().optional(),
  suffix: z.string().trim().max(10).nullable().optional(),
  dateOfBirth: IsoDateString.nullable().optional(),
  // Last four digits only. The portal never stores a full SSN (WISP §V.1).
  ssnLast4: z.string().regex(/^\d{4}$/, "Last four digits only").nullable().optional(),
  email: z.email().nullable().optional(),
  phone: z.string().trim().min(7).max(30).nullable().optional(),
};

export const HouseholdCreateInput = z.object({ displayName: Name });
export const HouseholdUpdateInput = z.object({ householdId: Id, displayName: Name.optional(), archived: z.boolean().optional() });
export const HouseholdListInput = z.object({ search: z.string().trim().max(100).optional(), includeArchived: z.boolean().optional() }).optional();
export const HouseholdGetInput = z.object({ householdId: Id });
// The offline copy (ticket 33): written on the practice's machine, never sent over the wire.
export const HouseholdExportInput = z.object({ householdId: Id, encrypt: z.boolean().default(false) });
export const HouseholdExportResult = z.object({ path: z.string(), encrypted: z.boolean(), documents: z.int().nonnegative(), bytes: z.int().nonnegative() });
export type HouseholdExportResult = z.infer<typeof HouseholdExportResult>;

export const PersonAddInput = z.object({
  householdId: Id,
  ...PersonFields,
  confirmDuplicate: z.boolean().optional(), // send true after the preparer has seen the possible-duplicate warning
});
export const PersonUpdateInput = z.object({
  personId: Id,
  householdId: Id.nullable().optional(), // move to another household, or out of every household
  firstName: Name.optional(),
  lastName: Name.optional(),
  middleName: PersonFields.middleName,
  suffix: PersonFields.suffix,
  dateOfBirth: PersonFields.dateOfBirth,
  ssnLast4: PersonFields.ssnLast4,
  email: PersonFields.email,
  phone: PersonFields.phone,
});

export const PersonView = z.object({
  personId: Id,
  householdId: Id.nullable(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  lastName: z.string(),
  suffix: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  ssnLast4: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  login: z.object({ userId: Id, email: z.string(), activated: z.boolean() }).nullable(),
});
export type PersonView = z.infer<typeof PersonView>;

export const HouseholdSummary = z.object({
  id: Id,
  displayName: z.string(),
  archivedAt: Timestamp.nullable(),
  members: z.int(),
  logins: z.int(),
  latestTaxYear: TaxYear.nullable(),
  lastActivityAt: Timestamp.nullable(),
});
export const HouseholdDetail = z.object({
  id: Id,
  displayName: z.string(),
  archivedAt: Timestamp.nullable(),
  members: z.array(PersonView),
  access: z.array(z.object({ grantId: Id, userId: Id, email: z.string(), name: z.string().nullable(), grantedAt: Timestamp, revokedAt: Timestamp.nullable() })),
  returns: z.array(z.object({ engagementId: Id, taxYear: TaxYear, kind: EngagementKind, stage: Stage, filingStatus: FilingStatus.nullable(), filers: z.array(z.string()) })),
});
export type HouseholdDetail = z.infer<typeof HouseholdDetail>;

export const EngagementCreateInput = z.object({
  householdId: Id,
  taxYear: TaxYear,
  kind: EngagementKind.default("original"),
  amendsId: Id.optional(), // required for amended returns; its people are copied over
});
export const EngagementSetPeopleInput = z.object({
  engagementId: Id,
  primary: Id,
  spouse: Id.optional(),
  dependents: z
    .array(z.object({ personId: Id, relationship: z.string().trim().min(1).max(40), monthsLivedWith: z.int().min(0).max(12) }))
    .max(15)
    .default([]),
});

export const LoginCreateInput = z.object({
  personId: Id,
  email: z.email(),
  grantHousehold: z.boolean().default(true), // also open their current household to them
});
export const AccessGrantInput = z.object({ userId: Id, householdId: Id });
export const AccessRevokeInput = z.object({ grantId: Id, reason: z.string().trim().min(3).max(500) });

// ---- Sources and the returning-client checklist ----

export const SourceAddInput = z.object({
  householdId: Id,
  kind: SourceKind,
  label: z.string().trim().min(1).max(120),
  owners: z.array(Id).min(1).max(4), // rule R36: every source has an owner
  firstYear: TaxYear.optional(),
});
export const SourceUpdateInput = z.object({
  sourceId: Id,
  kind: SourceKind.optional(),
  label: z.string().trim().min(1).max(120).optional(),
  lastYear: TaxYear.nullable().optional(), // null reopens a closed source
});
export const SourceCloseInput = z.object({ sourceId: Id, lastYear: TaxYear, reason: z.string().trim().max(500).optional() });
export const SourceSetOwnersInput = z.object({ sourceId: Id, owners: z.array(Id).min(1).max(4) });
export const AttachSourcesInput = z.object({ engagementId: Id, sourceIds: z.array(Id).min(1).max(30) });
export const DetachSourceInput = z.object({ engagementId: Id, sourceId: Id });
export const StartFromLastYearInput = z.object({ engagementId: Id }); // last year's original return
export const CreateExpectedInput = z.object({ engagementId: Id });
export const SourceListInput = z.object({ engagementId: Id });
// Client: "I don't have this any more." Did it still produce a document for this tax year?
export const SourceLeaveInput = z.object({
  engagementId: Id,
  sourceId: Id,
  stillExpectDocument: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export const SourceView = z.object({
  id: Id,
  kind: SourceKind,
  label: z.string(),
  owners: z.array(z.object({ personId: Id, name: z.string() })),
  firstYear: TaxYear.nullable(),
  lastYear: TaxYear.nullable(),
  onReturn: z.boolean(), // attached to this return, or only expected from last year
  expectedDocuments: z.array(z.string()), // document kinds this source usually produces
});
export type SourceView = z.infer<typeof SourceView>;

// ---- Admin inbox and activity feed ----

export const InboxKind = z.enum(["document_review", "question_answered", "letter_signed", "payment_failed", "stale"]);
export type InboxKind = z.infer<typeof InboxKind>;

export const InboxListInput = z.object({ taxYear: TaxYear.optional(), staleDays: z.int().min(1).max(90).default(7) }).optional();
export const InboxItem = z.object({
  id: z.string(), // stable per item: kind + subject id
  kind: InboxKind,
  at: Timestamp, // when it happened
  engagementId: Id,
  householdName: z.string(),
  taxYear: TaxYear,
  who: z.string(), // the person or party behind it
  summary: z.string(), // one plain sentence
  action: z.enum(["review_document", "acknowledge_answer", "advance_stage", "follow_up_payment", "open_return"]),
  subjectId: z.string(), // the document, request, letter, payment or return to act on
});
export type InboxItem = z.infer<typeof InboxItem>;
export const Inbox = z.object({
  taxYear: TaxYear.nullable(),
  items: z.array(InboxItem), // newest first
  counts: z.record(InboxKind, z.int().nonnegative()),
  total: z.int().nonnegative(),
});
export type Inbox = z.infer<typeof Inbox>;

export const RequestAcknowledgeInput = z.object({ requestId: Id });

export const ActivityListInput = z
  .object({
    householdId: Id.optional(),
    engagementId: Id.optional(),
    actorKind: ActorKind.optional(),
    typePrefix: z.string().regex(/^[a-z_]+(\.[a-z_]*)?$/).optional(), // "document." or "letter.signed"
    views: z.enum(["show", "hide", "only"]).default("show"), // reads of client data ("*.viewed"): the audit wants them, a skim doesn't
    from: Timestamp.optional(),
    to: Timestamp.optional(),
    cursor: z.object({ occurredAt: Timestamp, id: Id }).optional(), // from the previous page's `next`
    limit: z.int().min(1).max(200).default(50),
  })
  .optional();
export const ActivityItem = TimelineEvent.extend({ householdId: Id.nullable(), householdName: z.string().nullable(), engagementId: Id.nullable() });
export const ActivityPage = z.object({
  items: z.array(ActivityItem),
  next: z.object({ occurredAt: Timestamp, id: Id }).nullable(), // null on the last page
});
export type ActivityPage = z.infer<typeof ActivityPage>;

// ---- Practice settings: letter template and fee schedule (admin) ----

export const LetterTemplateView = z.object({
  current: z.object({ version: z.int().positive(), body: z.string(), createdAt: Timestamp, createdBy: z.string().nullable() }),
  versions: z.array(z.object({ version: z.int().positive(), createdAt: Timestamp, letters: z.int().nonnegative() })), // newest first
  mergeFields: z.array(z.string()),
  requiredFields: z.array(z.string()),
});
export type LetterTemplateView = z.infer<typeof LetterTemplateView>;
export const LetterTemplateBodyInput = z.object({ body: z.string().trim().min(40).max(20_000) });
export const LetterTemplatePreview = z.object({ problems: z.array(z.string()), rendered: z.string().nullable() });

// ── Invoices across the practice (ticket 39, admin 29-clients-invoices-and-activity-invoices) ──
export const InvoiceTab = z.enum(["failed", "overdue", "open", "draft", "paid", "void"]);
export type InvoiceTab = z.infer<typeof InvoiceTab>;
const InvoiceCursor = z.object({ rank: z.int().min(0).max(5), due: z.string().max(10), id: Id });
export const InvoiceAllInput = z
  .object({
    taxYear: TaxYear.optional(),
    tab: InvoiceTab.optional(), // left out: every tab, most urgent first
    cursor: InvoiceCursor.optional(), // from the previous page's `next`
    limit: z.int().min(1).max(200).default(50),
  })
  .optional();
export const InvoiceListRow = z.object({
  id: Id,
  number: z.string(),
  engagementId: Id,
  householdId: Id,
  name: z.string(), // "Dana & Sam Marigold"
  taxYear: TaxYear,
  tab: InvoiceTab,
  settlement: InvoiceSummary.shape.settlement,
  totalCents: z.int(),
  paidCents: z.int(),
  balanceCents: z.int(),
  dueOn: z.string().nullable(),
  issuedAt: Timestamp.nullable(),
  lastPayment: z
    .object({ status: PaymentStatus, amountCents: z.int(), provider: PaymentProvider, method: PaymentMethod.nullable(), failureMessage: z.string().nullable(), at: Timestamp })
    .nullable(),
});
export const InvoicePage = z.object({
  taxYear: TaxYear.nullable(),
  items: z.array(InvoiceListRow),
  next: InvoiceCursor.nullable(),
  counts: z.object({ all: z.int(), failed: z.int(), overdue: z.int(), open: z.int(), draft: z.int(), paid: z.int(), void: z.int() }), // the tabs
  outstandingCents: z.int(), // still owed on issued invoices: the header's "$2,720.00 outstanding"
});
export type InvoicePage = z.infer<typeof InvoicePage>;

// ── Dashboard (ticket 38, admin 03-dashboard-dashboard) ──
export const DashboardInput = z.object({ taxYear: TaxYear.optional() }).optional();
export const HealthCheckKey = z.enum(["failed_payments", "stale_returns", "missing_documents", "overdue_invoices", "unsigned_letters", "invites_pending", "efile_rejections", "inbox"]);
export const DashboardSummary = z.object({
  taxYear: TaxYear.nullable(),
  season: z.object({
    // "regular" until the deadline (April 15, moved off a weekend), then "extension" to October 15.
    phase: z.enum(["before", "regular", "extension", "closed"]),
    opensOn: IsoDateString,
    deadline: IsoDateString, // the deadline that applies now
    daysToDeadline: z.int(),
    day: z.int().nonnegative(), // day N of this phase
    length: z.int().positive(), // of this phase
  }),
  returns: z.object({ total: z.int(), filed: z.int(), complete: z.int(), waitingOnAuthority: z.int() }),
  money: z.object({ billedCents: z.int(), collectedCents: z.int(), outstandingCents: z.int() }),
  waitingOnYou: z.object({ total: z.int(), toPrepare: z.int(), inbox: z.int() }),
  daysInStage: z.object({ average: z.number(), over7: z.int() }),
  byStage: z.array(z.object({ stage: Stage, count: z.int(), waiting: z.enum(["client", "preparer", "authority", "done"]) })),
  filingsPerWeek: z.object({
    weeks: z.array(z.object({ weekOf: IsoDateString, thisYear: z.int(), lastYear: z.int() })), // the last 12 weeks, oldest first
    filedSoFar: z.int(),
    lastYearBySameDay: z.int(),
  }),
  billingByPackage: z.array(z.object({ code: z.string(), name: z.string(), returns: z.int(), billedCents: z.int() })),
  health: z.array(
    z.object({
      key: HealthCheckKey,
      tone: z.enum(["ok", "info", "warning", "danger"]),
      count: z.int(),
      title: z.string(), // "2 failed payments · $565.00"
      detail: z.string(), // "Dana & Sam Marigold, Remy Dovetail"
      names: z.array(z.string()).max(3),
      link: z.string(), // where Review goes, e.g. "/invoices?settlement=failed_last_attempt"
      tracked: z.boolean(), // false: nothing records this yet (e-file status, ticket 40)
    }),
  ),
  needAttention: z.int(),
});
export type DashboardSummary = z.infer<typeof DashboardSummary>;
// The app shell's sidebar counts, cheap enough for every page.
export const SidebarBadges = z.object({ pipeline: z.int(), inbox: z.int(), invoices: z.int() });

// ── Practice details (ticket 37, migration 007) ──
const digits10 = (v: string) => v.replace(/\D/g, "").length === 10;
export const PracticeView = z.object({
  practiceName: z.string(),
  preparerName: z.string(),
  preparerCredential: z.string().nullable(),
  replyToEmail: z.string(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  updatedAt: Timestamp,
});
export type PracticeView = z.infer<typeof PracticeView>;
const optional = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();
export const PracticeUpdateInput = z.object({
  practiceName: z.string().trim().min(1, "Enter the practice name.").max(80),
  preparerName: z.string().trim().min(1, "Enter the preparer's name.").max(80),
  preparerCredential: optional(80),
  replyToEmail: z.string().trim().email("Enter a valid email, like m@example.com."),
  phone: optional(20).refine((v) => v == null || digits10(v), "Enter a 10-digit US number, or leave it blank."),
  city: optional(60),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use the two-letter state, like CA.").nullable().optional().or(z.literal("").transform(() => null)),
});
// What anyone may see: the portal footer, the invite email, the marketing site. No texting number.
export const PublicPractice = PracticeView.pick({ practiceName: true, preparerName: true, preparerCredential: true, replyToEmail: true, city: true, state: true });
export type PublicPractice = z.infer<typeof PublicPractice>;

// ── Pricing: packages + add-ons (ticket 36, migration 006) ──
const PriceCode = z.string().regex(/^[a-z0-9_]{1,40}$/);
const PriceName = z.string().trim().min(1).max(80);
const PriceDescription = z.string().trim().max(160);
const PriceCents = z.int().min(1).max(10_000_000);
export const PackageFilingStatus = z.enum(["single", "mfj", "mfs", "hoh"]);

export const PackageView = z.object({
  code: PriceCode,
  filingStatus: PackageFilingStatus,
  name: z.string(),
  description: z.string(),
  unitAmountCents: z.int().positive(),
  active: z.boolean(),
  usedThisYear: z.int().nonnegative(), // returns in the chosen tax year whose invoices used it
  updatedAt: Timestamp,
});
export const AddonView = z.object({
  code: PriceCode,
  name: z.string(),
  description: z.string(),
  unitAmountCents: z.int().positive().nullable(), // null: included
  appliesWhen: AddonTrigger.nullable(),
  active: z.boolean(),
  usedThisYear: z.int().nonnegative(),
  updatedAt: Timestamp,
});
export const PricingView = z.object({ taxYear: TaxYear.nullable(), packages: z.array(PackageView), addons: z.array(AddonView) });
export type PricingView = z.infer<typeof PricingView>;
export const PricingListInput = z.object({ taxYear: TaxYear.optional() }).optional();

// New when `code` is left out (it's made from the name), otherwise an edit.
export const PackageSaveInput = z.object({
  code: PriceCode.optional(),
  filingStatus: PackageFilingStatus,
  name: PriceName,
  description: PriceDescription.default(""),
  unitAmountCents: PriceCents,
  active: z.boolean().default(true),
});
export const AddonSaveInput = z.object({
  code: PriceCode.optional(),
  name: PriceName,
  description: PriceDescription.default(""),
  unitAmountCents: PriceCents.nullable(), // null: included
  appliesWhen: AddonTrigger.nullable().default(null),
  active: z.boolean().default(true),
});
export const PriceRemoveInput = z.object({ code: PriceCode });
// Never used: deleted. Used on any invoice: retired, so what was charged still reads.
export const PriceRemoveResult = z.object({ outcome: z.enum(["deleted", "retired"]) });

// What the marketing site shows: active prices only, no usage.
export const PublicPricing = z.object({
  packages: z.array(PackageView.pick({ code: true, filingStatus: true, name: true, description: true, unitAmountCents: true })),
  addons: z.array(AddonView.pick({ code: true, name: true, description: true, unitAmountCents: true })),
});
export type PublicPricing = z.infer<typeof PublicPricing>;

// ── New-season rollover (ticket 34) ──
// Every completed original return from `fromYear` becomes a new return for the next year, with the same
// people and still-open sources, and its day-one checklist. Preview and rollover share one plan.
export const SeasonPreviewInput = z.object({ fromYear: TaxYear });
export const SeasonRolloverInput = z.object({ fromYear: TaxYear, householdIds: z.array(Id).min(1).max(5000).optional() });
const SeasonItemBase = z.object({ householdId: Id, householdName: z.string(), fromEngagementId: Id, filers: z.array(z.string()) });
export const SeasonPlanItem = SeasonItemBase.extend({
  action: z.enum(["create", "skip"]),
  reason: z.string().nullable(), // why it's skipped
  people: z.int().nonnegative(), // who'll be on the new return
  dependentsLeft: z.array(z.string()), // last year's dependents who won't be (moved, or claimed on another return)
  sourcesToCarry: z.int().nonnegative(),
});
export type SeasonPlanItem = z.infer<typeof SeasonPlanItem>;
export const SeasonPreview = z.object({ fromYear: TaxYear, toYear: TaxYear, items: z.array(SeasonPlanItem) });
export type SeasonPreview = z.infer<typeof SeasonPreview>;
export const SeasonReport = z.object({
  fromYear: TaxYear,
  toYear: TaxYear,
  created: z.array(SeasonItemBase.extend({ engagementId: Id, people: z.int(), dependentsLeft: z.array(z.string()), sourcesCarried: z.int(), requestsCreated: z.int() })),
  skipped: z.array(SeasonItemBase.extend({ reason: z.string() })),
  failed: z.array(SeasonItemBase.extend({ error: z.string() })),
});
export type SeasonReport = z.infer<typeof SeasonReport>;
