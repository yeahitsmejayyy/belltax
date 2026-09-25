import type { Stage } from "@app/schema";
import { CircleDollarSign, FileWarning } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { StagePill } from "./stage-pill";

// The pipeline board (admin 05-pipeline-pipeline-board): a column per stage with a count, and a card per
// return showing filing status, missing documents, the unpaid flag and days in stage.

export function BoardColumn({ stage, count, children, className }: { stage: Stage; count: number; children: React.ReactNode; className?: string }) {
  return (
    <section data-slot="board-column" aria-label={`${stage}: ${count}`} className={cn("flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/60 p-2", className)}>
      <header className="flex items-center justify-between px-1 py-1">
        <StagePill stage={stage} />
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{count}</span>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

type BoardCardProps = {
  household: string;
  filers: string;
  filingStatus?: string | null;
  missingDocuments?: number;
  unpaid?: boolean;
  daysInStage: number;
  staleAfterDays?: number;
  onOpen?: () => void;
};

export function BoardCard({ household, filers, filingStatus, missingDocuments = 0, unpaid, daysInStage, staleAfterDays = 7, onOpen }: BoardCardProps) {
  const stale = daysInStage > staleAfterDays;
  return (
    <button
      type="button"
      data-slot="board-card"
      onClick={onOpen}
      className="grid gap-2 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:border-ring/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="grid gap-0.5">
        <span className="text-sm font-semibold">{household}</span>
        <span className="text-xs text-muted-foreground">{filers}{filingStatus ? ` · ${filingStatus}` : ""}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {missingDocuments > 0 ? (
          <span className="inline-flex items-center gap-1 text-warning-foreground">
            <FileWarning aria-hidden="true" className="size-3.5" /> {missingDocuments} missing
          </span>
        ) : null}
        {unpaid ? (
          <span className="inline-flex items-center gap-1 text-danger-foreground">
            <CircleDollarSign aria-hidden="true" className="size-3.5" /> Unpaid
          </span>
        ) : null}
        <span className={cn("ml-auto tabular-nums", stale ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
          {daysInStage === 1 ? "1 day" : `${daysInStage} days`}
        </span>
      </div>
    </button>
  );
}
