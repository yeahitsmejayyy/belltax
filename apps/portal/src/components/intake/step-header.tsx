import { Check, CloudOff, LoaderCircle } from "lucide-react";

import { Button } from "@app/ui/components/button";
import { Progress } from "@app/ui/components/progress";

import type { SaveState } from "./use-autosave";

// "Step 2 of 8" with the quiet save state beside it and the bar underneath (portal 09-12).

export function StepHeader({ step, total, title, save, onRetry }: { step: number; total: number; title: string; save: SaveState; onRetry: () => void }) {
  return (
    <div className="grid gap-3">
      <div className="flex min-h-6 items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          Step {step} of {total}
        </span>
        <span aria-live="polite" className="inline-flex items-center gap-1.5">
          {save.status === "saving" ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> Saving…
            </>
          ) : save.status === "saved" ? (
            <>
              <Check aria-hidden="true" className="size-4" /> Saved {save.at?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </>
          ) : save.status === "error" ? (
            <>
              <CloudOff aria-hidden="true" className="size-4" /> Not saved yet
              <Button variant="link" size="sm" className="h-auto px-1 py-0 max-md:min-h-11" onClick={onRetry}>
                Try again
              </Button>
            </>
          ) : null}
        </span>
      </div>
      <Progress value={Math.round((step / total) * 100)} aria-label={`Step ${step} of ${total}: ${title}`} />
    </div>
  );
}
