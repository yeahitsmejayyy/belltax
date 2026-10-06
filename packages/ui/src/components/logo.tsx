import * as React from "react";

import { MARK, WORDMARK } from "../brand/glyphs";
import { cn } from "../utils";

// The belltax. brand (handoff, October 2026): the "b." mark on a rounded square (radius 25%) and the lowercase
// "belltax." wordmark in Bricolage Grotesque 800 at -0.06em. The period is the accent. Outlined paths (brand/glyphs.ts),
// so they need no font to load; colours come from the tokens and follow the theme:
//   mark, light: charcoal tile, white b, lime dot · dark: chartreuse tile, charcoal b.
//   wordmark, light: charcoal, lime dot · dark: white, chartreuse dot. One green for both periods in light (--dot, --wm-dot).

const MARK_SIZE = 0.92; // the handoff sets the b. at 92 on a 128 tile
const markShift = `translate(${64 - (MARK.box.x + MARK.box.w / 2) * MARK_SIZE} 94) scale(${MARK_SIZE})`;

export function BellMark({ className, title, ...props }: React.ComponentProps<"svg"> & { title?: string }) {
  return (
    <svg viewBox="0 0 128 128" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} className={cn("size-8 shrink-0", className)} {...props}>
      {title ? <title>{title}</title> : null}
      <rect width="128" height="128" rx="32" className="fill-charcoal dark:fill-chartreuse" />
      <g transform={markShift}>
        <path d={MARK.letters} className="fill-white dark:fill-charcoal" />
        <path d={MARK.dot} className="fill-dot" />
      </g>
    </svg>
  );
}

const { box } = WORDMARK;
const wordView = `${box.x - 1} ${box.y - 1} ${box.w + 2} ${box.h + 2}`;

export function Wordmark({ className, title, ...props }: React.ComponentProps<"svg"> & { title?: string }) {
  return (
    <svg viewBox={wordView} role="img" aria-label={title ?? "belltax."} className={cn("h-6 w-auto shrink-0", className)} {...props}>
      <path d={WORDMARK.letters} className="fill-foreground" />
      <path d={WORDMARK.dot} className="fill-wm-dot" />
    </svg>
  );
}

// The lockup: mark + wordmark, with an optional line underneath ("Preparer admin").
export function Logo({ subtitle, className, size = "md" }: { subtitle?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const mark = { sm: "size-6", md: "size-9", lg: "size-12" }[size];
  const word = { sm: "h-4", md: "h-5", lg: "h-8" }[size];
  return (
    <span data-slot="logo" className={cn("inline-flex items-center gap-2", className)}>
      <BellMark className={cn(mark, "rounded-[25%]")} />
      <span className="grid gap-0.5 leading-tight">
        <Wordmark className={word} />
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
    </span>
  );
}

// "The sign-in loader pulses the b. mark" (handoff README). Reduced motion stills it (tokens.css).
export function MarkLoader({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" data-slot="mark-loader" className={cn("flex flex-col items-center gap-3", className)}>
      <BellMark className="size-12 animate-mark-pulse" />
      <span className="text-sm text-muted-foreground">{label}…</span>
    </div>
  );
}
