import { Activity, CalendarPlus, ChevronRight, FileText, Inbox, LayoutDashboard, Mail, Receipt, Settings, User, Users, Workflow } from "lucide-react";
import * as React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AdminShell } from "@app/ui/components/admin-shell";
import type { NavItem } from "@app/ui/components/app-sidebar";
import type { SearchGroup } from "@app/ui/components/command-search";
import { DemoBar } from "@app/ui/components/demo-tour";
import { InviteClientDialog, type InviteDraft } from "@app/ui/components/invite-client-dialog";
import { Skeleton } from "@app/ui/components/skeleton";
import { clearDemoUser, setDemoUser } from "@app/ui/demo";

import { useTaxYear } from "@/lib/tax-year";
import { signOut } from "@/lib/auth";
import { useDemoTour } from "@/lib/demo-tour";
import { trpc } from "@/lib/trpc";
import { useHeaderTitle } from "./header-slots";
import { InviteContext } from "./invite";

// The admin's frame: data and routing for AdminShell (packages/ui, ticket 56), which draws the sidebar, header, phone
// tabs and More button. What it shows is the design system's; what it knows (counts, user, tax year, search) is here.

// Demo "Fill sample data" in the invite dialog: invented, and only offered in demo mode.
const SAMPLE: Omit<InviteDraft, "mode"> = {
  surname: "Example",
  email: "m@example.test",
  phone: "(555) 010-0000",
  members: [
    { first: "Morgan", role: "primary" },
    { first: "Avery", role: "spouse" },
    { first: "Sky", role: "dependent" },
  ],
  filing: "mfj",
  filers: [0, 1],
};

const ICON = { client: Users, person: User, return: FileText, invoice: Receipt } as const;

export function Shell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { taxYear, years, setTaxYear } = useTaxYear();
  const tour = useDemoTour();
  const utils = trpc.useUtils();

  const mode = trpc.health.check.useQuery(undefined, { staleTime: Infinity }).data?.mode ?? "demo";
  const practice = trpc.settings.practice.get.useQuery(undefined, { staleTime: 60_000 }).data;
  const badges = trpc.dashboard.badges.useQuery(taxYear ? { taxYear } : undefined, { enabled: !!taxYear, refetchInterval: 60_000 }).data;

  const outbox = trpc.email.outbox.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  const items: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "pipeline", label: "Pipeline", icon: Workflow, count: badges?.pipeline },
    { key: "inbox", label: "Inbox", icon: Inbox, count: badges?.inbox, countTone: "brand" },
    { key: "clients", label: "Clients", icon: Users },
    { key: "invoices", label: "Invoices", icon: Receipt, count: badges?.invoices, countTone: "danger" },
    { key: "activity", label: "Activity", icon: Activity },
    // The outbox exists only where mail isn't really sent (dev and the demos; ticket 51).
    ...(outbox.isSuccess ? [{ key: "outbox", label: "Outbox", icon: Mail, count: outbox.data.length || undefined } satisfies NavItem] : []),
  ];
  const active = pathname.split("/")[1] === "returns" ? "pipeline" : pathname.split("/")[1] || "pipeline";

  // Search: the server filters (ticket 41); the field and ⌘K share these results.
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 120);
    return () => clearTimeout(t);
  }, [q]);
  const found = trpc.search.query.useQuery({ q: debounced }, { placeholderData: (prev) => prev }).data;
  const groups: SearchGroup[] = (found?.groups ?? []).map((g) => ({
    heading: g.heading,
    items: g.hits.map((h) => ({
      id: `${h.type}:${h.id}`,
      label: h.label,
      sublabel: h.sublabel,
      icon: ICON[h.type],
      onSelect: () =>
        navigate(
          h.type === "return" ? `/returns/${h.id}` : h.type === "invoice" ? `/returns/${h.engagementId}/billing` : `/clients/${h.householdId}`,
        ),
    })),
  }));

  // Invite client / Add client without invite.
  const [invite, setInvite] = React.useState<InviteDraft["mode"] | null>(null);
  const [created, setCreated] = React.useState<string | null>(null);
  const onboard = trpc.household.onboard.useMutation();

  const title = useHeaderTitle();
  const heading = title.parent ? (
    <span className="flex min-w-0 items-center gap-1.5">
      <Link to={title.parent.to} className="text-muted-foreground hover:text-foreground">
        {title.parent.label}
      </Link>
      <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
      <span className="truncate">{title.title}</span>
    </span>
  ) : (
    title.title
  );

  return (
    <InviteContext.Provider value={(m = "invite") => setInvite(m)}>
      <AdminShell
        items={items}
        active={active}
        taxYears={years}
        taxYear={taxYear}
        onTaxYearChange={setTaxYear}
        user={{ name: practice?.preparerName ?? "Preparer", email: practice?.replyToEmail ?? "" }}
        mode={mode}
        title={heading}
        search={{ groups, onQueryChange: setQ, filter: false }}
        onInvite={setInvite}
        onSettings={() => navigate("/settings")}
        onLogout={async () => {
          await signOut();
          clearDemoUser("admin");
          utils.invalidate();
          navigate("/login");
        }}
        more={[
          { label: "Activity", icon: Activity, onSelect: () => navigate("/activity") },
          { label: "Settings", icon: Settings, onSelect: () => navigate("/settings") },
          { label: "New season", icon: CalendarPlus, onSelect: () => navigate("/season") },
        ]}
        renderLink={(t, children, className) => (
          <NavLink to={`/${t.key}`} className={className} aria-current={t.current ? "page" : undefined}>
            {children}
          </NavLink>
        )}
        banner={
          tour?.client ? (
            <DemoBar
              viewingAs="agent"
              onSwitch={() => {
                setDemoUser("portal", tour.client!.id);
                location.assign("/");
              }}
            />
          ) : null
        }
        overlay={
          <InviteClientDialog
            open={invite !== null}
            onOpenChange={(o) => {
              if (!o) setInvite(null);
            }}
            mode={invite ?? "invite"}
            taxYear={taxYear ?? new Date().getFullYear() - 1}
            preparerName={practice?.preparerName ?? "Your preparer"}
            sample={mode === "demo" ? SAMPLE : undefined}
            onSubmit={async (d) => {
              const r = await onboard.mutateAsync({
                mode: d.mode,
                taxYear: taxYear ?? new Date().getFullYear() - 1,
                surname: d.surname,
                email: d.email || null,
                phone: d.phone || null,
                members: d.members,
                filing: d.filing,
                filers: d.filers,
              });
              setCreated(r.engagementIds[0] ?? null);
              await utils.invalidate();
              toast.success(d.mode === "invite" ? `Invite ready for ${d.email}` : `${d.surname} household added`);
              return { inviteUrl: r.inviteUrl, inviteEmailed: r.inviteEmailed };
            }}
            onOpenReturn={
              created
                ? () => {
                    setInvite(null);
                    navigate(`/returns/${created}`);
                  }
                : undefined
            }
          />
        }
      >
        <React.Suspense fallback={<Skeleton aria-label="Loading" className="h-64 rounded-xl" />}>
          <Outlet />
        </React.Suspense>
      </AdminShell>
    </InviteContext.Provider>
  );
}
