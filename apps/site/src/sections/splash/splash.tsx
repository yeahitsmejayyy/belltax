import { Check } from "lucide-react";

import { Wordmark } from "@app/ui/components/logo";
import { ModeToggle } from "@app/ui/components/mode-toggle";
import { PortalPhones } from "@app/ui/components/portal-mockups";

import { bookingYear, stateName } from "@/components/marketing/practice";
import { BRAND, useNames } from "@/lib/public";

// The splash page (ticket 53, from PJ's design export): a placeholder while the practice gets ready. The wordmark,
// the promise and three portal phones, with no call to action: the practice is invite-only, so there's nothing to
// sign up for (PJ, 2026-10-20). It speaks as the brand like the landing page; city and state come from useNames().

// When the practice opens: the one date the splash states outright.
export const OPENING = "January 2027";

export function SplashHeader() {
  return (
    <header className="mx-auto flex h-18 w-full max-w-[1200px] items-center gap-3 px-5">
      <Wordmark className="h-7" />
      <ModeToggle className="ml-auto size-11 md:size-9" />
    </header>
  );
}

export function SplashHero() {
  const { agent, city, state } = useNames();
  const region = stateName(state);
  const year = bookingYear();
  const points = ["Flat, up-front pricing", `Federal and ${region ?? "state"} e-file`, ...(region === "California" ? ["IHSS caregivers welcome"] : [])];

  return (
    <main id="main" className="flex flex-1 flex-col items-center gap-7 overflow-hidden px-5 pt-8 pb-12 text-center md:pt-14 md:pb-18">
      <div className="flex max-w-180 flex-col items-center gap-3.5">
        <span className="inline-flex min-h-7 items-center rounded-full bg-brand-subtle px-3 py-1 text-[13px] font-bold text-brand-subtle-foreground">
          Opening {OPENING}
          {city ? <> · {city}</> : null}
        </span>
        <h1 className="text-5xl leading-[1.04] font-extrabold tracking-[-0.04em] text-balance md:text-[84px]">Taxes Made Easy.</h1>
        <p className="max-w-135 text-[17px] leading-relaxed text-pretty text-muted-foreground md:text-lg">
          Federal and {region ?? "state"} returns, prepared and e-filed by our team, with every step in one place on your&nbsp;phone.
        </p>
      </div>

      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <Check aria-hidden="true" className="size-4 text-brand-subtle-foreground" />
            {p}
          </li>
        ))}
      </ul>

      <PortalPhones agent={agent} year={year - 1} className="mt-4" />
    </main>
  );
}

export function SplashFooter() {
  const { city, state } = useNames();
  const place = [city, state].filter(Boolean).join(", ");
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-[1200px] px-5 py-6 text-sm text-muted-foreground">
        © {new Date().getFullYear()} {BRAND}
        {place ? <> · {place}</> : null}
      </div>
    </footer>
  );
}
