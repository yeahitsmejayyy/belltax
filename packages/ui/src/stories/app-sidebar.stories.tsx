import type { Meta, StoryObj } from "@storybook/react-vite";
import { Activity, CalendarPlus, Inbox, LayoutDashboard, Mail, Receipt, Settings, UserPlus, Users, Workflow } from "lucide-react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import { AdminShell } from "../components/admin-shell";
import type { NavItem } from "../components/app-sidebar";
import { DemoBar } from "../components/demo-tour";
import { InviteClientDialog, type InviteDraft } from "../components/invite-client-dialog";
import { Money } from "../components/money";
import { Skeleton } from "../components/skeleton";
import { StatCard } from "../components/stat-card";
import { ThemeProvider } from "../components/theme-provider";
import { SAMPLE, searchGroups } from "./fixtures";

// The admin's frame, AdminShell: the same component apps/admin renders (ticket 56), so what you see here is the app.
// The sidebar with counts and the tax-year switcher; the header with the page title, search (⌘K), the theme toggle and
// Invite client (icon-only on a phone); on a phone, bottom tabs and the round More button. ⌘B collapses the sidebar to
// icons. Counts: plain totals (Pipeline), waiting on you (Inbox), problems (Invoices). Invented data.
const USAGE = `import { AdminShell } from "@app/ui/components/admin-shell";

<AdminShell
  items={items}                     // NavItem[]: key, label, icon, count, countTone
  active="pipeline"
  title="Pipeline"
  user={{ name: "Morgan Hale", email: "morgan@belltax.example" }}
  mode="demo"
  taxYears={[2026, 2025]} taxYear={2026} onTaxYearChange={setYear}
  search={{ groups }}
  action={{
    label: "Invite client",
    icon: UserPlus,
    onSelect: () => openInvite("invite"),
    menuLabel: "More ways to add a client",
    options: [{ label: "Add client without invite", description: "Set them up now. Send the portal invite later.", onSelect: () => openInvite("add") }],
  }}
  notTabs={["activity"]}
  more={[{ label: "Settings", icon: Settings, onSelect: () => navigate("/settings") }]}
  renderLink={(t, children, className) => (
    <NavLink to={\`/\${t.key}\`} className={className} aria-current={t.current ? "page" : undefined}>{children}</NavLink>
  )}
>
  <Outlet />
</AdminShell>`;
const meta: Meta<typeof AdminShell> = {
  title: "Admin/App shell",
  component: AdminShell,
  parameters: { shell: true, docs: { source: { code: USAGE, language: "tsx" }, story: { inline: false, height: "720px" } } },
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { AdminShell } from \"@app/ui/components/admin-shell\";" };
export default meta;
type Story = StoryObj;

const ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pipeline", label: "Pipeline", icon: Workflow, count: 27 },
  { key: "inbox", label: "Inbox", icon: Inbox, count: 19, countTone: "brand" },
  { key: "clients", label: "Clients", icon: Users },
  { key: "invoices", label: "Invoices", icon: Receipt, count: 1, countTone: "danger" },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "outbox", label: "Outbox", icon: Mail },
];

