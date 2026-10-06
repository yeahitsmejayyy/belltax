import type { Meta, StoryObj } from "@storybook/react-vite";
import { Activity, Inbox, LayoutDashboard, Receipt, UserPlus, Users, Workflow } from "lucide-react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import { AppHeader } from "../components/app-header";
import { AppSidebar, type NavItem } from "../components/app-sidebar";
import { SidebarInset, SidebarProvider } from "../components/sidebar";
import { Skeleton } from "../components/skeleton";
import { SplitButton } from "../components/split-button";
import { InviteClientDialog, type InviteDraft } from "../components/invite-client-dialog";
import { ThemeProvider } from "../components/theme-provider";
import { SAMPLE, searchGroups } from "./fixtures";

// The admin shell, as in every .assets/screens/admin/desktop/ screen: the sidebar, and the header with the
// trigger, a divider, the page title, search (⌘K), the theme toggle and Invite client. ⌘B collapses the
// sidebar to icons; on a phone it's a sheet. Counts: plain totals (Pipeline), waiting on you (Inbox),
// problems (Invoices).
const meta: Meta = { title: "Product/App shell", parameters: { shell: true } };
export default meta;
type Story = StoryObj;

const ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pipeline", label: "Pipeline", icon: Workflow, count: 27 },
  { key: "inbox", label: "Inbox", icon: Inbox, count: 11, countTone: "brand" },
  { key: "clients", label: "Clients", icon: Users },
  { key: "invoices", label: "Invoices", icon: Receipt, count: 3, countTone: "danger" },
  { key: "activity", label: "Activity", icon: Activity },
];

function Shell({ defaultOpen = true, loading = false }: { defaultOpen?: boolean; loading?: boolean }) {
  const [active, setActive] = useState("pipeline");
  const [year, setYear] = useState(2026);
  const [last, setLast] = useState("");
  const [invite, setInvite] = useState<InviteDraft["mode"] | null>(null);
  const title = active === "settings" ? "Settings" : ITEMS.find((i) => i.key === active)?.label;
  return (
    <ThemeProvider storageKey={null}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar
          items={ITEMS}
          active={active}
          taxYears={[2026, 2025, 2024]}
          taxYear={year}
          onTaxYearChange={setYear}
          user={{ name: "Patrick J. Bell", email: "pj@belltaxprep.example" }}
          mode="demo"
          onSettings={() => setActive("settings")}
          onLogout={() => {}}
          renderLink={(item, children) => (
            <a
              href={`#${item.key}`}
              aria-current={item.key === active ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setActive(item.key);
              }}
            >
              {children}
            </a>
          )}
        />
        <SidebarInset>
          <AppHeader
            title={title}
            search={{ groups: searchGroups((to) => setActive(to.startsWith("client") ? "clients" : to.startsWith("invoice") ? "invoices" : to === "settings" ? "settings" : "pipeline")) }}
            action={
              <SplitButton
                label={<><UserPlus /> Invite client</>}
                onClick={() => { setLast("invite"); setInvite("invite"); }}
                menuLabel="More ways to add a client"
                items={[{ label: "Add client without invite", description: "Set up the household now; invite them later.", onSelect: () => { setLast("add"); setInvite("add"); } }]}
              />
            }
          />
          <main className="flex-1 p-6" data-testid="page" data-last={last}>
            {loading ? (
              // .assets/screens/admin/desktop/02-access-loading.png
              <div className="grid gap-5" aria-busy="true" aria-label="Loading the pipeline">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-9 w-full max-w-3xl" />
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96 rounded-xl" />)}
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                {active} · TY {year}
              </div>
            )}
          </main>
        </SidebarInset>
        <InviteClientDialog
          open={invite !== null}
          onOpenChange={(o) => !o && setInvite(null)}
          mode={invite ?? "invite"}
          taxYear={year}
          preparerName="Patrick J. Bell"
          sample={SAMPLE}
          onSubmit={() => new Promise((r) => setTimeout(r, 300))}
        />
      </SidebarProvider>
    </ThemeProvider>
  );
}

export const Expanded: Story = { render: () => <Shell /> };
export const Loading: Story = { name: "Loading a page", render: () => <Shell loading /> };
export const Collapsed: Story = { name: "Collapsed to icons", render: () => <Shell defaultOpen={false} /> };
export const Phone: Story = { render: () => <Shell />, globals: { viewport: { value: "mobile1", isRotated: false } } };

export const ExpandedTest: Story = {
  name: "Expanded · test",
  tags: ["!dev"],
  render: () => <Shell />,
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const page = () => c.getByTestId("page");
    await step("links navigate, mark the page and title the header", async () => {
      await userEvent.click(c.getByRole("link", { name: "Inbox" }));
      await expect(page()).toHaveTextContent("inbox");
      await expect(c.getByRole("link", { name: "Inbox" })).toHaveAttribute("aria-current", "page");
      await expect(c.getByRole("heading", { level: 1 })).toHaveTextContent("Inbox");
    });
    await step("counts are read with their meaning", async () => {
      await expect(c.getByLabelText("3 invoices")).toHaveTextContent("3");
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
  tags: ["!dev"],
  render: () => <Shell defaultOpen={false} />,
  play: async ({ canvasElement }) => {
    const visible = (el: Element) => el.getBoundingClientRect().width > 0;
    const cx = (el: Element) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
    await waitFor(() => {
      const mark = [...canvasElement.querySelectorAll('[data-sidebar="header"] svg[viewBox="0 0 128 128"]')].find(visible)!;
      const buttons = [...canvasElement.querySelectorAll('[data-sidebar="menu-button"]')].filter(visible);
      expect(buttons).toHaveLength(8); // six nav items, Settings, the user
      for (const b of buttons) expect(Math.abs(cx(b) - cx(mark))).toBeLessThan(1);
    });
  },
};
