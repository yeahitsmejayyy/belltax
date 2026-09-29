import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Upload } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "../components/button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Upload document", onClick: fn() },
  argTypes: {
    variant: { control: "select", options: ["default", "outline", "secondary", "ghost", "link", "destructive"] },
    size: { control: "select", options: ["sm", "default", "lg", "touch", "icon", "icon-touch"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

// Rule 1: one of these per screen.
export const Primary: Story = {
};
export const PrimaryTest: Story = {
  ...Primary,
  name: "Primary · test",
  tags: ["!dev"],
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Upload document" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Outline: Story = { args: { variant: "outline", children: "Save for later" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Add someone" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Cancel" } };
export const Link: Story = { args: { variant: "link", children: "See what we asked for" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Reject document" } };
export const WithIcon: Story = { args: { children: <><Upload /> Upload document</> } };

export const Disabled: Story = {
  args: { disabled: true, children: "Pay invoice" }
};
export const DisabledTest: Story = {
  ...Disabled,
  name: "Disabled · test",
  tags: ["!dev"],
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: "Pay invoice" });
    await expect(button).toBeDisabled();
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};


// Rule 4: 44px on phones.
export const Touch: Story = {
  args: { size: "touch", children: "Sign the letter" }
};
export const TouchTest: Story = {
  ...Touch,
  name: "Touch · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Sign the letter" });
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};

export const IconTouch: Story = {
  args: { size: "icon-touch", "aria-label": "Add", children: <Plus /> }
};
export const IconTouchTest: Story = {
  ...IconTouch,
  name: "Icon Touch · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const { width, height } = within(canvasElement).getByRole("button", { name: "Add" }).getBoundingClientRect();
    await expect(Math.min(width, height)).toBeGreaterThanOrEqual(44);
  },
};


export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">Small</Button>
      <Button {...args}>Default</Button>
      <Button {...args} size="lg">Large</Button>
      <Button {...args} size="touch">Touch (44px)</Button>
    </div>
  ),
};
