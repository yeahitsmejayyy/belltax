import { Stage } from "@app/schema";
import { Check } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { STAGE_META } from "@app/ui/components/stage-pill";
import { formatDate } from "@app/ui/format";
import { cn } from "@app/ui/utils";

import type { MyReturn } from "@/lib/return";

// "Where your return stands" (portal 05-home, desktop 22): the eight stages in the client's words, done
// ones checked with the day they were reached, the current one with what happens now.

const LABEL: Record<Stage, string> = {
  invited: "Invited",
  intake: "Questions",
  documents: "Documents",
  ready: "Ready to prep",
  preparing: "Preparing",
  review: "Your review",
  filed: "Filed",
  complete: "Complete",
};

const NOW: Record<Stage, (p: string) => string> = {
  invited: () => "Set up your account to get started.",
  intake: () => "Answer questions about your household and income.",
  documents: (p) => `Upload the documents ${p} asked for.`,
  ready: (p) => `You're all set. ${p} will start soon.`,
  preparing: (p) => `${p} is working on your return.`,
  review: () => "Look over your return and approve it.",
  filed: () => "Sent to the IRS and the state. Waiting for them to accept it.",
  complete: () => "Your return was accepted. You're done for this year.",
};

export function StageProgress({ ret, preparer }: { ret: MyReturn; preparer: string }) {
  const at = Stage.options.indexOf(ret.stage);
  const done = ret.stage === "complete";
  // A return moved back can reach a stage twice; the latest visit is the one that counts.
  const reached = new Map<Stage, string>();
  for (const r of ret.reached) if (!reached.has(r.stage) || r.at > reached.get(r.stage)!) reached.set(r.stage, r.at);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>Where your return stands</h2>
        </CardTitle>
        <CardDescription>
          Step {at + 1} of {Stage.options.length} · {LABEL[ret.stage]}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid">
          {Stage.options.map((s, i) => {
            const state = i < at || (done && i === at) ? "done" : i === at ? "current" : "upcoming";
            const Icon = STAGE_META[s].icon;
            const when = reached.get(s);
            return (
              <li key={s} data-state={state} aria-current={i === at ? "step" : undefined} className="relative flex gap-4 pb-6 last:pb-0">
                {i < Stage.options.length - 1 ? (
                  <span aria-hidden="true" className={cn("absolute top-10 bottom-0 left-[19px] w-0.5", i < at ? "bg-primary" : "bg-border")} />
                ) : null}
                <span
                  className={cn(
                    "relative flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums",
                    state === "done" && "border-primary bg-primary text-primary-foreground",
                    state === "current" && "border-primary bg-brand-subtle text-brand-subtle-foreground ring-4 ring-brand-subtle",
                    state === "upcoming" && "bg-card text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check aria-hidden="true" className="size-4" /> : state === "current" ? <Icon aria-hidden="true" className="size-4" /> : i + 1}
                </span>
                <div className="grid min-w-0 content-start gap-1 pt-2">
                  <span className={cn("flex flex-wrap items-center gap-2", state === "current" ? "font-semibold" : state === "upcoming" && "text-muted-foreground")}>
                    {LABEL[s]}
                    {i === at && !done ? <span className="rounded-full bg-brand-subtle px-2 text-xs leading-5 font-medium text-brand-subtle-foreground">Now</span> : null}
                  </span>
                  {state === "done" ? (
                    <span className="text-sm text-muted-foreground">
                      Done{when ? ` · ${formatDate(when, { month: "short", day: "numeric" })}` : ""}
                    </span>
                  ) : state === "current" ? (
                    <span className="text-sm text-muted-foreground">{NOW[s](preparer)}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
