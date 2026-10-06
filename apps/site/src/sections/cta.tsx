import { ArrowRight } from "lucide-react";

import { BellMark } from "@app/ui/components/logo";

import { upperFirst, useStartHref } from "@/components/marketing/practice";
import { useNames } from "@/lib/public";

// The closing call to action (marketing 11): the brand band with one white button.

export function Cta() {
  const { preparerFirst } = useNames();
  const start = useStartHref();
  return (
    <section id="cta" aria-labelledby="cta-title" className="scroll-mt-16 px-4 pt-10 pb-24 md:px-6">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-4.5 rounded-3xl bg-primary px-5 py-11 text-center text-primary-foreground md:px-6 md:py-16">
        <BellMark className="size-14" />
        <h2 id="cta-title" className="max-w-160 text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-4xl">
          Hand off your taxes this year
        </h2>
        <p className="max-w-130 text-[1.0625rem] leading-relaxed font-medium text-pretty">
          Start with a few questions. {upperFirst(preparerFirst)} will reach out within one business day with your invite to the&nbsp;portal.
        </p>
        <a
          href={start}
          className="inline-flex h-12 items-center gap-2 rounded-md bg-primary-foreground px-6 text-base font-semibold text-foreground transition-colors duration-150 ease-standard hover:bg-primary-foreground/90 focus-visible:ring-[3px] focus-visible:ring-primary-foreground/60 focus-visible:outline-none dark:text-background"
        >
          Get started <ArrowRight aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
