import { Stage } from "@app/schema";
import { Check } from "lucide-react";
import type * as React from "react";

import { formatDateTime } from "../format";
import { cn } from "../utils";
import { STAGE_META } from "./stage-pill";

// Two timelines. Activity: the audit trail, newest first (admin 18-return-activity, 30-activity).
// Progress: where a return stands, for the client (portal 05-home).

export function ActivityTimeline({ items, className }: { items: { id: string; at: string; actor: string; text: React.ReactNode; reason?: string | null }[]; className?: string }) {
  return (
    <ol data-slot="activity-timeline" className={cn("relative grid gap-4 border-l pl-5", className)}>
      {items.map((i) => (
        <li key={i.id} className="relative grid gap-0.5">
          <span aria-hidden="true" className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-muted-foreground" />
          <span className="text-sm">
            <span className="font-medium">{i.actor}</span> {i.text}
          </span>
          {i.reason ? <span className="text-sm text-muted-foreground">“{i.reason}”</span> : null}
          <time dateTime={i.at} className="text-xs text-muted-foreground">
            {formatDateTime(i.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

// The client's view uses plain words for each stage; the preparer's labels stay in StagePill.
export const CLIENT_STAGE_WORDS: Record<Stage, string> = {
  invited: "You're invited",
  intake: "Tell us about your year",
  documents: "Send your documents",
  ready: "We have what we need",
  preparing: "We're preparing your return",
  review: "Review and approve",
  filed: "Filed, waiting on the IRS and FTB",
  complete: "Done",
};

/** `words` replaces any stage's wording (say, the state's tax agency for a practice outside California). */
export function StageTimeline({ stage, words, className }: { stage: Stage; words?: Partial<Record<Stage, string>>; className?: string }) {
  const at = Stage.options.indexOf(stage);
  return (
    <ol data-slot="stage-timeline" className={cn("grid gap-0", className)}>
      {Stage.options.map((s, i) => {
        const state = i < at ? "done" : i === at ? "current" : "upcoming";
        const Icon = STAGE_META[s].icon;
        return (
          <li key={s} data-state={state} aria-current={state === "current" ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
            {i < Stage.options.length - 1 ? (
              <span aria-hidden="true" className={cn("absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5", i < at ? "bg-primary" : "bg-border")} />
            ) : null}
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary bg-brand-subtle text-brand-subtle-foreground ring-4 ring-brand-subtle",
                state === "upcoming" && "bg-card text-muted-foreground",
              )}
            >
              {state === "done" ? <Check aria-hidden="true" className="size-4" /> : <Icon aria-hidden="true" className="size-4" />}
            </span>
            <span className={cn("pt-1.5 text-sm", state === "current" ? "font-semibold" : state === "upcoming" ? "text-muted-foreground" : "")}>
              {words?.[s] ?? CLIENT_STAGE_WORDS[s]}
              {state === "done" ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
