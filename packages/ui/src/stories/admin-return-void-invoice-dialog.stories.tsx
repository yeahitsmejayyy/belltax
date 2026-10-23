import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { VoidInvoiceDialog } from "../components/return-billing";
import { DRAFT_INVOICE } from "./admin-return-billing.fixtures";

// Void an invoice (admin 17-return-detail-return-billing, Void…): the client stops seeing it, it stays in the record
// as void, and the reason is logged. Invented data.
const meta: Meta<typeof VoidInvoiceDialog> = {
  title: "Admin/Return/VoidInvoiceDialog",
  component: VoidInvoiceDialog,
  args: { invoice: DRAFT_INVOICE, onVoid: fn(), onClose: fn() },
};
meta.parameters = { ...meta.parameters, usage: 'import { VoidInvoiceDialog } from "@app/ui/components/return-billing";' };
export default meta;
type Story = StoryObj<typeof VoidInvoiceDialog>;

export const Default: Story = { name: "Void an invoice" };
export const Busy: Story = { name: "Voiding", args: { busy: true } };
export const Failed: Story = { name: "It wasn't voided", args: { error: "A paid invoice can't be voided." } };

const voided = fn();
export const VoidInvoiceDialogTest: Story = {
  name: "Void with a reason · test",
  tags: ["!dev", "!autodocs"],
  args: { onVoid: voided },
  play: async () => {
    voided.mockClear();
    const d = within(await screen.findByRole("dialog", { name: "Void INV-2043?" }));
    await userEvent.type(d.getByLabelText("Why"), "no");
    await userEvent.click(d.getByRole("button", { name: "Void invoice" }));
    await expect(d.getByRole("alert")).toHaveTextContent("Say why, in a few words. It's logged.");
    await expect(voided).not.toHaveBeenCalled();
    await userEvent.type(d.getByLabelText("Why"), "t needed: duplicate. ");
    await expect(d.queryByRole("alert")).toBeNull();
    await userEvent.click(d.getByRole("button", { name: "Void invoice" }));
    await expect(voided).toHaveBeenCalledWith("not needed: duplicate.");
  },
};
