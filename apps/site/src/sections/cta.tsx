import { ArrowRight } from "lucide-react";

import { Wordmark } from "@app/ui/components/logo";

import { useStartHref } from "@/components/marketing/practice";

// The closing call to action (marketing 11): the brand band with one white button.

export function Cta() {
  const start = useStartHref();
  return (
    <section id="cta" aria-labelledby="cta-title" className="scroll-mt-16 px-4 pt-10 pb-24 md:px-6">
      {/* Always the charcoal band with a chartreuse button (marketing 11): the dark tokens, in either theme. */}
      <div className="dark mx-auto flex max-w-[1100px] flex-col items-center gap-4.5 rounded-3xl bg-charcoal px-5 py-11 text-center text-foreground md:px-6 md:py-16">
        <Wordmark className="h-10" />
        <h2 id="cta-title" className="max-w-160 text-[1.75rem] leading-[1.15] font-bold text-balance md:text-4xl">
          Hand off your taxes this year
        </h2>
        <p className="max-w-130 text-[1.0625rem] leading-relaxed font-medium text-pretty">
          Start with a few questions. Your personal tax agent will reach out within one business day with your invite to the&nbsp;portal.
        </p>
        <a
          href={start}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors duration-150 ease-standard hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          Get started <ArrowRight aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
