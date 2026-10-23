import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { StageProgress } from "../components/client-home";
import { HOME_REACHED } from "./client-home.fixtures";

// Where the return stands, in the client's words (ticket 57): stages done are checked with the day they were reached,
// the current one says what's happening now. Stage names and the "now" lines can be replaced. Invented data.
const meta: Meta<typeof StageProgress> = {
  title: "Portal/Home/StageProgress",
  component: StageProgress,
  parameters: { usage: 'import { StageProgress } from "@app/ui/components/client-home";' },
  args: { stage: "documents", reached: HOME_REACHED, preparer: "Morgan" },
  argTypes: { stage: { control: "select", options: ["invited", "intake", "documents", "ready", "preparing", "review", "filed", "complete"] } },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof StageProgress>;

export const Documents: Story = {};
export const Complete: Story = { args: { stage: "complete" } };
export const OwnWords: Story = { name: "Own words", args: { labels: { review: "Approve it" }, messages: { documents: () => "Send what's on your list." } } };

export const StageProgressTest: Story = {
  name: "StageProgress · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/Step 3 of 8 · Documents/)).toBeInTheDocument();
  },
};
