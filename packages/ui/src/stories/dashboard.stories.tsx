import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Dashboard, DashboardLoading } from "../components/dashboard";
import { BEFORE_SEASON, SUMMARY } from "./admin-dashboard.fixtures";

// The preparer's dashboard (admin 03-dashboard-dashboard, 34-phone-m-dashboard), the same component
// apps/admin/src/pages/dashboard.tsx renders. The summary is dashboard.summary's shape (./admin-dashboard.fixtures.ts);
// links and the health checks' buttons are the app's. Invented numbers.
const meta: Meta<typeof Dashboard> = {
  title: "Admin/Dashboard/Dashboard",
  component: Dashboard,
  parameters: { fill: true, usage: 'import { Dashboard, DashboardLoading } from "@app/ui/components/dashboard";' },
  args: {
    summary: SUMMARY,
    taxYear: 2026,
    stageHref: (stage) => `/pipeline?stage=${stage}`,
    renderLink: (href, className, children) => (
      <a href={href} className={className} onClick={(e) => e.preventDefault()}>
        {children}
      </a>
    ),
    healthAction: (h) => (h.count > 0 ? { label: h.key === "inbox" ? "Open" : "Review", onClick: fn() } : undefined),
  },
};
export default meta;
type Story = StoryObj<typeof Dashboard>;

export const InSeason: Story = { name: "In season" };
export const BeforeSeason: Story = { name: "Before the season opens", args: { summary: BEFORE_SEASON } };
export const Loading: Story = { render: () => <DashboardLoading /> };

const reviewed = fn();
export const InSeasonTest: Story = {
  ...InSeason,
  name: "In season · test",
  tags: ["!dev", "!autodocs"],
  args: { healthAction: (h) => (h.count > 0 ? { label: h.key === "inbox" ? "Open" : "Review", onClick: () => reviewed(h.link) } : undefined) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("6 of 27")).toBeInTheDocument();
    await expect(c.getByRole("link", { name: /Documents/ })).toHaveAttribute("href", "/pipeline?stage=documents");
    await expect(c.getByText("2 need attention")).toBeInTheDocument();
    // A check with nothing to look at has no button.
    await expect(c.getAllByRole("button", { name: /Review|Open/ })).toHaveLength(3);
    await userEvent.click(c.getByRole("button", { name: "Open" }));
    await expect(reviewed).toHaveBeenCalledWith("/inbox");
  },
};
