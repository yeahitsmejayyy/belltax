import { Stage as Stages } from "@app/schema";
import { FilePlus2, ReceiptText, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ReturnHeader as Header } from "@app/ui/components/return-header";
import { daysSince } from "@app/ui/format";

import { useStageMove } from "@/components/stage-move";
import { FILING_LABEL } from "@/lib/labels";

import type { Detail } from "./shared";

// The return's header (admin 12-return-overview, top). The header is ReturnHeader from the design system; this wires
// the stage move (useStageMove and its dialog), the menu's actions and the route to the household.

export function ReturnHeader({ d, name, onRequest, onInvoice }: { d: Detail; name: string; onRequest: () => void; onInvoice: () => void }) {
  const navigate = useNavigate();
  const { request, dialog } = useStageMove();
  const at = Stages.options.indexOf(d.stage);
  const previous = at > 0 ? Stages.options[at - 1] : undefined;

  return (
    <Header
      name={name}
      subtitle={[`TY ${d.taxYear}`, d.kind === "amended" ? "Amended" : null, d.filingStatus ? FILING_LABEL[d.filingStatus] : "Filing status not set", d.household.displayName]}
      stage={d.stage}
      daysInStage={daysSince(d.stageChangedAt)}
      nextStage={d.nextStage}
      previousStage={previous}
      onMove={(to) => void request({ engagementId: d.engagementId, name, from: d.stage, to })}
      actions={[
        { id: "request", label: "Request a document…", icon: FilePlus2, onSelect: onRequest },
        { id: "invoice", label: "Create invoice…", icon: ReceiptText, onSelect: onInvoice },
        { id: "household", label: "Open household", icon: Users, onSelect: () => navigate(`/clients/${d.household.id}`) },
      ]}
      dialog={dialog}
    />
  );
}
