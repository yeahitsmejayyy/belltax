import { Stage as Stages } from "@app/schema";
import { ArrowRight, Clock, FilePlus2, MoreHorizontal, ReceiptText, Undo2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@app/ui/components/dropdown-menu";
import { StagePill } from "@app/ui/components/stage-pill";
import { StatusChip } from "@app/ui/components/status-chip";
import { daysSince } from "@app/ui/format";

import { useStageMove } from "@/components/stage-move";
import { FILING_LABEL, stageLabel } from "@/lib/labels";

import type { Detail } from "./shared";

// The return's header (admin 12-return-overview, top): who, which year, where it stands, and the one thing to do
// next. Moving back and the other secondary actions sit in the ⋯ menu.

export function ReturnHeader({ d, name, onRequest, onInvoice }: { d: Detail; name: string; onRequest: () => void; onInvoice: () => void }) {
  const navigate = useNavigate();
  const { request, dialog } = useStageMove();
  const days = daysSince(d.stageChangedAt);
  const at = Stages.options.indexOf(d.stage);
  const previous = at > 0 ? Stages.options[at - 1] : undefined;
  const move = (to: Detail["stage"]) => request({ engagementId: d.engagementId, name, from: d.stage, to });

  const subtitle = [
    `TY ${d.taxYear}`,
    d.kind === "amended" ? "Amended" : null,
    d.filingStatus ? FILING_LABEL[d.filingStatus] : "Filing status not set",
    d.household.displayName,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid min-w-0 gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">{subtitle.join(" · ")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StagePill stage={d.stage} />
          <StatusChip tone={days > 7 ? "warning" : "neutral"} icon={Clock} label={`${days} day${days === 1 ? "" : "s"} in stage`} />
        </div>
      </div>

      <div className="flex items-center gap-2 max-sm:w-full">
        {d.nextStage ? (
          <Button className="max-sm:h-11 max-sm:flex-1" onClick={() => move(d.nextStage!)}>
            Advance to {stageLabel(d.nextStage)} <ArrowRight />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="max-sm:size-11" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!previous} onSelect={() => previous && move(previous)}>
              <Undo2 /> {previous ? `Move back to ${stageLabel(previous)}…` : "Move back…"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRequest}>
              <FilePlus2 /> Request a document…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onInvoice}>
              <ReceiptText /> Create invoice…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/clients/${d.household.id}`)}>
              <Users /> Open household
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {dialog}
    </div>
  );
}
