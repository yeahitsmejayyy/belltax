import type * as React from "react";

// The eyebrow + h2 (+ lead) that opens the pricing and FAQ sections (marketing 07, 10).
// The eyebrow uses the brand-subtle foreground: the solid brand blue is under 4.5:1 for 14px text (principles 5).
export function SectionIntro({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-2xl justify-items-center gap-3 text-center">
      <span className="text-sm font-semibold text-brand-subtle-foreground">{eyebrow}</span>
      <h2 id={id} className="text-[28px] leading-tight font-bold text-balance md:text-4xl">{title}</h2>
      {children ? <p className="text-[17px] leading-relaxed text-pretty text-muted-foreground">{children}</p> : null}
    </div>
  );
}
