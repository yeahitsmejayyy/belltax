import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { FilingsPerWeekCard, filingWeeks } from "../components/dashboard";
import { SUMMARY } from "./admin-dashboard.fixtures";

// Returns filed per week, this season against last. `filingWeeks` turns the server's weeks into chart rows ("Feb 9").
const meta: Meta<typeof FilingsPerWeekCard> = {
  title: "Admin/Dashboard/FilingsPerWeekCard",
  component: FilingsPerWeekCard,
  parameters: { usage: 'import { FilingsPerWeekCard, filingWeeks } from "@app/ui/components/dashboard";' },
  decorators: [(Story) => <div className="w-[36rem] max-w-full">{Story()}</div>],
  args: { weeks: filingWeeks(SUMMARY.filingsPerWeek.weeks), filedSoFar: 6, lastYearBySameDay: 10 },
};
export default meta;
type Story = StoryObj<typeof FilingsPerWeekCard>;

export const Default: Story = {};
export const BeforeSeason: Story = { name: "Before the season opens", args: { weeks: [], filedSoFar: 0, lastYearBySameDay: 0 } };

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    // Recharts draws after it measures its box, which can take a frame or two on a slower runner (Chromatic): wait.
    await expect(await within(canvasElement).findByText("This season", {}, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => expect(canvasElement.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThan(0), { timeout: 5000 });
  },
};
