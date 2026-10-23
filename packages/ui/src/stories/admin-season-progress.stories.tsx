import type { Meta, StoryObj } from "@storybook/react-vite";

import { SeasonProgress } from "../components/dashboard";
import { SUMMARY } from "./admin-dashboard.fixtures";

// The line at the top of the dashboard: which phase of the season it is, days to the deadline, and how far through.
const meta: Meta<typeof SeasonProgress> = {
  title: "Admin/Dashboard/SeasonProgress",
  component: SeasonProgress,
  parameters: { fill: true, usage: 'import { SeasonProgress } from "@app/ui/components/dashboard";' },
  args: { season: SUMMARY.season, taxYear: 2026 },
};
export default meta;
type Story = StoryObj<typeof SeasonProgress>;

export const Regular: Story = {};
export const BeforeItOpens: Story = { args: { season: { ...SUMMARY.season, phase: "before", day: 0 } } };
export const Extension: Story = { args: { season: { phase: "extension", opensOn: "2027-01-26", deadline: "2027-10-15", daysToDeadline: 62, day: 121, length: 183 } } };
export const Closed: Story = { args: { season: { ...SUMMARY.season, phase: "closed", day: 183, length: 183 } } };
