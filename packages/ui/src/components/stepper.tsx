import { Check } from "lucide-react";

import { cn } from "../utils";
import { Button } from "./button";
import { Progress } from "./progress";

// "Step 2 of 4 · Who you support": intake (portal 09-12), add someone (portal 11), invite (admin 24/25).
export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  const value = Math.round(((current + 1) / steps.length) * 100);
  return (
    <div data-slot="stepper" className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{steps[current]}</span>
        <span className="text-muted-foreground tabular-nums">
          Step {current + 1} of {steps.length}
        </span>
      </div>
      <Progress value={value} aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`} />
    </div>
  );
}

// The bottom of a multi-step sheet or dialog: Back on the left, the one primary action on the right.
export function StepFooter({ onBack, onNext, nextLabel = "Continue", backLabel = "Back", nextDisabled }: { onBack?: () => void; onNext: () => void; nextLabel?: string; backLabel?: string; nextDisabled?: boolean }) {
  return (
    <div data-slot="step-footer" className="flex items-center justify-between gap-3 pt-2">
      {onBack ? (
        <Button type="button" variant="ghost" className="max-md:h-11" onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" className="max-md:h-11 max-md:text-base" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}

// The numbered steps across the top of a multi-step dialog (admin 24-dialogs-and-sheets-dlg-invite):
// done steps are filled with a check, the current one is tinted, the rest are outlined.
export function StepList({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol data-slot="step-list" aria-label="Steps" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors duration-200",
                  state === "done" && "border-transparent bg-primary text-primary-foreground",
                  state === "current" && "border-transparent bg-brand-subtle text-brand-subtle-foreground",
                  state === "upcoming" && "text-muted-foreground",
                )}
              >
                {state === "done" ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("text-sm", state === "current" ? "font-medium text-foreground" : "text-muted-foreground")}>
                {label}
                {state === "done" ? <span className="sr-only"> (done)</span> : null}
              </span>
            </span>
            {i < steps.length - 1 ? <span aria-hidden="true" className="h-px w-6 bg-border" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
