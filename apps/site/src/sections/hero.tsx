import { ArrowRight, Check, Play, ShieldCheck } from "lucide-react";

import { Button } from "@app/ui/components/button";

import { Float } from "@/components/marketing/float";
import { PhoneDocuments, PhoneFrame, PhoneHome, PhoneLetterSigned } from "@/components/marketing/portal-mockups";
import { bookingYear, stateName, useStartHref } from "@/components/marketing/practice";
import { useNames } from "@/lib/public";

// The hero (marketing 01, 02 dark, 13-phone-m-hero): the promise, two actions, and three portal screens
// drifting below. The screens are decoration (invented data), hidden from assistive tech.

export function Hero() {
  const { agent, city, state } = useNames();
  const start = useStartHref();
  const year = bookingYear();
  const region = stateName(state);
  const where = city ? `Tax preparation in ${city}` : "Tax preparation";
  const points = ["Flat, up-front pricing", `Federal and ${region ?? "state"} e-file`, ...(region === "California" ? ["IHSS caregivers welcome"] : [])];

  return (
    <section id="hero" aria-labelledby="hero-title" className="scroll-mt-16 overflow-hidden px-4 pt-11 md:px-6 md:pt-18">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-7 text-center">
        <div className="flex max-w-180 flex-col items-center gap-3.5">
          <p className="text-sm font-medium text-pretty text-muted-foreground">
            {where} · Now booking for the {year} tax&nbsp;year
          </p>
          <h1 id="hero-title" className="text-[2.75rem] leading-[1.02] font-extrabold text-balance md:text-7xl">
            Taxes Made Easy.
          </h1>
          <p className="max-w-140 text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground md:text-lg">
            Federal and {region ?? "state"} returns, prepared and e-filed by your personal tax agent. Share your documents, sign and pay, all from your phone, and follow every&nbsp;step.
          </p>
        </div>
        <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button asChild className="h-12 px-8 text-base has-[>svg]:px-8">
            <a href={start}>
              Get started <ArrowRight aria-hidden="true" />
            </a>
          </Button>
          <Button asChild variant="outline" className="h-12 px-8 text-base has-[>svg]:px-8">
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
        {/* The credential, stated the way California states it: CTEC-registered (not "licensed"), bonded, with a PTIN. */}
        {region === "California" ? (
          <p className="-mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-3.5 text-brand-subtle-foreground" />
            CTEC-registered · Bonded · IRS PTIN
          </p>
        ) : null}
        <div
          aria-hidden="true"
          inert
          // The mask only paints inside this box, so it carries room on every side (negative margins keep the layout
          // where it was): the phones float up and cast their shadows without ever touching an edge, then fade out
          // at the bottom.
          className="-mx-10 mt-0 box-content flex h-[400px] w-full max-w-240 items-start justify-center gap-3 px-10 pt-10 mask-b-from-70% select-none sm:h-[480px] md:gap-7"
        >
          <Float delay={0} className="mt-24 hidden w-[220px] shrink-0 lg:block">
            <PhoneFrame>
              <PhoneDocuments />
            </PhoneFrame>
          </Float>
          <Float delay={1200} className="w-[260px] shrink-0 sm:w-[270px]">
            <PhoneFrame>
              <PhoneHome agent={agent} year={year - 1} />
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