// State for the story only (which page, which year, which dialog); everything drawn is AdminShell.
function Demo({ defaultOpen = true, loading = false, tour = false }: { defaultOpen?: boolean; loading?: boolean; tour?: boolean }) {
  const [active, setActive] = useState("dashboard");
  const [year, setYear] = useState(2026);
  const [last, setLast] = useState("");
  const [invite, setInvite] = useState<InviteDraft["mode"] | null>(null);
  const title = active === "settings" ? "Settings" : ITEMS.find((i) => i.key === active)?.label;
  return (
    <ThemeProvider storageKey={null}>
      <AdminShell
        defaultOpen={defaultOpen}
        items={ITEMS}
        active={active}
        title={title}
        taxYears={[2026, 2025, 2024]}
        taxYear={year}
        onTaxYearChange={setYear}
        user={{ name: "Morgan Hale", email: "morgan@belltax.example" }}
        mode="demo"
        search={{ groups: searchGroups((to) => setActive(to.startsWith("client") ? "clients" : to.startsWith("invoice") ? "invoices" : to === "settings" ? "settings" : "pipeline")) }}
        action={{
          label: "Invite client",
          icon: UserPlus,
          onSelect: () => {
            setLast("invite");
            setInvite("invite");
          },
          menuLabel: "More ways to add a client",
          options: [
            {
              label: "Add client without invite",
              description: "Set them up now. Send the portal invite later.",
              onSelect: () => {
                setLast("add");
                setInvite("add");
              },
            },
          ],
        }}
        notTabs={["activity"]}
        onSettings={() => setActive("settings")}
        onLogout={() => {}}
        more={[
          { label: "Activity", icon: Activity, onSelect: () => setActive("activity") },
          { label: "Settings", icon: Settings, onSelect: () => setActive("settings") },
          { label: "New season", icon: CalendarPlus, onSelect: () => {} },
        ]}
        renderLink={(t, children, className) => (
          <a
            href={`#${t.key}`}
            className={className}
            aria-current={t.current ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              setActive(t.key);
            }}
          >
            {children}
          </a>
        )}
        banner={tour ? <DemoBar viewingAs="agent" onSwitch={() => {}} /> : null}
        overlay={
          <InviteClientDialog
            open={invite !== null}
            onOpenChange={(o) => !o && setInvite(null)}
            mode={invite ?? "invite"}
            taxYear={year}
            preparerName="Morgan Hale"
            sample={SAMPLE}
            onSubmit={() => new Promise((r) => setTimeout(r, 300))}
          />
        }
      >
        <div data-testid="page" data-last={last} className="grid gap-4">
          {loading ? (
            // .assets/screens/admin/desktop/02-access-loading.png
            <div className="grid gap-5" aria-busy="true" aria-label="Loading the pipeline">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-9 w-full max-w-3xl" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-96 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Showing {active} · TY {year}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Returns filed" value="6 of 27" progress={22} detail="3 complete · 3 waiting on IRS and FTB" />
                <StatCard label="Collected" value={<Money cents={120750} />} progress={44} detail="of $2,750.00 billed · $1,542.50 outstanding" />
                <StatCard label="Waiting on you" value="25" detail="6 returns to prepare · 19 in Inbox" />
                <StatCard label="Avg. days in stage" value="6" detail="8 returns over 7 days" detailTone="warning" />
              </div>
            </>
          )}
        </div>
      </AdminShell>
    </ThemeProvider>
  );
}

export const Expanded: Story = { name: "Desktop", render: () => <Demo /> };
export const Loading: Story = { name: "Loading a page", render: () => <Demo loading /> };
export const Collapsed: Story = { name: "Collapsed to icons", render: () => <Demo defaultOpen={false} /> };
export const Phone: Story = { name: "Phone (402)", render: () => <Demo />, globals: { viewport: { value: "phone", isRotated: false } } };
export const SmallPhone: Story = { name: "Phone (iPhone SE, 375)", render: () => <Demo />, globals: { viewport: { value: "phoneSmall", isRotated: false } } };
export const PhoneDemoTour: Story = { name: "Phone · demo tour", render: () => <Demo tour />, globals: { viewport: { value: "phone", isRotated: false } } };

