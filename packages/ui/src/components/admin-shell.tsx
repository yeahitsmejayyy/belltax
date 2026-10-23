import { LayoutGrid, type LucideIcon } from "lucide-react";
import * as React from "react";

import { AppHeader } from "./app-header";
import { AppSidebar, type NavItem } from "./app-sidebar";
import { BottomTabs } from "./bottom-tabs";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu";
import { SidebarInset, SidebarProvider } from "./sidebar";
import { SplitButton } from "./split-button";

// The admin's frame (every .assets/screens/admin/desktop/ screen, phones 34-37), the one the admin app renders and
// Storybook shows (ticket 56): the sidebar with counts and the tax-year switcher; the header with the page title,
// search (field and ⌘K), the theme toggle and the page's main action (Invite client in the admin; icon-only on a phone);
// and on a phone, bottom tabs plus a round More button. Presentational: the app passes data, links and handlers;
// routing and fetching stay in the app.

/** How the shell asks the app for a link: the app returns its router's link (NavLink, <a>…) around `children`. */
export type ShellLink = (target: { key: string; current: boolean }, children: React.ReactNode, className?: string) => React.ReactNode;
export type ShellMoreItem = { label: string; icon: LucideIcon; onSelect: () => void };
/** The header's main action: a button, with a menu of other ways to do it when `options` are given. On a phone it
 *  also heads the More menu. */
export type ShellAction = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** The menu button's accessible name. */
  menuLabel?: string;
  options?: { label: string; description?: string; onSelect: () => void }[];
};

export type AdminShellProps = {
  items: NavItem[];
  active: string;
  renderLink: ShellLink;
  title: React.ReactNode;
  user: { name: string; email: string };
  mode: "demo" | "live";
  taxYears?: number[];
  taxYear?: number;
  onTaxYearChange?: (year: number) => void;
  search?: React.ComponentProps<typeof AppHeader>["search"];
  /** The main action in the header (and first in the phone's More menu). */
  action?: ShellAction;
  onSettings?: () => void;
  onLogout?: () => void;
  /** Phone More menu, after the main action: Activity, Settings… */
  more?: ShellMoreItem[];
  /** Keys that live in the More menu instead of a bottom tab on a phone. */
  notTabs?: string[];
  /** Above the header, full width: the demo tour bar. */
  banner?: React.ReactNode;
  /** After the frame: dialogs the shell opens (Invite client). */
  overlay?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function AdminShell({
  items,
  active,
  renderLink,
  title,
  user,
  mode,
  taxYears,
  taxYear,
  onTaxYearChange,
  search,
  action,
  onSettings,
  onLogout,
  more = [],
  notTabs = [],
  banner,
  overlay,
  defaultOpen,
  children,
}: AdminShellProps) {
  const tabs = items.filter((i) => !notTabs.includes(i.key)).map((i) => ({ key: i.key, label: i.label, icon: i.icon, badge: i.count || undefined }));
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        items={items}
        active={active}
        taxYears={taxYears}
        taxYear={taxYear}
        onTaxYearChange={onTaxYearChange}
        user={user}
        mode={mode}
        onSettings={onSettings}
        onLogout={onLogout}
        renderLink={(item, children) => renderLink({ key: item.key, current: item.key === active }, children)}
      />
      <SidebarInset className="min-w-0">
        {banner}
        <AppHeader
          title={title}
          search={search}
          action={
            action ? (
              action.options?.length ? (
                <SplitButton
                  label={
                    <>
                      <action.icon /> <span className="max-sm:sr-only">{action.label}</span>
                    </>
                  }
                  onClick={action.onSelect}
                  menuLabel={action.menuLabel}
                  items={action.options}
                />
              ) : (
                <Button onClick={action.onSelect}>
                  <action.icon /> <span className="max-sm:sr-only">{action.label}</span>
                </Button>
              )
            ) : undefined
          }
        />
        <main className="min-w-0 flex-1 p-4 pb-40 md:p-6 lg:p-8">{children}</main>
        <BottomTabs tabs={tabs} active={active} renderLink={(t, children, className) => renderLink({ key: t.key, current: t.key === active }, children, className)} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              aria-label="More"
              className="fixed right-4 bottom-[calc(4.5rem+max(env(safe-area-inset-bottom),var(--safe-bottom,0px)))] z-40 size-14 rounded-full shadow-lg md:hidden [&_svg:not([class*='size-'])]:size-6"
            >
              <LayoutGrid />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56">
            {action ? (
              <DropdownMenuItem onSelect={action.onSelect}>
                <action.icon /> {action.label}
              </DropdownMenuItem>
            ) : null}
            {action && more.length ? <DropdownMenuSeparator /> : null}
            {more.map((m) => (
              <DropdownMenuItem key={m.label} onSelect={m.onSelect}>
                <m.icon /> {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarInset>
      {overlay}
    </SidebarProvider>
  );
}
