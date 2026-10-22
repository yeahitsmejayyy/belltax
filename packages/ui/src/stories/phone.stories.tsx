import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { FileText, Inbox, LayoutDashboard, Search, UserPlus, Workflow } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { BottomTabs } from "../components/bottom-tabs";
import { FloatingActionMenu } from "../components/floating-action-menu";

// Phone navigation (admin 34-37, marketing 14), each in a 402 × 874 phone frame (an iPhone 16 Pro) centred on the canvas (ticket 56). On a
// real page both are fixed to the bottom of the screen; the frame's transform makes it their screen here, so they sit
// where they would on a phone. Both hide from md up, so the stories force them on with md:flex.
const meta: Meta = { title: "Admin/Phone navigation" };

function PhoneScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[874px] max-h-[calc(100svh-4rem)] w-[402px] max-w-full transform-gpu overflow-hidden rounded-[2.5rem] border-[3px] border-border bg-background shadow-2xl">
      <div className="absolute top-2.5 left-1/2 h-7 w-28 -translate-x-1/2 rounded-full bg-foreground/15" />
      {children}
    </div>
  );
}
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { BottomTabs } from \"@app/ui/components/bottom-tabs\";\nimport { FloatingActionMenu } from \"@app/ui/components/floating-action-menu\";" };
export default meta;
type Story = StoryObj;

export const Tabs: Story = {
  name: "Bottom tabs",
  render: () => (
    <PhoneScreen>
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
    </PhoneScreen>
  )
};
export const TabsTest: Story = {
  ...Tabs,
  name: "Bottom tabs · test",
  tags: ["!dev", "!autodocs"],
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
    <PhoneScreen>
      <FloatingActionMenu
        className="md:flex"
        items={[
          { label: "Invite client", icon: UserPlus, onSelect: () => onSelect("invite") },
          { label: "Search", icon: Search, onSelect: () => onSelect("search") },
        ]}
      />
    </PhoneScreen>
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

