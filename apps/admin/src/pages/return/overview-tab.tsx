import { CheckCircle2, CircleDashed, FilePlus2 } from "lucide-react";

import { Badge } from "@app/ui/components/badge";
import { Button } from "@app/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Money } from "@app/ui/components/money";
import { DocumentChip, InvoiceChip, StatusChip } from "@app/ui/components/status-chip";
import { formatDate } from "@app/ui/format";

import { stageLabel } from "@/lib/labels";

import { EfileCard } from "./efile-card";
import { ageFrom, ROLE_LABEL, whoFor, type Detail } from "./shared";

// Overview (admin 12-return-detail-return-overview): what stands between this return and its next stage, in
// the server's words, then open requests, the invoice and who's on the return. E-file once it's filed.

function Checklist({ d }: { d: Detail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist</CardTitle>
        <CardDescription>{d.nextStage ? `What's needed before it moves to ${stageLabel(d.nextStage)}.` : "This return is complete."}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4">
          {d.nextStage && d.blockers.length === 0 ? (
            <li className="flex items-start gap-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">Ready to move on</span>
                <span className="text-sm text-muted-foreground">Nothing is holding it in {stageLabel(d.stage)}.</span>
              </div>
            </li>
          ) : null}
          {d.blockers.map((b) => (
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

function OpenRequests({ d, onRequest }: { d: Detail; onRequest: () => void }) {
  const open = d.requests.filter((r) => r.status === "open");
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
        {open.length ? (
          <ul className="grid gap-4">
            {open.map((r) => (
              <li key={r.id} className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {r.title} · {whoFor(d, r.personId)}
                  </span>
                  {r.kind === "document" ? (
                    <DocumentChip status={r.latestDocument?.status ?? "needed"} />
                  ) : (
                    <StatusChip tone={r.response ? "brand" : "neutral"} icon={r.response ? CheckCircle2 : CircleDashed} label={r.response ? "Answered" : "Question"} />
                  )}
                </div>
                {r.latestDocument?.status === "rejected" && r.latestDocument.rejectReason ? (
                  <p className="text-sm text-muted-foreground">You rejected it: “{r.latestDocument.rejectReason}”</p>
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

function InvoiceCard({ d, onBilling }: { d: Detail; onBilling: () => void }) {
  const inv = d.invoices.find((i) => i.status !== "void");
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

function Household({ d }: { d: Detail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Household</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4">
          {d.people.map((p) => {
            const age = p.role === "dependent" ? ageFrom(p.dateOfBirth) : null;
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

export function OverviewTab({ d, onRequest, onBilling }: { d: Detail; onRequest: () => void; onBilling: () => void }) {
  const showEfile = d.stage === "filed" || d.stage === "complete";
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="grid gap-4">
        {showEfile ? <EfileCard d={d} /> : null}
        <Checklist d={d} />
      </div>
      <div className="grid gap-4">
        <OpenRequests d={d} onRequest={onRequest} />
        <InvoiceCard d={d} onBilling={onBilling} />
        <Household d={d} />
      </div>
    </div>
  );
}
