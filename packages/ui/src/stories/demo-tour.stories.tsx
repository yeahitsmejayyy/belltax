import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DemoBar, DemoFrontDoor, TryThis } from "../components/demo-tour";

// The hosted public demo's guide (ticket 45): the front door, the strip across the top, and "Try this" hints.
const meta: Meta = { title: "Admin/Demo tour" };
export default meta;

const CLIENT_TIPS = [
  { id: "doc", label: "Send a document again", detail: "One was rejected. See why, then replace it.", href: "#documents" },
  { id: "letter", label: "Sign the engagement letter", detail: "Read it, type your name, sign.", href: "#letter" },
  { id: "questions", label: "Answer a question", detail: "Answers save as you go.", href: "#questions" },
];

export const FrontDoor: StoryObj<typeof DemoFrontDoor> = {
  render: (args) => (
    <div className="max-w-3xl">
      <DemoFrontDoor {...args} />
    </div>
  ),
  args: { clientName: "Renata Torres-Farouk", onClient: fn(), onAgent: fn(), onPickAny: fn() },
};
export const FrontDoorTest: StoryObj<typeof DemoFrontDoor> = {
  ...FrontDoor,
  name: "Front door · test",
  tags: ["!dev"],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: /See it as a client/ }));
    await expect(args.onClient).toHaveBeenCalled();
    await userEvent.click(c.getByRole("button", { name: /See it as the tax agent/ }));
    await expect(args.onAgent).toHaveBeenCalled();
    await userEvent.click(c.getByRole("button", { name: "Or pick any of the invented clients" }));
    await expect(args.onPickAny).toHaveBeenCalled();
    await expect(c.getByText(/Renata's return/)).toBeInTheDocument();
  },
};

export const BarAsClient: StoryObj<typeof DemoBar> = { render: (args) => <DemoBar {...args} />, args: { viewingAs: "client", onSwitch: fn() } };
export const BarAsAgent: StoryObj<typeof DemoBar> = { render: (args) => <DemoBar {...args} />, args: { viewingAs: "agent", onSwitch: fn() } };
export const BarTest: StoryObj<typeof DemoBar> = {
  ...BarAsClient,
  name: "Bar · test",
  tags: ["!dev"],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("region", { name: "Demo" })).toHaveTextContent("Public demo · invented data");
    await userEvent.click(c.getByRole("button", { name: /Switch to the tax agent/ }));
    await expect(args.onSwitch).toHaveBeenCalled();
  },
};

export const Tips: StoryObj<typeof TryThis> = { render: (args) => <TryThis {...args} />, args: { items: CLIENT_TIPS, onDismiss: fn() } };
export const TipsTest: StoryObj<typeof TryThis> = {
  ...Tips,
  name: "Tips · test",
  tags: ["!dev"],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getAllByRole("link")).toHaveLength(3);
    await expect(c.getByRole("link", { name: /Sign the engagement letter/ })).toHaveAttribute("href", "#letter");
    await userEvent.click(c.getByRole("button", { name: "Hide these tips" }));
    await expect(args.onDismiss).toHaveBeenCalled();
  },
};
