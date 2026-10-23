import type * as React from "react";

import { Wordmark } from "./logo";
import { CheckPoints } from "./marketing";
import { ModeToggle } from "./mode-toggle";

// The splash page (ticket 53, from PJ's design export): a placeholder while the practice gets ready. The wordmark, the
// promise and the portal phones, with no call to action. The words, the date and the place come from the site.

/** The page's column: header, hero, footer, filling at least the screen. */
export function SplashLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-svh flex-col">{children}</div>;
}

/** The wordmark and the theme toggle. */
export function SplashHeader() {
  return (
    <header className="mx-auto flex h-18 w-full max-w-[1200px] items-center gap-3 px-5">
      <Wordmark className="h-7" />
      <ModeToggle className="ml-auto size-11 md:size-9" />
    </header>
  );
}

/** The page's main: a pill (like when it opens), the title, a lead, the checked points, then `art` (like PortalPhones). */
export function SplashHero({ badge, title, lead, points, art }: { badge: React.ReactNode; title: React.ReactNode; lead: React.ReactNode; points: string[]; art?: React.ReactNode }) {
  return (
    <main id="main" className="flex flex-1 flex-col items-center gap-7 overflow-hidden px-5 pt-8 pb-12 text-center md:pt-14 md:pb-18">
      <div className="flex max-w-180 flex-col items-center gap-3.5">
        <span className="inline-flex min-h-7 items-center rounded-full bg-brand-subtle px-3 py-1 text-[13px] font-bold text-brand-subtle-foreground">{badge}</span>
        <h1 className="text-5xl leading-[1.04] font-extrabold tracking-[-0.04em] text-balance md:text-[84px]">{title}</h1>
        <p className="max-w-135 text-[17px] leading-relaxed text-pretty text-muted-foreground md:text-lg">{lead}</p>
      </div>

      <CheckPoints points={points} />

      {art}
    </main>
  );
}

/** One quiet line: the copyright and where. */
export function SplashFooter({ children }: { children: React.ReactNode }) {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-[1200px] px-5 py-6 text-sm text-muted-foreground">{children}</div>
    </footer>
  );
}
