import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Logo, ShieldLoader } from "../components/logo";

const meta: Meta = { title: "Product/Brand", parameters: { layout: "padded" } };
export default meta;
type Story = StoryObj;

export const Wordmark: Story = {
  render: () => (
    <div className="grid gap-6">
      <Logo size="sm" />
      <Logo subtitle="Preparer admin" />
      <Logo size="lg" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText("BellTaxPrep")).toHaveLength(3);
  },
};

// "The sign-in loader pulses the shield."
export const Loader: Story = {
  render: () => <ShieldLoader label="Signing you in" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Signing you in");
  },
};
