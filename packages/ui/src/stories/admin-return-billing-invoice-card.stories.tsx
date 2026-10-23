import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { BillingInvoiceCard, PaymentAttemptsTable } from "../components/return-billing";
import { BILLING_PAYMENTS, DRAFT_INVOICE, FAILED_INVOICE, PAID_INVOICE, PARTIAL_INVOICE, VOID_INVOICE } from "./admin-return-billing.fixtures";

// One invoice on a return's Billing tab: lines (with how many), included add-ons by name, paid and balance once sent,
// and the actions its state allows. Money received means no Void. Invented data.
const meta: Meta<typeof BillingInvoiceCard> = {
  title: "Admin/Return/BillingInvoiceCard",
  component: BillingInvoiceCard,
  args: { invoice: PARTIAL_INVOICE, onSend: fn(), onPay: fn(), onVoid: fn() },
  decorators: [(Story) => <div className="w-[40rem] max-w-full">{Story()}</div>],
};
meta.parameters = { ...meta.parameters, usage: 'import { BillingInvoiceCard, PaymentAttemptsTable } from "@app/ui/components/return-billing";' };
export default meta;
type Story = StoryObj<typeof BillingInvoiceCard>;

export const PartlyPaid: Story = { name: "Partly paid" };
export const Paid: Story = { args: { invoice: PAID_INVOICE } };
export const Failed: Story = { name: "Latest attempt failed", args: { invoice: FAILED_INVOICE } };
export const Draft: Story = { args: { invoice: DRAFT_INVOICE } };
export const Void: Story = { args: { invoice: VOID_INVOICE } };
export const Attempts: Story = { name: "Payment attempts table", render: () => <PaymentAttemptsTable payments={BILLING_PAYMENTS} /> };
