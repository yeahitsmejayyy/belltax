import type { EfileState, Stage } from "@app/schema";

import type { Answers } from "../components/intake";
import type { ReturnEvent } from "../components/return-activity";
import type { ReturnIntakeData } from "../components/return-intake";
import type { InvoiceSummary, OpenRequest, ReturnPerson } from "../components/return-overview";
import { DEMO_ANSWERS, DEMO_ANSWERS_DONE, DEMO_SECTIONS } from "./portal-intake.fixtures";

// Invented data for the Admin/Return stories (ticket 59): one return of the Bell Tax practice, prepared by Morgan Hale.
// Nothing here is real: invented names, .test emails, SSN last four starting with 9.

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** The return's facts the header and the checklist need, the way the admin maps engagement.detail onto them. */
export type ReturnFixture = {
  name: string;
  subtitle: string[];
  stage: Stage;
  nextStage: Stage | null;
  previousStage: Stage | null;
  daysInStage: number;
  blockers: string[];
};

export const RETURN_PREPARING: ReturnFixture = {
  name: "Dana & Sam Marigold",
  subtitle: ["TY 2026", "Married filing jointly", "Marigold household"],
  stage: "preparing",
  nextStage: "review",
  previousStage: "ready",
  daysInStage: 3,
  blockers: ["The engagement letter isn't signed yet.", "1 requested document hasn't been accepted."],
};

export const RETURN_READY: ReturnFixture = { ...RETURN_PREPARING, stage: "documents", nextStage: "ready", previousStage: "intake", daysInStage: 12, blockers: [] };

export const RETURN_FILED: ReturnFixture = {
  name: "Sidney Kestrel",
  subtitle: ["TY 2026", "Amended", "Single", "Kestrel household"],
  stage: "filed",
  nextStage: "complete",
  previousStage: "review",
  daysInStage: 1,
  blockers: ["The state return hasn't been accepted yet."],
};

export const RETURN_COMPLETE: ReturnFixture = { ...RETURN_FILED, stage: "complete", nextStage: null, previousStage: "filed", daysInStage: 9, blockers: [] };

export const OPEN_REQUESTS: OpenRequest[] = [
  { id: "rq-w2", title: "W-2 from Larkspur Bakery", who: "Dana", kind: "document", documentStatus: "rejected", rejectReason: "The second page is cut off.", response: null, createdAt: daysAgo(9) },
  { id: "rq-1099", title: "1099-NEC", who: "Sam", kind: "document", documentStatus: "uploaded", rejectReason: null, response: null, createdAt: daysAgo(5) },
  { id: "rq-1098", title: "Mortgage interest (1098)", who: "Household", kind: "document", documentStatus: "needed", rejectReason: null, response: null, createdAt: daysAgo(4) },
  { id: "rq-move", title: "Did you move this year?", who: "Household", kind: "question", documentStatus: "needed", rejectReason: null, response: "No, same address as last year.", createdAt: daysAgo(3) },
  { id: "rq-hsa", title: "Any HSA contributions?", who: "Sam", kind: "question", documentStatus: "needed", rejectReason: null, response: null, createdAt: daysAgo(2) },
];

export const INVOICE: InvoiceSummary = { totalCents: 42_500, settlement: "unpaid", number: "BT-2026-0042" };
export const INVOICE_FAILED: InvoiceSummary = { ...INVOICE, settlement: "failed_last_attempt" };

export const PEOPLE: ReturnPerson[] = [
  { personId: "p-dana", firstName: "Dana", lastName: "Marigold", role: "primary", relationship: null, age: null, ssnLast4: "9012" },
  { personId: "p-sam", firstName: "Sam", lastName: "Marigold", role: "spouse", relationship: null, age: null, ssnLast4: "9345" },
  { personId: "p-juniper", firstName: "Juniper", lastName: "Marigold", role: "dependent", relationship: "Daughter", age: 7, ssnLast4: "9678" },
];

export const PEOPLE_SINGLE: ReturnPerson[] = [{ personId: "p-sidney", firstName: "Sidney", lastName: "Kestrel", role: "primary", relationship: null, age: null, ssnLast4: "9901" }];

const never: Omit<EfileState, "jurisdiction"> = { status: null, submittedAt: null, decidedAt: null, rejectionCode: null, rejectionNote: null, attempts: 0 };

/** Federal waiting for an answer, state rejected once. */
export const EFILE_MIXED: EfileState[] = [
  { ...never, jurisdiction: "federal", status: "submitted", submittedAt: daysAgo(1), attempts: 1 },
  { ...never, jurisdiction: "state", status: "rejected", submittedAt: daysAgo(2), decidedAt: daysAgo(1), rejectionCode: "F540-001-03", rejectionNote: "Prior-year AGI doesn't match.", attempts: 1 },
];
export const EFILE_NONE: EfileState[] = [
  { ...never, jurisdiction: "federal" },
  { ...never, jurisdiction: "state" },
];
export const EFILE_ACCEPTED: EfileState[] = [
  { ...never, jurisdiction: "federal", status: "accepted", submittedAt: daysAgo(12), decidedAt: daysAgo(11), attempts: 1 },
  { ...never, jurisdiction: "state", status: "accepted", submittedAt: daysAgo(12), decidedAt: daysAgo(9), attempts: 2 },
];

export const INTAKE_SECTIONS = DEMO_SECTIONS;
const intake = (answers: Answers, submittedAt: string | null, missing: string[]): ReturnIntakeData => ({ formVersion: 1, answers, updatedAt: daysAgo(2), submittedAt, missing });
export const INTAKE_SUBMITTED = intake(DEMO_ANSWERS_DONE, daysAgo(2), []);
export const INTAKE_DRAFT = intake(DEMO_ANSWERS, null, ["gig_kind"]);

const event = (n: number, type: string, actor: string, reason: string | null = null): ReturnEvent => ({ id: `ev-${n}`, type, actor, at: daysAgo(n / 2), reason });
export const EVENTS: ReturnEvent[] = [
  event(1, "engagement.stage_changed", "Morgan Hale"),
  event(2, "document.rejected", "Morgan Hale", "The second page is cut off."),
  event(3, "document.uploaded", "Dana Marigold"),
  event(4, "request.answered", "Dana Marigold"),
  event(5, "letter.sent", "Morgan Hale"),
  event(6, "intake.submitted", "Sam Marigold"),
];
export const OLDER_EVENTS: ReturnEvent[] = [
  event(8, "engagement.stage_changed", "Morgan Hale", "Undone: moved by mistake."),
  event(9, "engagement.people_set", "Morgan Hale"),
  event(10, "custom.imported", "System"),
  event(11, "engagement.created", "Morgan Hale"),
];
