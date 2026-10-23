import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { BillingTab, RecordPaymentDialog, VoidInvoiceDialog, type BillingInvoice, type BillingPayment } from "../components/return-billing";
import { BILLING_INVOICES, BILLING_PAYMENTS, BILLING_TODAY, DRAFT_INVOICE, FAILED_INVOICE, FAILED_PAYMENTS } from "./admin-return-billing.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-billing-tab.stories?raw";

// A return's Billing tab (admin 17-return-detail-return-billing), as apps/admin/src/pages/return/billing-tab.tsx
// renders it: each invoice with its lines, what it includes (named, never $0), paid and balance, then every payment
// attempt. The screen below records payments and voids on the invented invoices the way the server would.
const meta: Meta<typeof BillingTab> = {
  title: "Admin/Return/BillingTab",
  component: BillingTab,
  args: { invoices: BILLING_INVOICES, payments: BILLING_PAYMENTS, onCreate: fn(), onSend: fn(), onPay: fn(), onVoid: fn() },
  decorators: [(Story) => <div className="w-[56rem] max-w-full">{Story()}</div>],
};
meta.parameters = {
  ...meta.parameters,
  usage: 'import { BillingTab, RecordPaymentDialog, VoidInvoiceDialog } from "@app/ui/components/return-billing";',
};
export default meta;
type Story = StoryObj<typeof BillingTab>;

function BillingScreen() {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([DRAFT_INVOICE, FAILED_INVOICE]);
  const [payments, setPayments] = useState<BillingPayment[]>(FAILED_PAYMENTS);
  const [paying, setPaying] = useState<BillingInvoice | null>(null);
  const [voiding, setVoiding] = useState<BillingInvoice | null>(null);
  const change = (id: string, f: (i: BillingInvoice) => BillingInvoice) => setInvoices((all) => all.map((i) => (i.id === id ? f(i) : i)));
  return (
    <BillingTab
      invoices={invoices}
      payments={payments}
      onCreate={() => {}}
      onSend={(inv) => change(inv.id, (i) => ({ ...i, status: "issued", settlement: "unpaid", due: "Nov 5" }))}
      onPay={setPaying}
      onVoid={setVoiding}
    >
      <RecordPaymentDialog
        invoice={paying}
        today={BILLING_TODAY}
        onClose={() => setPaying(null)}
        onRecord={(p) => {
          const id = paying!.id;
          change(id, (i) => {
            const paid = i.paidCents + p.amountCents;
            return { ...i, paidCents: paid, balanceCents: i.totalCents - paid, settlement: paid >= i.totalCents ? "paid" : "partial", payments: [...i.payments, { status: "succeeded" }] };
          });
          setPayments((all) => [{ id: `pay-${all.length + 10}`, when: "Oct 22, 2026", provider: "manual", method: p.method, amountCents: p.amountCents, status: "succeeded", failureMessage: null, note: p.note ?? null }, ...all]);
          setPaying(null);
        }}
      />
      <VoidInvoiceDialog
        invoice={voiding}
        onClose={() => setVoiding(null)}
        onVoid={() => {
          change(voiding!.id, (i) => ({ ...i, status: "void", settlement: "void" }));
          setVoiding(null);
        }}
      />
    </BillingTab>
  );
}

export const Screen: Story = { render: () => <BillingScreen />, parameters: { docs: { source: { code: fnSource(raw, "BillingScreen") } } } };
export const PaidInPart: Story = { name: "Partly paid, and a void invoice" };
export const FailedAttempt: Story = { name: "Latest attempt failed", args: { invoices: [FAILED_INVOICE], payments: FAILED_PAYMENTS } };
export const Draft: Story = { name: "A draft, not sent", args: { invoices: [DRAFT_INVOICE], payments: [] } };
export const Sending: Story = { name: "Sending a draft", args: { invoices: [DRAFT_INVOICE], payments: [], sendingId: DRAFT_INVOICE.id } };
export const Empty: Story = { name: "No invoice yet", args: { invoices: [], payments: [] } };

export const ScreenTest: Story = {
  ...Screen,
  name: "Send, record a payment, void · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByText("The latest payment attempt failed.")).toBeInTheDocument();
    await expect(c.getByText("Your card has insufficient funds.")).toBeInTheDocument();

    await step("Send the draft", async () => {
      await userEvent.click(c.getByRole("button", { name: "Send to client" }));
      await expect(c.queryByRole("button", { name: "Send to client" })).toBeNull();
      await expect(c.getAllByText("Sent · due Nov 5", { exact: false })).toHaveLength(2);
    });

    await step("Record a check for part of the failed invoice", async () => {
      await userEvent.click(c.getAllByRole("button", { name: "Record payment…" })[1]!);
      const d = within(await screen.findByRole("dialog", { name: "Record a payment on INV-2042" }));
      const amount = d.getByLabelText("Amount");
      await expect(amount).toHaveValue("375.00");
      // More than the balance is refused.
      await userEvent.clear(amount);
      await userEvent.type(amount, "400");
      await userEvent.click(d.getByRole("button", { name: "Record payment" }));
      await expect(await d.findByText("That's more than the $375.00 still owed.")).toBeInTheDocument();
      await userEvent.clear(amount);
      await userEvent.type(amount, "$100.00");
      await userEvent.type(d.getByLabelText("Note"), "Check no. 2210.");
      await userEvent.click(d.getByRole("button", { name: "Record payment" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expect(c.getByText("Check no. 2210.")).toBeInTheDocument();
      await expect(c.getByText("$275.00")).toBeInTheDocument();
      // Money received: it can't be voided any more.
      await expect(c.getAllByRole("button", { name: "Void…" })).toHaveLength(1);
    });

    await step("Void the other one, with a reason", async () => {
      await userEvent.click(c.getByRole("button", { name: "Void…" }));
      const d = within(await screen.findByRole("dialog", { name: "Void INV-2043?" }));
      await userEvent.click(d.getByRole("button", { name: "Void invoice" }));
      await expect(await d.findByRole("alert")).toHaveTextContent("Say why, in a few words. It's logged.");
      await userEvent.type(d.getByLabelText("Why"), "Wrong package: they're filing separately.");
      await userEvent.click(d.getByRole("button", { name: "Void invoice" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expect(c.queryByRole("button", { name: "Void…" })).toBeNull();
    });
  },
};
