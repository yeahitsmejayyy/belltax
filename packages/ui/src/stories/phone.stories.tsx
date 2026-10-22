import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox, LayoutDashboard, Mail, Receipt, Search, UserPlus, Users, Workflow } from "lucide-react";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { BoardCard } from "../components/board";
import { BottomTabs, type BottomTab } from "../components/bottom-tabs";
import { DeviceFrame } from "../components/device-frame";
import { FloatingActionMenu } from "../components/floating-action-menu";
import { cards } from "./pipeline.fixtures";
import { fnSource } from "./fixtures";
import raw from "./phone.stories?raw";

// Phone navigation (admin 34-37, marketing 14), each on a real phone: DeviceFrame, an iPhone 16 Pro (402 × 874),
// centred on the canvas. On a page both are fixed to the bottom of the screen; the frame's screen is their screen here,
// and it keeps the home-bar strip clear the way iOS does, so the tabs sit above the curve of the corners. Both hide from
// md up, so the stories force them on with md:flex. The tabs are the admin's own (Dashboard … Outbox, with counts).
const meta: Meta = {
  title: "Admin/Phone navigation",
  parameters: { usage: 'import { BottomTabs, type BottomTab } from "@app/ui/components/bottom-tabs";\nimport { FloatingActionMenu } from "@app/ui/components/floating-action-menu";\nimport { DeviceFrame } from "@app/ui/components/device-frame"; // to show them on a phone' },
};
export default meta;
type Story = StoryObj;

const ADMIN_TABS: BottomTab[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pipeline", label: "Pipeline", icon: Workflow, badge: 27 },
  { key: "inbox", label: "Inbox", icon: Inbox, badge: 19 },
  { key: "clients", label: "Clients", icon: Users },
  { key: "invoices", label: "Invoices", icon: Receipt, badge: 1 },
  { key: "outbox", label: "Outbox", icon: Mail },
];

// The admin's phone navigation, live: tap a tab and the screen follows. Story state only; everything drawn is the
// design system's (BottomTabs on a DeviceFrame).
function AdminTabs() {
  const [active, setActive] = useState("pipeline");
  const tab = ADMIN_TABS.find((t) => t.key === active)!;
  return (
    <DeviceFrame>
      <div className="grid gap-3 p-4 pb-32">
        <h1 className="text-2xl font-semibold tracking-tight">{tab.label}</h1>
        {active === "pipeline" ? (
          cards.map((c) => <BoardCard key={c.id} {...c} />)
        ) : (
          <p className="text-muted-foreground">
            {tab.badge ? `${tab.badge} waiting here.` : "Nothing waiting here."} Tap another tab to move around.
          </p>
        )}
      </div>
      <BottomTabs
        className="md:block"
        active={active}
        tabs={ADMIN_TABS}
        renderLink={(t, children, className) => (
          <a
            href={`#${t.key}`}
            aria-current={t.key === active ? "page" : undefined}
            className={className}
            onClick={(e) => {
              e.preventDefault();
              setActive(t.key);
            }}
          >
            {children}
          </a>
        )}
      />
    </DeviceFrame>
  );
}

export const Tabs: Story = {
  name: "Bottom tabs",
  render: () => <AdminTabs />,
  parameters: { docs: { source: { code: fnSource(raw, "AdminTabs") } } },
};
export const TabsTest: Story = {
  ...Tabs,
  name: "Bottom tabs · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("link", { name: /Pipeline/ })).toHaveAttribute("aria-current", "page");
    await userEvent.click(c.getByRole("link", { name: /Inbox/ }));
    await expect(c.getByRole("link", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
    await expect(c.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    for (const link of c.getAllByRole("link")) await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};


const onSelect = fn();
export const QuickJump: Story = {
  name: "Floating action menu",
  render: () => (
    <DeviceFrame>
      <div className="grid gap-3 p-4">
        <h1 className="text-2xl font-semibold tracking-tight">Taxes Made Easy.</h1>
        <p className="text-muted-foreground">On a phone, the site's sections sit behind one round menu button.</p>
      </div>
      <FloatingActionMenu
        className="md:flex"
        items={[
          { label: "Invite client", icon: UserPlus, onSelect: () => onSelect("invite") },
          { label: "Search", icon: Search, onSelect: () => onSelect("search") },
        ]}
      />
    </DeviceFrame>
  )
};
export const QuickJumpTest: Story = {
  ...QuickJump,
  name: "Floating action menu · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const fab = c.getByRole("button", { name: "Quick actions" });
    await userEvent.click(fab);
    await expect(fab).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(c.getByRole("menuitem", { name: "Search" }));
    await expect(onSelect).toHaveBeenCalledWith("search");
    await userEvent.click(fab);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(c.queryByRole("menu")).toBeNull());
    await expect(fab).toHaveFocus();
  },
};

