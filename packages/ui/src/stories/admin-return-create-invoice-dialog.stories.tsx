import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { Button } from "../components/button";
import { CreateInvoiceDialog, type InvoiceDraft } from "../components/create-invoice-dialog";
import { formatCents } from "../format";
import { BILLING_CLIENT, EMPTY_SUGGESTION, INVOICE_ADDONS, INVOICE_PACKAGES, INVOICE_SUGGESTION } from "./admin-return-billing.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-create-invoice-dialog.stories?raw";

// Create invoice (admin 23-dialogs-and-sheets-dlg-invoice): the package and add-ons this return calls for, pre-ticked
// from the suggestion and priced from Settings. An add-on with no price is "Included": named on the invoice, never a
// $0 line (R26). Invented data.
const PRICING = { packages: INVOICE_PACKAGES, addons: INVOICE_ADDONS };
const meta: Meta<typeof CreateInvoiceDialog> = {
  title: "Admin/Return/CreateInvoiceDialog",
  component: CreateInvoiceDialog,
  args: { open: true, name: BILLING_CLIENT.name, pricing: PRICING, suggestion: INVOICE_SUGGESTION, onSubmit: fn(), onOpenChange: fn() },
};
meta.parameters = { ...meta.parameters, usage: 'import { CreateInvoiceDialog } from "@app/ui/components/create-invoice-dialog";' };
export default meta;
type Story = StoryObj<typeof CreateInvoiceDialog>;

function CreateInvoiceScreen() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<InvoiceDraft | null>(null);
  return (
    <div className="grid justify-items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Create invoice
      </Button>
      {sent ? (
        <p className="text-sm">
          Sent: {sent.lines.map((l) => `${l.description} × ${l.quantity}`).join(", ")} · {formatCents(sent.lines.reduce((s, l) => s + l.quantity * l.unitAmountCents, 0))}
          {sent.included.length ? ` · includes ${sent.included.join(", ")}` : ""}
        </p>
      ) : null}
      <CreateInvoiceDialog
        open={open}
        onOpenChange={setOpen}
        name={BILLING_CLIENT.name}
        pricing={PRICING}
        suggestion={INVOICE_SUGGESTION}
        onSubmit={(draft) => {
          setSent(draft);
          setOpen(false);
        }}
      />
    </div>
  );
}

export const Suggested: Story = { name: "Suggested from the return" };
export const NothingSuggested: Story = { name: "Nothing suggested", args: { suggestion: EMPTY_SUGGESTION } };
export const Loading: Story = { name: "Loading pricing", args: { pricing: null, suggestion: null } };
export const LoadFailed: Story = { name: "Pricing didn't load", args: { loadError: "The server didn't answer. Try again." } };
export const SendFailed: Story = { name: "Created but not sent", args: { error: "INV-2045 was created as a draft but not sent: the client has no email on file." } };
export const Busy: Story = { name: "Sending", args: { busy: true } };
export const Screen: Story = { render: () => <CreateInvoiceScreen />, parameters: { docs: { source: { code: fnSource(raw, "CreateInvoiceScreen") } } } };

const submitted = fn();
export const CreateInvoiceDialogTest: Story = {
  name: "Build and issue an invoice · test",
  tags: ["!dev", "!autodocs"],
  args: { onSubmit: submitted },
  play: async ({ step }) => {
    submitted.mockClear();
    const d = within(await screen.findByRole("dialog", { name: "Create invoice" }));
    const box = (name: string) => within(d.getByText(name).closest("label")!).getByRole("checkbox");
    // A picked option leaves the page inert for a frame while the list closes.
    const settled = () => waitFor(() => expect(getComputedStyle(d.getByRole("button", { name: "Create and send" })).pointerEvents).not.toBe("none"));
    // Pre-ticked from the suggestion: joint package, two rentals, IHSS included at no charge. Inactive ones are left out.
    await expect(box("Rental property")).toBeChecked();
    await expect(box("IHSS income")).toBeChecked();
    await expect(d.queryByText("Rush turnaround")).toBeNull();
    await expect(d.getByText("Included")).toBeInTheDocument();
    await expect(d.getByText("$575.00")).toBeInTheDocument();

    await step("Nothing to charge is refused", async () => {
      await userEvent.click(d.getByRole("combobox", { name: "Package" }));
      await userEvent.click(await screen.findByRole("option", { name: "No package (add-ons only)" }));
      await settled();
      await userEvent.click(box("Rental property"));
      await userEvent.click(d.getByRole("button", { name: "Create and send" }));
      await expect(d.getByText("Choose a package or a priced add-on: an invoice needs something to charge.")).toBeInTheDocument();
      await expect(submitted).not.toHaveBeenCalled();
    });

    await step("Head of household plus Schedule C, IHSS included", async () => {
      await userEvent.click(d.getByRole("combobox", { name: "Package" }));
      await userEvent.click(await screen.findByRole("option", { name: "Head of household · $275.00" }));
      await settled();
      await userEvent.click(box("Schedule C"));
      await waitFor(() => expect(d.getByText("$425.00")).toBeInTheDocument());
      await userEvent.click(d.getByRole("button", { name: "Create and send" }));
      await expect(d.queryByText("Choose a package", { exact: false })).toBeNull();
      await expect(submitted).toHaveBeenCalledWith({
        lines: [
          { description: "Head of household", quantity: 1, unitAmountCents: 27500, priceCode: "pkg-hoh" },
          { description: "Schedule C", quantity: 1, unitAmountCents: 15000, priceCode: "add-sched-c" },
        ],
        included: ["add-ihss"],
      });
    });
  },
};
