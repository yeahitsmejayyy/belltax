import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { PipelineEmpty, PipelineLoading, PipelineNoMatch } from "../components/pipeline";

// The pipeline before there's anything to show (admin 08-pipeline-empty): the first-run state with the invite, the
// filters leaving nothing, and the shape while the year's returns load.
const meta: Meta<typeof PipelineEmpty> = {
  title: "Admin/Pipeline/PipelineEmpty",
  component: PipelineEmpty,
  parameters: { fill: true, usage: 'import { PipelineEmpty, PipelineLoading, PipelineNoMatch } from "@app/ui/components/pipeline";' },
  args: { taxYear: 2026, onInvite: fn() },
};
export default meta;
type Story = StoryObj<typeof PipelineEmpty>;

export const FirstRun: Story = { name: "No returns yet" };
export const NoMatch: Story = { name: "Nothing matches the filters", render: () => <PipelineNoMatch onClear={fn()} /> };
export const Loading: Story = { render: () => <PipelineLoading /> };

export const FirstRunTest: Story = {
  ...FirstRun,
  name: "No returns yet · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByText("No returns for TY 2026 yet")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Invite your first client" }));
    await expect(args.onInvite).toHaveBeenCalledTimes(1);
  },
};
