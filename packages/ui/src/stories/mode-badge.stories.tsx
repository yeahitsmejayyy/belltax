import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { ModeBadge } from "../components/mode-badge";

const meta: Meta<typeof ModeBadge> = { title: "Product/ModeBadge", component: ModeBadge, parameters: { layout: "padded" } };
export default meta;
type Story = StoryObj<typeof ModeBadge>;

export const Demo: Story = {
  args: { mode: "demo", className: "w-64" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Demo · sample data");
  },
};
export const Live: Story = {
  args: { mode: "live", className: "w-64" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Live · client data");
  },
};
