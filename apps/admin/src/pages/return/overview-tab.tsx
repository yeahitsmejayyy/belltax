import { ReturnOverview } from "@app/ui/components/return-overview";

import { EfileCard } from "./efile-card";
import { ageFrom, whoFor, type Detail } from "./shared";

// Overview (admin 12-return-detail-return-overview): what stands between this return and its next stage, then open
// requests, the invoice and who's on the return; E-file once it's filed. The tab is ReturnOverview from the design
// system; this maps the return's detail onto it.

export function OverviewTab({ d, onRequest, onBilling }: { d: Detail; onRequest: () => void; onBilling: () => void }) {
  const showEfile = d.stage === "filed" || d.stage === "complete";
  return (
    <ReturnOverview
      stage={d.stage}
      nextStage={d.nextStage}
      blockers={d.blockers}
      requests={d.requests
        .filter((r) => r.status === "open")
        .map((r) => ({
          id: r.id,
          title: r.title,
          who: whoFor(d, r.personId),
          kind: r.kind,
          documentStatus: r.latestDocument?.status ?? "needed",
          rejectReason: r.latestDocument?.status === "rejected" ? r.latestDocument.rejectReason || null : null,
          response: r.response,
          createdAt: r.createdAt,
        }))}
      invoice={d.invoices.find((i) => i.status !== "void")}
      people={d.people.map((p) => ({ ...p, age: p.role === "dependent" ? ageFrom(p.dateOfBirth) : null }))}
      efile={showEfile ? <EfileCard d={d} /> : null}
      onRequest={onRequest}
      onBilling={onBilling}
    />
  );
}
