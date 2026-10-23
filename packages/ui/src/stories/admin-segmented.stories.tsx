import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Segmented } from "../components/segmented";
import { fnSource } from "./fixtures";
import raw from "./admin-segmented.stories?raw";

// A row of joined toggle buttons (admin 29 invoice tabs, 30 actor filter). One is always pressed, marked by weight
// and fill and by aria-pressed. Controlled: the options are data, the pressed one is `value`.
const meta: Meta<typeof Segmented> = {
  title: "Admin/Lists/Segmented",
  component: Segmented,
  parameters: { usage: 'import { Segmented, type SegmentedOption } from "@app/ui/components/segmented";' },
};
export default meta;
type Story = StoryObj<typeof Segmented>;

const picked = fn();

function InvoiceTabs() {
  const [tab, setTab] = useState("all");
  return (
    <Segmented
      label="Invoices"
      value={tab}
      onChange={(v) => (picked(v), setTab(v))}
      options={[
        { value: "all", label: "All · 14" },
        { value: "open", label: "Open · 5" },
        { value: "failed", label: "Failed · 2" },
        { value: "paid", label: "Paid · 7" },
      ]}
    />
  );
}

export const Default: Story = { render: () => <InvoiceTabs />, parameters: { docs: { source: { code: fnSource(raw, "InvoiceTabs") } } } };

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("group", { name: "Invoices" })).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "All · 14" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(c.getByRole("button", { name: "Failed · 2" }));
    await expect(picked).toHaveBeenLastCalledWith("failed");
    await expect(c.getByRole("button", { name: "Failed · 2" })).toHaveAttribute("aria-pressed", "true");
    await expect(c.getByRole("button", { name: "All · 14" })).toHaveAttribute("aria-pressed", "false");
  },
};
