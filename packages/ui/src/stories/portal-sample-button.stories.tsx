import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { SampleButton } from "../components/client-documents";

// The public demo's stand-in for an upload (ticket 46): the visitor sends an invented sample instead of a file. What
// sending does is the app's business; the button shows the label, and "Sending…" while it's pending.
const meta: Meta<typeof SampleButton> = {
  title: "Portal/Documents/SampleButton",
  component: SampleButton,
  parameters: { usage: 'import { SampleButton } from "@app/ui/components/client-documents";' },
  args: { label: "Use a sample document", variant: "outline", pending: false, onClick: fn() },
  argTypes: { variant: { control: "select", options: ["outline", "ghost", "default"] } },
};
export default meta;
type Story = StoryObj<typeof SampleButton>;

export const Default: Story = {};
export const Pending: Story = { args: { pending: true } };
export const SendAgain: Story = { name: "Send again (after a rejection)", args: { label: "Send a sample again" } };

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Use a sample document" }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const PendingTest: Story = {
  ...Pending,
  name: "Pending · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Sending…" });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
  },
};
