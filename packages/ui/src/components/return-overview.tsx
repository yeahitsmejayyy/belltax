import type { Stage } from "@app/schema";
import { CheckCircle2, CircleDashed, FilePlus2 } from "lucide-react";
import type * as React from "react";

import { formatDate } from "../format";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Money } from "./money";
import { STAGE_META } from "./stage-pill";
import { DocumentChip, InvoiceChip, StatusChip, type DocumentChipStatus, type InvoiceChipStatus } from "./status-chip";

// A return's Overview tab (admin 12-return-detail-return-overview), the pieces apps/admin renders and Storybook shows
// (ticket 59): what stands between this return and its next stage, in the server's words, then open requests, the
// invoice and who's on the return. The E-file card (EfileCard) comes first once it's filed. Data in, actions out.

/** What's still holding the return in its stage, in the server's words; with nothing left, "Ready to move on". */
export function ChecklistCard({ stage, nextStage, blockers }: { stage: Stage; nextStage?: Stage | null; blockers: readonly string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist</CardTitle>
        <CardDescription>{nextStage ? `What's needed before it moves to ${STAGE_META[nextStage].label}.` : "This return is complete."}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4">
          {nextStage && blockers.length === 0 ? (
            <li className="flex items-start gap-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">Ready to move on</span>
                <span className="text-sm text-muted-foreground">Nothing is holding it in {STAGE_META[stage].label}.</span>
              </div>
            </li>
          ) : null}
          {blockers.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <CircleDashed aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <span className="text-sm">
                <span className="sr-only">Still open: </span>
                {b}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * One open request. `who` is a first name or "Household". A document request shows its latest upload's status
 * (`documentStatus`, "needed" before any); `rejectReason` is set when that upload was rejected. A question shows
 * whether it's been answered (`response`).
 */
export type OpenRequest = {
  id: string;
  title: string;
  who: string;
  kind: "document" | "question";
  documentStatus: DocumentChipStatus;
  rejectReason: string | null;
  response: string | null;
  createdAt: string;
};

/** What's been asked for and hasn't come in, with the way to ask for more. */
export function OpenRequestsCard({ requests, onRequest }: { requests: readonly OpenRequest[]; onRequest: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open requests</CardTitle>
        <CardAction>
          <Button variant="outline" onClick={onRequest}>
            <FilePlus2 /> Request a document
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {requests.length ? (
          <ul className="grid gap-4">
            {requests.map((r) => (
              <li key={r.id} className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {r.title} · {r.who}
                  </span>
                  {r.kind === "document" ? (
                    <DocumentChip status={r.documentStatus} />
                  ) : (
                    <StatusChip tone={r.response ? "brand" : "neutral"} icon={r.response ? CheckCircle2 : CircleDashed} label={r.response ? "Answered" : "Question"} />
                  )}
                </div>
                {r.rejectReason ? (
                  <p className="text-sm text-muted-foreground">You rejected it: “{r.rejectReason}”</p>
                ) : r.response ? (
                  <p className="text-sm text-muted-foreground">“{r.response}”</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Requested {formatDate(r.createdAt, { month: "short", day: "numeric" })}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing open. Everything asked for has come in.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** The invoice in brief: the return's current (not void) invoice. */
export type InvoiceSummary = { totalCents: number; settlement: InvoiceChipStatus; number: string };

/** The current invoice's total, state and number, or that there's none yet; both lead to Billing. */
export function InvoiceSummaryCard({ invoice: inv, onBilling }: { invoice: InvoiceSummary | null | undefined; onBilling: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {inv ? (
          <>
            <Money cents={inv.totalCents} className="text-2xl font-semibold" />
            <InvoiceChip status={inv.settlement} />
            <span className="font-mono text-sm text-muted-foreground">{inv.number}</span>
            <Button variant="outline" className="ml-auto" onClick={onBilling}>
              View billing
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">No invoice yet.</span>
            <Button variant="outline" className="ml-auto" onClick={onBilling}>
              Open billing
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export type ReturnPersonRole = "primary" | "spouse" | "dependent";
export const ROLE_LABEL: Record<ReturnPersonRole, string> = { primary: "Primary", spouse: "Spouse", dependent: "Dependent" };

/** Someone on the return. `age` is shown for dependents only; the SSN shows its last four only. */
export type ReturnPerson = {
  personId: string;
  firstName: string;
  lastName: string;
  role: ReturnPersonRole;
  relationship: string | null;
  age: number | null;
  ssnLast4: string | null;
};

/** Who's on the return: filers and dependents. */
export function ReturnPeopleCard({ people }: { people: readonly ReturnPerson[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Household</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4">
          {people.map((p) => {
            const age = p.role === "dependent" ? p.age : null;
            return (
              <li key={p.personId} className="flex items-center justify-between gap-3">
                <div className="grid gap-0.5">
                  <span className="text-sm font-medium">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {[ROLE_LABEL[p.role], p.relationship, age !== null ? `age ${age}` : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {p.ssnLast4 ? (
                    <span className="font-mono text-sm text-muted-foreground" aria-label={`SSN ending ${p.ssnLast4}`}>
                      •••-••-{p.ssnLast4}
                    </span>
                  ) : null}
                  {p.role !== "dependent" ? <Badge variant="outline">Filer</Badge> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export type ReturnOverviewProps = {
  stage: Stage;
  nextStage?: Stage | null;
  blockers: readonly string[];
  /** The open ones only. */
  requests: readonly OpenRequest[];
  invoice: InvoiceSummary | null | undefined;
  people: readonly ReturnPerson[];
  /** The E-file card, shown first once the return is filed. */
  efile?: React.ReactNode;
  onRequest: () => void;
  onBilling: () => void;
};

/** The Overview tab: E-file (once filed) and the checklist on the left; requests, invoice and household on the right. */
export function ReturnOverview({ stage, nextStage, blockers, requests, invoice, people, efile, onRequest, onBilling }: ReturnOverviewProps) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="grid gap-4">
        {efile ?? null}
        <ChecklistCard stage={stage} nextStage={nextStage} blockers={blockers} />
      </div>
      <div className="grid gap-4">
        <OpenRequestsCard requests={requests} onRequest={onRequest} />
        <InvoiceSummaryCard invoice={invoice} onBilling={onBilling} />
        <ReturnPeopleCard people={people} />
      </div>
    </div>
  );
}
