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
