import { Activity, CalendarPlus, ChevronRight, FileText, Inbox, LayoutDashboard, LayoutGrid, Receipt, Settings, User, UserPlus, Users, Workflow } from "lucide-react";
import * as React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppHeader } from "@app/ui/components/app-header";
import { AppSidebar, type NavItem } from "@app/ui/components/app-sidebar";
import { BottomTabs } from "@app/ui/components/bottom-tabs";
import { Button } from "@app/ui/components/button";
import type { SearchGroup } from "@app/ui/components/command-search";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@app/ui/components/dropdown-menu";
import { InviteClientDialog, type InviteDraft } from "@app/ui/components/invite-client-dialog";
import { SidebarInset, SidebarProvider } from "@app/ui/components/sidebar";
import { Skeleton } from "@app/ui/components/skeleton";
import { SplitButton } from "@app/ui/components/split-button";
import { DemoBar } from "@app/ui/components/demo-tour";
import { clearDemoUser, setDemoUser } from "@app/ui/demo";

import { useTaxYear } from "@/lib/tax-year";
import { useDemoTour } from "@/lib/demo-tour";
import { trpc } from "@/lib/trpc";
import { useHeaderTitle } from "./header-slots";
import { InviteContext } from "./invite";

// The admin's frame (every .assets/screens/admin/desktop/ screen): the sidebar with live counts and the tax-year
// switcher, and the header with the page title, search (header field and ⌘K), the theme toggle and Invite client.

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

  const items: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "pipeline", label: "Pipeline", icon: Workflow, count: badges?.pipeline },
    { key: "inbox", label: "Inbox", icon: Inbox, count: badges?.inbox, countTone: "brand" },
    { key: "clients", label: "Clients", icon: Users },
    { key: "invoices", label: "Invoices", icon: Receipt, count: badges?.invoices, countTone: "danger" },
    { key: "activity", label: "Activity", icon: Activity },
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
    <SidebarProvider>
      <AppSidebar
        items={items}
        active={active}
        taxYears={years}
        taxYear={taxYear}
        onTaxYearChange={setTaxYear}
        user={{ name: practice?.preparerName ?? "Preparer", email: practice?.replyToEmail ?? "" }}
        mode={mode}
        onSettings={() => navigate("/settings")}
        onLogout={() => {
          clearDemoUser("admin");
          utils.invalidate();
          navigate("/login");
        }}
        renderLink={(item, children) => (
          <NavLink to={`/${item.key}`} aria-current={item.key === active ? "page" : undefined}>
            {children}
          </NavLink>
        )}
      />
      <SidebarInset className="min-w-0">
        {tour?.client ? (
          <DemoBar
            viewingAs="agent"
            onSwitch={() => {
              setDemoUser("portal", tour.client!.id);
              location.assign("/");
            }}
          />
        ) : null}
        <AppHeader
          title={heading}
          search={{ groups, onQueryChange: setQ, filter: false }}
          action={
            <SplitButton
              label={<><UserPlus /> <span className="max-sm:sr-only">Invite client</span></>}
              onClick={() => setInvite("invite")}
              menuLabel="More ways to add a client"
              items={[{ label: "Add client without invite", description: "Set them up now. Send the portal invite later.", onSelect: () => setInvite("add") }]}
            />
          }
        />
        <main className="min-w-0 flex-1 p-4 pb-40 md:p-6 lg:p-8">
          <React.Suspense fallback={<Skeleton aria-label="Loading" className="h-64 rounded-xl" />}>
            <Outlet />
          </React.Suspense>
        </main>
        <PhoneNav active={active} items={items} onInvite={() => setInvite("invite")} />
      </SidebarInset>
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
          toast.success(d.mode === "invite" ? `Invite sent to ${d.email}` : `${d.surname} household added`);
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
    </SidebarProvider>
    </InviteContext.Provider>
  );
}

// Phones (admin 34-37): five tabs at the bottom and a round button above them for everything else.
function PhoneNav({ active, items, onInvite }: { active: string; items: NavItem[]; onInvite: () => void }) {
  const navigate = useNavigate();
  const tabs = items.filter((i) => i.key !== "activity").map((i) => ({ key: i.key, label: i.label, icon: i.icon, badge: i.count || undefined }));
  return (
    <>
      <BottomTabs
        tabs={tabs}
        active={active}
        renderLink={(t, children, className) => (
          <NavLink to={`/${t.key}`} className={className} aria-current={t.key === active ? "page" : undefined}>
            {children}
          </NavLink>
        )}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" aria-label="More" className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg md:hidden [&_svg:not([class*='size-'])]:size-6">
            <LayoutGrid />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-56">
          <DropdownMenuItem onSelect={onInvite}><UserPlus /> Invite client</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/activity")}><Activity /> Activity</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/settings")}><Settings /> Settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/season")}><CalendarPlus /> New season</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
