import { LogOut, Moon, Settings, Sun, WifiOff, type LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Avatar, AvatarFallback } from "./avatar";
import type { ShellLink } from "./admin-shell";
import { Banner } from "./banner";
import { BottomTabs } from "./bottom-tabs";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu";
import { Logo } from "./logo";
import { ModeBadge } from "./mode-badge";
import { ModeToggle } from "./mode-toggle";
import { useTheme } from "./theme-provider";

// The portal's frame (portal 05-08, desktop 22-24), the one the portal app renders and Storybook shows (ticket 56): the
// logo and mode badge, the account menu (theme, settings, log out), five destinations as tabs at the bottom on a phone
// and across the top on a desktop, with counts for what's waiting, and a banner when the connection drops.
// Presentational: the app passes the tabs, the person, links and handlers.

export type PortalTab = { key: string; label: string; icon: LucideIcon; badge?: number };

/** "Jordan A. Example" → "JE": first and last word, skipping initials like "A.". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/\.$/.test(w))
    .map((w) => w[0]!.toUpperCase())
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("");

export type PortalShellProps = {
  tabs: PortalTab[];
  active: string;
  /** Links for the tabs and for the logo (key "home"). */
  renderLink: ShellLink;
  user: { name: string; email: string } | null;
  /** Shows the Demo badge by the logo (hidden while the demo tour bar is up). */
  demoBadge?: boolean;
  online?: boolean;
  onSettings: () => void;
  onLogout: () => void;
  /** Above the header, full width: the demo tour bar. */
  banner?: React.ReactNode;
  children: React.ReactNode;
};

export function PortalShell({ tabs, active, renderLink, user, demoBadge = false, online = true, onSettings, onLogout, banner, children }: PortalShellProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const avatar = (
    <Avatar className="size-10">
      <AvatarFallback className="bg-brand-subtle text-sm font-semibold text-brand-subtle-foreground">{user ? initials(user.name) : ""}</AvatarFallback>
    </Avatar>
  );

  return (
    <div data-slot="portal-shell" className="flex min-h-svh flex-col bg-background">
      {banner}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          {renderLink(
            { key: "home", current: false },
            <>
              <Logo size="sm" />
              <span className="sr-only">Home</span>
            </>,
            "rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          )}
          {demoBadge ? <ModeBadge mode="demo" className="rounded-full" /> : null}
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            {tabs.map((t) => (
              <React.Fragment key={t.key}>
                {renderLink(
                  { key: t.key, current: t.key === active },
                  <>
                    {t.label}
                    {t.badge ? (
                      <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums">
                        <span className="sr-only">, </span>
                        {t.badge}
                        <span className="sr-only"> waiting</span>
                      </span>
                    ) : null}
                  </>,
                  cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    t.key === active && "bg-muted text-foreground",
                  ),
                )}
              </React.Fragment>
            ))}
          </nav>
          <ModeToggle className="hidden md:inline-flex" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Your account" className="ml-auto size-11 rounded-full md:ml-0">
                {avatar}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
                {avatar}
                <span className="grid min-w-0">
                  <span className="truncate font-medium">{user?.name}</span>
                  <span className="truncate text-sm text-muted-foreground">{user?.email}</span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11" onSelect={() => setTheme(dark ? "light" : "dark")}>
                {dark ? <Sun /> : <Moon />} {dark ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={onSettings}>
                <Settings /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={onLogout}>
                <LogOut /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!online ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
          <Banner
            tone="warning"
            title={
              <span className="inline-flex items-center gap-2">
                <WifiOff aria-hidden="true" className="size-4" /> You're offline
              </span>
            }
          >
            What you see may be out of date. Anything you send waits until you're back online.
          </Banner>
        </div>
      ) : null}

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 px-4 pt-6 pb-28 md:px-6 md:pt-10 md:pb-12">{children}</main>

      <BottomTabs tabs={tabs} active={active} renderLink={(t, children, className) => renderLink({ key: t.key, current: t.key === active }, children, className)} />
    </div>
  );
}
