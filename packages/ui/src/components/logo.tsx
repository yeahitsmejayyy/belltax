import * as React from "react";

import { cn } from "../utils";

// The shield (packages/ui/src/brand) as inline SVG, so it needs no asset request and themes itself:
// the deeper gradient on light surfaces, the brighter one on dark.

export function ShieldMark({ className, ...props }: React.ComponentProps<"svg">) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg viewBox="3 1 18 22" fill="none" aria-hidden="true" className={cn("h-7 w-auto shrink-0", className)} {...props}>
      <defs>
        <linearGradient id={`${id}l`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id={`${id}d`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <g className="dark:hidden">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill={`url(#${id}l)`} stroke={`url(#${id}l)`} strokeWidth="1.8" strokeLinejoin="round" />
      </g>
      <g className="hidden dark:inline">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill={`url(#${id}d)`} stroke={`url(#${id}d)`} strokeWidth="1.8" strokeLinejoin="round" />
      </g>
      <path d="M12 19.7s6.1-3.15 6.1-7.8V6.35L12 4.1 5.9 6.35v5.55c0 4.65 6.1 7.8 6.1 7.8z" stroke="white" strokeOpacity="0.6" strokeWidth="0.6" strokeLinejoin="round" fill="none" />
      <g transform="translate(-0.25, -0.45) translate(12.25 11.5) scale(0.82) translate(-12.25 -11.5)">
        <path
          fill="white"
          fillRule="evenodd"
          d="M8.6 7.3H12.9C14.6 7.3 15.4 8.2 15.4 9.3C15.4 10.3 14.7 10.9 13.8 11.15C15 11.35 15.9 12.1 15.9 13.3C15.9 14.7 14.8 15.7 12.9 15.7H8.6V15.25C9.2 15.2 9.4 15.05 9.4 14.5V8.5C9.4 7.95 9.2 7.8 8.6 7.75Z M10.9 7.85V10.9H12.5C13.5 10.9 13.95 10.25 13.95 9.35C13.95 8.4 13.45 7.85 12.5 7.85Z M10.9 11.45V15.1H12.7C13.8 15.1 14.35 14.35 14.35 13.28C14.35 12.15 13.7 11.45 12.55 11.45Z"
        />
      </g>
    </svg>
  );
}

// The wordmark: Geist 700, one word (.assets/README.md).
export function Logo({ subtitle, className, size = "md" }: { subtitle?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const text = { sm: "text-sm", md: "text-base", lg: "text-2xl" }[size];
  const mark = { sm: "h-5", md: "h-7", lg: "h-10" }[size];
  return (
    <span data-slot="logo" className={cn("inline-flex items-center gap-2", className)}>
      <ShieldMark className={mark} />
      <span className="grid leading-tight">
        <span className={cn("font-bold tracking-tight", text)}>BellTaxPrep</span>
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
    </span>
  );
}

// "The sign-in loader pulses the shield" (.assets/README.md). Reduced motion stills it (tokens.css).
export function ShieldLoader({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" data-slot="shield-loader" className={cn("flex flex-col items-center gap-3", className)}>
      <ShieldMark className="h-12 animate-shield-pulse" />
      <span className="text-sm text-muted-foreground">{label}…</span>
    </div>
  );
}
