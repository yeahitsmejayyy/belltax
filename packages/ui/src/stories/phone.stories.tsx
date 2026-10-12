import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, Inbox, LayoutDashboard, Search, UserPlus, Workflow } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { BottomTabs } from "../components/bottom-tabs";
import { FloatingActionMenu } from "../components/floating-action-menu";

// Phone navigation (admin 34-37, marketing 14). Both hide at md and up; view these at a phone width.
const meta: Meta = { title: "Admin/Phone navigation", parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile1" } } };
export default meta;
type Story = StoryObj;

export const Tabs: Story = {
  name: "Bottom tabs",
  render: () => (
    <div className="h-[420px]">
      <BottomTabs
        className="md:flex"
        active="pipeline"
        tabs={[
          { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { key: "pipeline", label: "Pipeline", icon: Workflow },
          { key: "inbox", label: "Inbox", icon: Inbox, badge: 11 },
          { key: "returns", label: "Returns", icon: FileText },
        ]}
        renderLink={(t, children, cls) => <a href={`#${t.key}`} aria-current={t.key === "pipeline" ? "page" : undefined} className={cls}>{children}</a>}
      />
    </div>
  )
};
export const TabsTest: Story = {
  ...Tabs,
  name: "Bottom tabs · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("link", { name: /Pipeline/ })).toHaveAttribute("aria-current", "page");
    for (const link of c.getAllByRole("link")) await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};


const onSelect = fn();
export const QuickJump: Story = {
  name: "Floating action menu",
  render: () => (
    <div className="h-[420px]">
      <FloatingActionMenu
        className="md:flex"
        items={[
          { label: "Invite client", icon: UserPlus, onSelect: () => onSelect("invite") },
          { label: "Search", icon: Search, onSelect: () => onSelect("search") },
        ]}
      />
    </div>
  )
};
export const QuickJumpTest: Story = {
  ...QuickJump,
  name: "Floating action menu · test",
  tags: ["!dev"],
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

