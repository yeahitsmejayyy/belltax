import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { InvoiceCards, InvoicesEmpty, InvoicesLoading, InvoiceTable, InvoiceTabs, type InvoiceListTab } from "../components/invoice-list";
import { INVOICE_ROWS, invoiceCounts } from "./admin-lists.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-invoices.stories?raw";

// Invoices across the practice (admin 29-clients-invoices-and-activity-invoices), put together from the same
// components apps/admin/src/pages/invoices.tsx renders: the tabs with counts and what's outstanding, then a table from
// md up and cards on a phone. A row opens its return's billing. Invented data.
const meta: Meta = { title: "Admin/Invoices/InvoiceList" };
meta.parameters = {
  ...meta.parameters,
  usage: 'import { InvoiceCards, InvoicesEmpty, InvoicesLoading, InvoiceTable, InvoiceTabs } from "@app/ui/components/invoice-list";',
};
export default meta;
type Story = StoryObj;

const opened = fn();
const billing = (r: { id: string }) => `#/returns/${r.id}/billing`;

function InvoicesScreen() {
  const [tab, setTab] = useState<InvoiceListTab>("all");
  const rows = INVOICE_ROWS.filter((r) => tab === "all" || r.tab === tab);
  const outstanding = INVOICE_ROWS.filter((r) => r.tab !== "paid" && r.tab !== "draft" && r.tab !== "void").reduce((s, r) => s + r.totalCents, 0);
  return (
    <div className="grid w-[64rem] max-w-full grid-cols-1 animate-page gap-4">
      <InvoiceTabs value={tab} counts={invoiceCounts(INVOICE_ROWS)} onChange={setTab} outstandingCents={outstanding} />
      {rows.length === 0 ? (
        <InvoicesEmpty tab={tab} />
      ) : (
        <>
          <InvoiceTable rows={rows} href={billing} onOpen={(r) => opened(r.id)} />
          <InvoiceCards rows={rows} href={billing} />
        </>
      )}
    </div>
  );
}

export const Screen: Story = { render: () => <InvoicesScreen />, parameters: { docs: { source: { code: fnSource(raw, "InvoicesScreen") } } } };
export const Phone: Story = { ...Screen, name: "Phone (402)", globals: { viewport: { value: "phone", isRotated: false } } };
export const Empty: Story = { name: "No void invoices", render: () => <InvoicesEmpty tab="void" /> };
export const Loading: Story = { render: () => <InvoicesLoading /> };

export const ScreenTest: Story = {
  ...Screen,
  name: "Screen · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByText("$1,710.00 outstanding · 1 failed · 1 overdue")).toBeInTheDocument();
    await step("a tab shows only its invoices", async () => {
      const tabs = within(c.getByRole("group", { name: "Invoices to show" }));
      await userEvent.click(tabs.getByRole("button", { name: "Failed 1" }));
      await expect(tabs.getByRole("button", { name: "Failed 1" })).toHaveAttribute("aria-pressed", "true");
      await expect(c.getAllByText("Failed · Card declined · Feb 8").length).toBeGreaterThan(0);
      await expect(c.queryByText("Lindqvist")).toBeNull();
      await userEvent.click(tabs.getByRole("button", { name: "Void 0" }));
      await expect(c.getByText("No void invoices")).toBeInTheDocument();
      await userEvent.click(tabs.getByRole("button", { name: "All 6" }));
    });
    await step("a click on a table row opens it", async () => {
      const table = c.getByRole("table");
      await userEvent.click(within(table).getByText("Thornbury"));
      await expect(opened).toHaveBeenCalledWith("inv-2");
    });
  },
};
