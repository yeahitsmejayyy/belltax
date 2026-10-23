import type { Stage } from "@app/schema";
import { ArrowRight, Clock, MoreHorizontal, Undo2, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu";
import { STAGE_META, StagePill } from "./stage-pill";
import { StatusChip } from "./status-chip";

// The return's header (admin 12-return-overview, top), the piece apps/admin renders and Storybook shows (ticket 59):
// who, which year, where it stands, and the one thing to do next. Moving back and the other secondary actions sit in
// the ⋯ menu, a config array. Moves go out through `onMove`; the app asks to confirm (StageMoveDialog, via `dialog`).

/** One item in the ⋯ menu, after "Move back…". */
export type ReturnHeaderAction = { id: string; label: string; icon: LucideIcon; onSelect: () => void; disabled?: boolean };

export type ReturnHeaderProps = {
  /** The filers, as the page's title. */
  name: string;
  /** The facts under the title, joined with " · "; empty ones are left out. */
  subtitle: readonly (string | null | undefined | false)[];
  stage: Stage;
  /** Whole days since the stage last changed. */
  daysInStage: number;
  /** Past this many days the chip turns to a warning. */
  staleAfterDays?: number;
  /** The stage it moves to next (the primary action); none once it's complete. */
  nextStage?: Stage | null;
  /** The stage before this one, for "Move back…"; none at the first. */
  previousStage?: Stage | null;
  onMove: (to: Stage) => void;
  actions?: readonly ReturnHeaderAction[];
  /** The move's confirmation dialog, rendered with the header. */
  dialog?: React.ReactNode;
};

export function ReturnHeader({ name, subtitle, stage, daysInStage: days, staleAfterDays = 7, nextStage, previousStage: previous, onMove, actions = [], dialog }: ReturnHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid min-w-0 gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">{subtitle.filter(Boolean).join(" · ")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StagePill stage={stage} />
          <StatusChip tone={days > staleAfterDays ? "warning" : "neutral"} icon={Clock} label={`${days} day${days === 1 ? "" : "s"} in stage`} />
        </div>
      </div>

      <div className="flex items-center gap-2 max-sm:w-full">
        {nextStage ? (
          <Button className="max-sm:h-11 max-sm:flex-1" onClick={() => onMove(nextStage)}>
            Advance to {STAGE_META[nextStage].label} <ArrowRight />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="max-sm:size-11" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!previous} onSelect={() => previous && onMove(previous)}>
              <Undo2 /> {previous ? `Move back to ${STAGE_META[previous].label}…` : "Move back…"}
            </DropdownMenuItem>
            {actions.length ? <DropdownMenuSeparator /> : null}
            {actions.map((a) => (
              <DropdownMenuItem key={a.id} disabled={a.disabled} onSelect={a.onSelect}>
                <a.icon /> {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {dialog}
    </div>
  );
}
