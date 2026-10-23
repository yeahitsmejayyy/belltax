import { Menu } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { FloatingActionMenu, type FabItem } from "./floating-action-menu";
import { Logo, Wordmark } from "./logo";
import type { MarketingLink } from "./marketing";
import { ModeToggle } from "./mode-toggle";

// The marketing site's frame (marketing 01, 02, 12, 14-phone-m-menu): the skip link, the sticky header with its section
// links and two actions, the round menu button on phones, and the footer. Links in as data; what a menu item does is
// the page's (each item's onSelect).

/** "Skip to content": hidden until focused, then pinned top left. */
export function SkipLink({ href = "#main", children }: { href?: string; children: React.ReactNode }) {
  return (
    <a href={href} className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
      {children}
    </a>
  );
}

/**
 * The sticky header: the wordmark (back to the top), the section links from `md`, the theme toggle, the secondary action
 * from `md` and the primary one. On phones the section links live in the round `menu` button instead.
 */
export function SiteHeader({ home, nav, navLabel = "Sections", secondary, primary, menu }: {
  /** Where the wordmark goes, and its accessible name. */
  home: MarketingLink;
  nav: MarketingLink[];
  navLabel?: string;
  secondary?: MarketingLink;
  primary: MarketingLink;
  /** The phone menu (below `md`): its button's name and its items; `className` adds to its position. Left out, there's no menu. */
  menu?: { label: string; items: FabItem[]; className?: string };
}) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 md:gap-4 md:px-6">
          <a href={home.href} aria-label={home.label} className="flex min-h-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Wordmark className="h-6" />
          </a>
          <nav aria-label={navLabel} className="hidden flex-1 justify-center gap-1 md:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none lg:px-3">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ModeToggle className="size-11 md:size-9" />
            {secondary ? (
              <Button asChild variant="ghost" className="hidden md:inline-flex">
                <a href={secondary.href}>{secondary.label}</a>
              </Button>
            ) : null}
            <Button asChild className="h-11 px-4 text-base md:h-9 md:text-sm">
              <a href={primary.href}>{primary.label}</a>
            </Button>
          </div>
        </div>
      </header>
      {menu ? <FloatingActionMenu label={menu.label} icon={Menu} className={cn("bottom-4", menu.className)} items={menu.items} /> : null}
    </>
  );
}

/** The footer: the logo, who and where (`place` after a dot when known), then the links a client looks for. */
export function SiteFooter({ name, place, links, navLabel = "Footer" }: { name: string; place?: string | null; links: MarketingLink[]; navLabel?: string }) {
  const link = "inline-flex min-h-11 items-center rounded-sm hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";
  return (
    <footer className="border-t pb-20 md:pb-0">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground md:px-6 md:py-8">
        <Logo className="text-foreground" />
        <span>
          {name}
          {place ? <> · {place}</> : null}
        </span>
        <nav aria-label={navLabel} className="flex flex-wrap items-center gap-x-6 md:ml-auto">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={link}>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
