import type { Meta, StoryObj } from "@storybook/react-vite";

import { DashboardKpis } from "../components/dashboard";
import { BEFORE_SEASON, SUMMARY } from "./admin-dashboard.fixtures";

// The dashboard's four headline numbers (admin 03-dashboard-dashboard): filed, collected, waiting on you and days in
// stage, from dashboard.summary. Invented numbers.
const meta: Meta<typeof DashboardKpis> = {
  title: "Admin/Dashboard/DashboardKpis",
  component: DashboardKpis,
  parameters: { fill: true, usage: 'import { DashboardKpis } from "@app/ui/components/dashboard";' },
  args: { returns: SUMMARY.returns, money: SUMMARY.money, waitingOnYou: SUMMARY.waitingOnYou, daysInStage: SUMMARY.daysInStage },
};
export default meta;
type Story = StoryObj<typeof DashboardKpis>;

export const InSeason: Story = { name: "In season" };
export const BeforeSeason: Story = {
  name: "Before the season opens",
  args: { returns: BEFORE_SEASON.returns, money: BEFORE_SEASON.money, waitingOnYou: BEFORE_SEASON.waitingOnYou, daysInStage: BEFORE_SEASON.daysInStage },
};