export const ExpandedTest: Story = {
  name: "Expanded · test",
  tags: ["!dev", "!autodocs"],
  render: () => <Demo />,
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const page = () => c.getByTestId("page");
    await step("links navigate, mark the page and title the header", async () => {
      await userEvent.click(c.getAllByRole("link", { name: "Inbox" })[0]!);
      await expect(page()).toHaveTextContent("inbox");
      await expect(c.getAllByRole("link", { name: "Inbox" })[0]).toHaveAttribute("aria-current", "page");
      await expect(c.getByRole("heading", { level: 1 })).toHaveTextContent("Inbox");
    });
    await step("counts are read with their meaning", async () => {
      await expect(c.getByLabelText("1 invoices")).toHaveTextContent("1");
    });
    await step("the tax year switches", async () => {
      await userEvent.click(c.getByRole("combobox", { name: "Tax year" }));
      await userEvent.click(await screen.findByRole("option", { name: "TY 2025" }));
      await waitFor(() => expect(page()).toHaveTextContent("TY 2025"));
      // The select hides the rest of the page from screen readers until it has fully closed.
      const header = canvasElement.querySelector('[data-slot="app-header"]')!;
      await waitFor(() => expect(header.closest("[aria-hidden]")).toBeNull(), { timeout: 3000 });
    });
    await step("type in the header field and pick a result; ⌘K opens the palette", async () => {
      const field = c.getByRole("combobox", { name: "Search clients, returns, invoices" });
      await userEvent.click(field);
      await userEvent.type(field, "marigold");
      await userEvent.click(await c.findByRole("option", { name: /Dana & Sam Marigold/ }));
      await waitFor(() => expect(page()).toHaveTextContent("clients"));
      await userEvent.keyboard("{Meta>}k{/Meta}");
      await expect(await screen.findByRole("dialog")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
    await step("Invite client is the primary action, with Add client without invite behind the chevron", async () => {
      await userEvent.click(c.getByRole("button", { name: "Invite client" }));
      await expect(await screen.findByRole("heading", { name: "Create the household" })).toBeInTheDocument();
      await expect(screen.getByLabelText("Email for the invite")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await userEvent.click(c.getByRole("button", { name: "More ways to add a client" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: /Add client without invite/ }));
      await expect(await screen.findByLabelText("Email (optional for now)")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
    await step("the demo badge is always there", async () => {
      await waitFor(() => expect(c.getByRole("status")).toHaveTextContent("Demo · sample data"));
    });
    await step("the trigger collapses the sidebar to icons", async () => {
      await userEvent.click(c.getByRole("button", { name: "Toggle Sidebar" }));
      await waitFor(() => expect(canvasElement.querySelector('[data-state="collapsed"]')).not.toBeNull());
    });
  },
};

// Collapsed, the icons, the settings cog and the avatar all sit on the b. mark's axis (principles.md rule 13).
export const CollapsedTest: Story = {
  name: "Collapsed to icons · test",
  tags: ["!dev", "!autodocs"],
  render: () => <Demo defaultOpen={false} />,
  play: async ({ canvasElement }) => {
    const visible = (el: Element) => el.getBoundingClientRect().width > 0;
    const cx = (el: Element) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
    await waitFor(() => {
      const mark = [...canvasElement.querySelectorAll('[data-sidebar="header"] svg[viewBox="0 0 128 128"]')].find(visible)!;
      const buttons = [...canvasElement.querySelectorAll('[data-sidebar="menu-button"]')].filter(visible);
      expect(buttons).toHaveLength(9); // seven nav items, Settings, the user
      for (const b of buttons) expect(Math.abs(cx(b) - cx(mark))).toBeLessThan(1);
    });
  },
};

// On a phone: the page title, the icon-only invite button, bottom tabs with counts, and More for the rest.
export const PhoneTest: Story = {
  name: "Phone · test",
  tags: ["!dev", "!autodocs"],
  render: () => <Demo />,
  globals: { viewport: { value: "phone", isRotated: false } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const tabs = within(canvasElement.querySelector('[data-slot="bottom-tabs"]') as HTMLElement);
    await expect(tabs.getAllByRole("link").map((l) => l.textContent?.replace(/\d+/g, ""))).toEqual(["Dashboard", "Pipeline", "Inbox", "Clients", "Invoices", "Outbox"]);
    await userEvent.click(tabs.getByRole("link", { name: /Pipeline/ }));
    await expect(c.getByRole("heading", { level: 1 })).toHaveTextContent("Pipeline");
    await userEvent.click(c.getByRole("button", { name: "More" }));
    await expect((await screen.findAllByRole("menuitem")).map((m) => m.textContent?.trim())).toEqual(["Invite client", "Activity", "Settings", "New season"]);
    await userEvent.keyboard("{Escape}");
  },
};
