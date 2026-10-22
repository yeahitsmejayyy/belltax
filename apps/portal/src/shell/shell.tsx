import { CreditCard, FileText, FolderOpen, House, PenLine, type LucideIcon } from "lucide-react";
import * as React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { DemoBar } from "@app/ui/components/demo-tour";
import { PortalShell } from "@app/ui/components/portal-shell";
import { Skeleton } from "@app/ui/components/skeleton";
import { clearDemoUser, setDemoUser } from "@app/ui/demo";

import { signOut } from "@/lib/auth";
import { useDemoTour } from "@/lib/demo-tour";
import { useOnline } from "@/lib/online";
import { useReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The portal's frame: data and routing for PortalShell (packages/ui, ticket 56), which draws the header, account menu,
// tabs and offline banner. What it shows is the design system's; what it knows (the person, what's waiting) is here.

type Tab = { key: string; to: string; label: string; icon: LucideIcon; badge?: number };

export function Shell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const online = useOnline();
  const tour = useDemoTour();
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

  return (
    <PortalShell
      tabs={tabs}
      active={active}
      user={me ? { name: me.name, email: me.email } : null}
      demoBadge={mode === "demo" && !tour}
      online={online}
      onSettings={() => navigate("/settings")}
      onLogout={async () => {
        await signOut();
        clearDemoUser("portal");
        await utils.invalidate();
        navigate("/sign-in");
      }}
      renderLink={(t, children, className) => {
        const to = t.key === "home" ? "/" : (tabs.find((x) => x.key === t.key)?.to ?? "/");
        return (
          <NavLink to={to} end={to === "/"} className={className} aria-current={t.current ? "page" : undefined}>
            {children}
          </NavLink>
        );
      }}
      banner={
        tour ? (
          <DemoBar
            viewingAs="client"
            onSwitch={() => {
              if (tour.preparerId) setDemoUser("admin", tour.preparerId);
              location.assign("/admin/");
            }}
          />
        ) : null
      }
    >
      <React.Suspense fallback={<Skeleton aria-label="Loading" className="h-64 rounded-xl" />}>
        <Outlet />
      </React.Suspense>
    </PortalShell>
  );
}
