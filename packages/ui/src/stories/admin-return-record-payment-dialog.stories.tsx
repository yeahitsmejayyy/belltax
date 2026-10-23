import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { RecordPaymentDialog } from "../components/return-billing";
import { BILLING_TODAY, PARTIAL_INVOICE } from "./admin-return-billing.fixtures";

// Record a payment by hand (admin 17-return-detail-return-billing, Record payment…): money that came in outside the
// portal. The amount starts at the balance and can't exceed it; the received date can't be in the future. Invented data.
const meta: Meta<typeof RecordPaymentDialog> = {
  title: "Admin/Return/RecordPaymentDialog",
  component: RecordPaymentDialog,
  args: { invoice: PARTIAL_INVOICE, today: BILLING_TODAY, onRecord: fn(), onClose: fn() },
};
meta.parameters = { ...meta.parameters, usage: 'import { RecordPaymentDialog } from "@app/ui/components/return-billing";' };
export default meta;
type Story = StoryObj<typeof RecordPaymentDialog>;

export const Default: Story = { name: "Record a payment" };
export const Busy: Story = { name: "Recording", args: { busy: true } };
export const Failed: Story = { name: "It wasn't recorded", args: { error: "That invoice is already paid in full." } };
export const OwnMethods: Story = {
  name: "Other payment methods",
  args: { methods: [{ value: "check", label: "Check" }, { value: "venmo", label: "Venmo" }, { value: "money_order", label: "Money order" }], defaultMethod: "venmo" },
};

const recorded = fn();
export const RecordPaymentDialogTest: Story = {
  name: "Record a payment · test",
  tags: ["!dev", "!autodocs"],
  args: { onRecord: recorded },
  play: async () => {
    recorded.mockClear();
    const d = within(await screen.findByRole("dialog", { name: "Record a payment on INV-2041" }));
    await expect(d.getByText("$275.00 still owed. For money that came in outside the portal.")).toBeInTheDocument();
    const amount = d.getByLabelText("Amount");
    await userEvent.clear(amount);
    await userEvent.click(d.getByRole("button", { name: "Record payment" }));
    await expect(await d.findByText("Enter the amount received, like 340.00.")).toBeInTheDocument();
    await expect(recorded).not.toHaveBeenCalled();
    await userEvent.type(amount, "$100.50");
    await userEvent.click(d.getByRole("combobox", { name: "Method" }));
    await userEvent.click(await screen.findByRole("option", { name: "Zelle" }));
    // A picked option leaves the page inert for a frame while the list closes.
    await waitFor(() => expect(getComputedStyle(d.getByLabelText("Note")).pointerEvents).not.toBe("none"));
    await userEvent.type(d.getByLabelText("Note"), "  Sent from Sam's account. ");
    await userEvent.click(d.getByRole("button", { name: "Record payment" }));
    await expect(recorded).toHaveBeenCalledWith({ amountCents: 10050, method: "zelle", receivedOn: BILLING_TODAY, note: "Sent from Sam's account." });
  },
};
