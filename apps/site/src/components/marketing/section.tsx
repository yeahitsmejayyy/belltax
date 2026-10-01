import type * as React from "react";

import { cn } from "@app/ui/utils";

// The shared section frame (marketing 03-11): 1100px column, 56px/88px vertical rhythm, clears the sticky header.

export function Section({ id, muted, className, children }: { id: string; muted?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-16 border-t px-4 py-14 md:px-6 md:py-22", muted && "border-t-0 bg-muted", className)}>
      <div className="mx-auto grid max-w-[1100px] gap-10">{children}</div>
    </section>
  );
}

// Eyebrow, h2 and an optional lead. The h2 carries the id the section is labelled by.
export function SectionHeading({ id, eyebrow, title, lead, className }: { id: string; eyebrow: string; title: React.ReactNode; lead?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid max-w-160 gap-3", className)}>
      <p className="text-sm font-semibold text-brand-subtle-foreground">{eyebrow}</p>
      <h2 id={`${id}-title`} className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-4xl">
        {title}
      </h2>
      {lead ? <p className="text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground">{lead}</p> : null}
    </div>
  );
}
