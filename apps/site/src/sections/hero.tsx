import { ArrowRight, Check, Play } from "lucide-react";

import { Button } from "@app/ui/components/button";
import { BellMark } from "@app/ui/components/logo";

import { Float } from "@/components/marketing/float";
import { PhoneDocuments, PhoneFrame, PhoneHome, PhoneLetterSigned } from "@/components/marketing/portal-mockups";
import { bookingYear, stateName, useStartHref } from "@/components/marketing/practice";
import { useNames } from "@/lib/public";

// The hero (marketing 01, 02 dark, 13-phone-m-hero): the promise, two actions, and three portal screens
// drifting below. The screens are decoration (invented data), hidden from assistive tech.

export function Hero() {
  const { preparer, preparerFirst, city, state } = useNames();
  const start = useStartHref();
  const year = bookingYear();
  const region = stateName(state);
  const where = city ? `Tax preparation in ${city}` : "Tax preparation";
  const points = ["Flat, up-front pricing", `Federal and ${region ?? "state"} e-file`, ...(region === "California" ? ["IHSS caregivers welcome"] : [])];

  return (
    <section id="hero" aria-labelledby="hero-title" className="scroll-mt-16 overflow-hidden px-4 pt-11 md:px-6 md:pt-18">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-7 text-center">
        <BellMark className="size-18" />
        <div className="flex max-w-180 flex-col items-center gap-3.5">
          <p className="text-sm font-medium text-pretty text-muted-foreground">
            {where} · Now booking for the {year} tax&nbsp;year
          </p>
          <h1 id="hero-title" className="text-[2.375rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance md:text-6xl">
            Taxes, done right.
          </h1>
          <p className="max-w-140 text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground md:text-lg">
            Federal and {region ?? "state"} returns, prepared and e-filed by {preparer}. Share your documents from your phone and follow every&nbsp;step.
          </p>
        </div>
        <div className="flex w-full flex-col justify-center gap-2.5 sm:w-auto sm:flex-row">
          <Button asChild className="h-12 px-5.5 text-base">
            <a href={start}>
              Get started <ArrowRight aria-hidden="true" />
            </a>
          </Button>
          <Button asChild variant="outline" className="h-12 px-5 text-base">
            <a href="#how">
              <Play aria-hidden="true" /> See how it works
            </a>
          </Button>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <Check aria-hidden="true" className="size-4 text-brand-subtle-foreground" />
              {p}
            </li>
          ))}
        </ul>
        <div
          aria-hidden="true"
          inert
          className="mt-6 flex h-[400px] w-full max-w-240 items-start justify-center gap-3 mask-b-from-75% select-none sm:h-[480px] md:gap-7"
        >
          <Float delay={0} className="mt-24 hidden w-[220px] shrink-0 lg:block">
            <PhoneFrame>
              <PhoneDocuments />
            </PhoneFrame>
          </Float>
          <Float delay={1200} className="w-[260px] shrink-0 sm:w-[270px]">
            <PhoneFrame>
              <PhoneHome preparer={preparer} preparerFirst={preparerFirst} year={year - 1} />
            </PhoneFrame>
          </Float>
          <Float delay={2400} className="mt-24 hidden w-[220px] shrink-0 lg:block">
            <PhoneFrame>
              <PhoneLetterSigned />
            </PhoneFrame>
          </Float>
        </div>
      </div>
    </section>
  );
}
