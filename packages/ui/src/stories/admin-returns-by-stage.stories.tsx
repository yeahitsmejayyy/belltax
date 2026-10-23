import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { ReturnsByStageCard } from "../components/dashboard";
import { SUMMARY } from "./admin-dashboard.fixtures";

// A bar per stage, coloured by who it's waiting on. Each row is a link the app draws (`renderLink`, its router's
// Link) to `stageHref(stage)`; a plain <a href> by default.
const meta: Meta<typeof ReturnsByStageCard> = {
  title: "Admin/Dashboard/ReturnsByStageCard",
  component: ReturnsByStageCard,
  parameters: { usage: 'import { ReturnsByStageCard } from "@app/ui/components/dashboard";' },
  decorators: [(Story) => <div className="w-[36rem] max-w-full">{Story()}</div>],
  args: { byStage: SUMMARY.byStage, stageHref: (stage) => `/pipeline?stage=${stage}` },
};
export default meta;
type Story = StoryObj<typeof ReturnsByStageCard>;

export const Default: Story = {};
export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const links = within(canvasElement).getAllByRole("link");
    await expect(links).toHaveLength(8);
    await expect(links[2]).toHaveAttribute("href", "/pipeline?stage=documents");
    // The longest bar fills the track; the legend names every colour (never colour alone).
    await expect(canvasElement.querySelector("[style='width: 100%;']")).not.toBeNull();
    await expect(within(canvasElement).getByText("Waiting on IRS and FTB")).toBeInTheDocument();
  },
};
