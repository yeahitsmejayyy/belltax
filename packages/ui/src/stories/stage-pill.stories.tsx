import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stage } from "@app/schema";
import { expect, within } from "storybook/test";

import { STAGE_META, StagePill, WAITING_LABEL, WAITING_TONE } from "../components/stage-pill";

const meta: Meta<typeof StagePill> = {
  title: "Admin/StagePill",
  component: StagePill,
  args: { stage: "preparing" },
  argTypes: { stage: { control: "select", options: Stage.options } },
};
export default meta;
type Story = StoryObj<typeof StagePill>;

export const One: Story = {};

// Every stage, in pipeline order, with who it's waiting on. Reference: the dashboard's "Returns by stage".
export const AllStages: Story = {
  name: "All stages",
  render: () => (
    <div className="grid w-fit gap-2">
      {Stage.options.map((s) => (
        <div key={s} className="flex items-center gap-4">
          <StagePill stage={s} />
          <span className="text-xs text-muted-foreground">{WAITING_LABEL[STAGE_META[s].waiting]}</span>
        </div>
      ))}
    </div>
  ),
  // Rule 6: never colour alone. Every pill has a visible word and an icon, and the tone follows who waits.
  play: async ({ canvasElement }) => {
    for (const s of Stage.options) {
      const pill = canvasElement.querySelector(`[data-stage="${s}"]`)!;
      await expect(pill).toHaveTextContent(STAGE_META[s].label);
      await expect(pill.querySelector("svg")).not.toBeNull();
      await expect(pill.getAttribute("data-tone")).toBe(WAITING_TONE[STAGE_META[s].waiting]);
    }
    await expect(within(canvasElement).getAllByText("Waiting on you")).toHaveLength(2);
  },
};
