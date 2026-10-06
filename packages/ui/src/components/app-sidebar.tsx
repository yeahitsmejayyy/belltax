import type { LucideIcon } from "lucide-react";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { Avatar, AvatarFallback } from "./avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu";
import { Logo, BellMark } from "./logo";
import { ModeBadge } from "./mode-badge";
import { ModeToggle } from "./mode-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
} from "./sidebar";

// The admin's shell (every .assets/screens/admin/desktop/ screen): the logo, the tax-year switcher,
// the workspace nav with counts, Settings, who's signed in, and the Demo / Live badge. It collapses to an
// icon rail on desktop (⌘B or the trigger) and becomes a sheet on phones. Router-agnostic: the app renders
// each link through `renderLink`, so active state and navigation stay the router's job.

export type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  // How a count reads: a plain total, something waiting on you, or a problem.
  countTone?: "neutral" | "brand" | "danger";
};

type AppSidebarProps = {
  items: NavItem[];
  active: string;
  renderLink: (item: { key: string; label: string }, children: React.ReactNode) => React.ReactNode;
  taxYears?: number[];
  taxYear?: number;
  onTaxYearChange?: (year: number) => void;
  user: { name: string; email: string };
  mode: "demo" | "live";
  onSettings?: () => void;
  onLogout?: () => void;
  subtitle?: string;
};

// Each tone keeps its own text colour on hover and on the active page too: the sidebar's badge otherwise switches to
// the accent foreground there (white in dark mode), which on the chartreuse badge measured about 1.3 : 1.
const COUNT_TONE: Record<NonNullable<NavItem["countTone"]>, string> = {
  neutral: "bg-sidebar-accent text-muted-foreground peer-hover/menu-button:text-muted-foreground peer-data-[active=true]/menu-button:text-muted-foreground",
  brand: "bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground",
  // Dark mode's red is lighter, so its count is charcoal there (white measured 2.89 : 1; charcoal 5.99 : 1).
  danger: "bg-destructive text-white peer-hover/menu-button:text-white peer-data-[active=true]/menu-button:text-white dark:text-charcoal dark:peer-hover/menu-button:text-charcoal dark:peer-data-[active=true]/menu-button:text-charcoal",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .filter((c) => /[A-Z]/.test(c))
    .slice(0, 2)
    .join("");

export function AppSidebar({ items, active, renderLink, taxYears, taxYear, onTaxYearChange, user, mode, onSettings, onLogout, subtitle }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" data-slot="app-sidebar">
      <SidebarHeader className="gap-3 p-3">
        <div className="flex h-10 items-center px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Logo subtitle={subtitle} className="group-data-[collapsible=icon]:hidden" />
          <BellMark className="hidden size-7 group-data-[collapsible=icon]:block" />
        </div>
        {taxYears && taxYear !== undefined ? (
          <Select value={String(taxYear)} onValueChange={(v) => onTaxYearChange?.(Number(v))}>
            <SelectTrigger aria-label="Tax year" className="w-full bg-background group-data-[collapsible=icon]:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {taxYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  TY {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild isActive={item.key === active} tooltip={item.count ? `${item.label} · ${item.count}` : item.label}>
                    {renderLink(
                      item,
                      <>
                        <item.icon />
                        <span>{item.label}</span>
                      </>,
                    )}
                  </SidebarMenuButton>
                  {item.count ? (
                    <SidebarMenuBadge className={cn("rounded-full", COUNT_TONE[item.countTone ?? "neutral"])} aria-label={`${item.count} ${item.label.toLowerCase()}`}>
                      {item.count}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={active === "settings"} tooltip="Settings">
              {renderLink(
                { key: "settings", label: "Settings" },
                <>
                  <Settings />
                  <span>Settings</span>
                </>,
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="mt-1 flex justify-center self-stretch border-t pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={user.name} className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-brand-subtle text-brand-subtle-foreground">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="min-w-56">
                <DropdownMenuLabel className="flex items-center justify-between gap-3 font-normal">
                  <span className="text-sm">Theme</span>
                  <ModeToggle variant="switch" />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {onSettings ? (
                  <DropdownMenuItem onSelect={onSettings}>
                    <Settings /> Settings
                  </DropdownMenuItem>
                ) : null}
                {onLogout ? (
                  <DropdownMenuItem onSelect={onLogout}>
                    <LogOut /> Log out
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <ModeBadge mode={mode} className="group-data-[collapsible=icon]:hidden" />
        <span
          aria-hidden="true"
          className={cn("mx-auto hidden size-2 rounded-full group-data-[collapsible=icon]:block", mode === "demo" ? "bg-mode-demo-foreground" : "bg-success")}
          title={mode === "demo" ? "Demo · sample data" : "Live · client data"}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
