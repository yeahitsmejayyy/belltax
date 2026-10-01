import { CreditCard, FileText, FolderOpen, House, LogOut, Moon, PenLine, Settings, Sun, WifiOff, type LucideIcon } from "lucide-react";
import * as React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "@app/ui/components/avatar";
import { Banner } from "@app/ui/components/banner";
import { BottomTabs } from "@app/ui/components/bottom-tabs";
import { Button } from "@app/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@app/ui/components/dropdown-menu";
import { Logo } from "@app/ui/components/logo";
import { ModeBadge } from "@app/ui/components/mode-badge";
import { ModeToggle } from "@app/ui/components/mode-toggle";
import { Skeleton } from "@app/ui/components/skeleton";
import { useTheme } from "@app/ui/components/theme-provider";
import { clearDemoUser } from "@app/ui/demo";
import { cn } from "@app/ui/utils";

import { useOnline } from "@/lib/online";
import { useReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The portal's frame (portal 05-08, desktop 22-24): logo and mode badge, the account menu (theme, settings,
// log out), five destinations as tabs at the bottom on a phone and across the top on a desktop, with
// counts for what's waiting, and a banner when the connection drops.

type Tab = { key: string; to: string; label: string; icon: LucideIcon; badge?: number };

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/\.$/.test(w))
    .map((w) => w[0]!.toUpperCase())
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("");

export function Shell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const online = useOnline();
  const { resolvedTheme, setTheme } = useTheme();
  const { current } = useReturn();

  const mode = trpc.health.check.useQuery(undefined, { staleTime: Infinity }).data?.mode ?? "demo";
  const me = trpc.me.get.useQuery(undefined, { staleTime: 60_000 }).data;
  const id = current?.engagementId;
  const requests = trpc.request.list.useQuery({ engagementId: id! }, { enabled: !!id }).data;
  const letter = trpc.letter.get.useQuery({ engagementId: id! }, { enabled: !!id }).data;

  // What's waiting on the client there: documents still needed (or needing a better copy) and questions to answer.
  const docs = requests?.filter((r) => r.status === "open" && (r.kind === "question" || r.latestDocument?.status !== "uploaded")).length ?? 0;
  const tabs: Tab[] = [
    { key: "home", to: "/", label: "Home", icon: House },
    { key: "questions", to: "/questions", label: "Questions", icon: FileText },
    { key: "documents", to: "/documents", label: "Documents", icon: FolderOpen, badge: docs || undefined },
    { key: "letter", to: "/letter", label: "Letter", icon: PenLine, badge: letter?.canSign ? 1 : undefined },
    { key: "invoice", to: "/invoice", label: "Invoice", icon: CreditCard },
  ];
  const active = tabs.find((t) => t.to !== "/" && pathname.startsWith(t.to))?.key ?? (pathname === "/" ? "home" : "");
  const dark = resolvedTheme === "dark";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <NavLink to="/" aria-label="Home" className="rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo size="sm" />
          </NavLink>
          {mode === "demo" ? <ModeBadge mode="demo" className="rounded-full" /> : null}
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            {tabs.map((t) => (
              <NavLink
                key={t.key}
                to={t.to}
                end={t.to === "/"}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  t.key === active && "bg-muted text-foreground",
                )}
              >
                {t.label}
                {t.badge ? (
                  <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums">
                    <span className="sr-only">, </span>
                    {t.badge}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <ModeToggle className="hidden md:inline-flex" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Your account" className="ml-auto size-11 rounded-full md:ml-0">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-brand-subtle text-sm font-semibold text-brand-subtle-foreground">{me ? initials(me.name) : ""}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-brand-subtle text-sm font-semibold text-brand-subtle-foreground">{me ? initials(me.name) : ""}</AvatarFallback>
                </Avatar>
                <span className="grid min-w-0">
                  <span className="truncate font-medium">{me?.name}</span>
                  <span className="truncate text-sm text-muted-foreground">{me?.email}</span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11" onSelect={() => setTheme(dark ? "light" : "dark")}>
                {dark ? <Sun /> : <Moon />} {dark ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => navigate("/settings")}>
                <Settings /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => {
                  clearDemoUser("portal");
                  utils.invalidate();
                  navigate("/sign-in");
                }}
              >
                <LogOut /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!online ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
          <Banner tone="warning" title={<span className="inline-flex items-center gap-2"><WifiOff aria-hidden="true" className="size-4" /> You're offline</span>}>
            What you see may be out of date. Anything you send waits until you're back online.
          </Banner>
        </div>
      ) : null}

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 px-4 pt-6 pb-28 md:px-6 md:pt-10 md:pb-12">
        <React.Suspense fallback={<Skeleton aria-label="Loading" className="h-64 rounded-xl" />}>
          <Outlet />
        </React.Suspense>
      </main>

      <BottomTabs
        tabs={tabs}
        active={active}
        renderLink={(t, children, className) => (
          <NavLink to={(t as Tab).to} end={(t as Tab).to === "/"} className={className} aria-current={t.key === active ? "page" : undefined}>
            {children}
          </NavLink>
        )}
      />
    </div>
  );
}
