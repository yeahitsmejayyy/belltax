import { cn } from "@app/ui/utils";
import * as React from "react";

import type { TapTarget } from "./script";

// Shows where the walkthrough "taps": a dot fades in on the target, presses, ripples and fades out.
// Placed in the screen's own (unscaled) coordinates; animates transform and opacity only.

type Phase = "in" | "down" | "up";

export function TapDot({ target, screenRef }: { target: TapTarget; screenRef: React.RefObject<HTMLDivElement | null> }) {
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = React.useState<Phase>("in");

  React.useLayoutEffect(() => {
    const screen = screenRef.current;
    const el = screen?.querySelector<HTMLElement>(`[data-tap="${target}"]`);
    if (!screen || !el) return setAt(null);
    const s = screen.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = s.width / screen.offsetWidth || 1;
    setAt({ x: (r.left - s.left + r.width / 2) / k, y: (r.top - s.top + r.height / 2) / k });
  }, [target, screenRef]);

  React.useEffect(() => {
    setPhase("in");
    const timers = [window.setTimeout(() => setPhase("down"), 280), window.setTimeout(() => setPhase("up"), 420)];
    return () => timers.forEach(clearTimeout);
  }, [target]);

  if (!at) return null;
  return (
    <div className="pointer-events-none absolute top-0 left-0 z-20" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
      <span
        className={cn(
          "absolute -top-8 -left-8 size-16 rounded-full bg-primary/25 transition-[scale,opacity] duration-500 ease-enter",
          { in: "scale-50 opacity-0", down: "scale-100 opacity-100 duration-100", up: "scale-150 opacity-0" }[phase],
        )}
      />
      <span
        className={cn(
          "absolute -top-5 -left-5 size-10 rounded-full border-2 border-background bg-foreground/45 shadow-lg transition-[scale,opacity] duration-200 ease-standard starting:scale-125 starting:opacity-0",
          phase === "down" ? "scale-[0.8]" : "scale-100",
          phase === "up" && "opacity-0 delay-150",
        )}
      />
    </div>
  );
}
