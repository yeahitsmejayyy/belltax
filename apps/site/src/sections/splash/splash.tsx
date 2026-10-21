import { Check } from "lucide-react";

import { Wordmark } from "@app/ui/components/logo";
import { ModeToggle } from "@app/ui/components/mode-toggle";
import { PortalPhones } from "@app/ui/components/portal-mockups";
import { WaitlistForm } from "@app/ui/components/waitlist-form";

import { bookingYear, stateName } from "@/components/marketing/practice";
import { joinHref } from "@/lib/join";
import { BRAND, useNames } from "@/lib/public";

// The splash page (ticket 53, from PJ's design export): the wordmark, the promise, "Join the list", and three portal
// phones. It speaks as the brand like the landing page, and takes the practice's city, state and email from useNames().

// When the practice opens to new clients: the one date the splash states outright.
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
  const { agent, city, state, email } = useNames();
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
          Federal and {region ?? "state"} returns, prepared and e-filed by our team. Join the list to hear first when booking opens for the {year} tax&nbsp;year.
        </p>
      </div>

      {/* Joining writes to the practice (lib/join.ts). With no address to write to, there's no form at all. */}
      {email ? (
        <WaitlistForm
          onJoin={(address, reminders) => {
            window.location.href = joinHref(email, address, reminders, BRAND);
          }}
          confirmation={(address) => ({
            title: "Almost there.",
            body: `Your email app opened with a note asking us to add ${address}. Send it and you're on the list: we'll write when booking opens, and nothing else.`,
          })}
        />
      ) : null}

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
  const { city, state, email } = useNames();
  const place = [city, state].filter(Boolean).join(", ");
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-6 text-sm text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {BRAND}
          {place ? <> · {place}</> : null}
        </span>
        {email ? (
          <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center rounded-sm hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:ml-auto">
            {email}
          </a>
        ) : null}
      </div>
    </footer>
  );
}
