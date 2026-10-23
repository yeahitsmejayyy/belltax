import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { PriceDialog } from "../components/pricing-settings";
import { ADDONS, PACKAGES } from "./admin-settings.fixtures";

// Add or edit a package or an add-on (admin 32-settings-settings-pricing, the pencil). Remove asks once more: the
// admin deletes a price nobody has used and retires one that's on past invoices. Invented data.
const meta: Meta<typeof PriceDialog> = {
  title: "Admin/Settings/PriceDialog",
  component: PriceDialog,
  args: { onSave: fn(), onRemove: fn(), onClose: fn() },
};
meta.parameters = { ...meta.parameters, usage: 'import { PriceDialog } from "@app/ui/components/pricing-settings";' };
export default meta;
type Story = StoryObj<typeof PriceDialog>;

export const EditPackage: Story = { name: "Edit a package", args: { editing: { kind: "package", item: PACKAGES[1]! } } };
export const NewAddon: Story = { name: "Add an add-on", args: { editing: { kind: "addon", item: null } } };
export const IncludedAddon: Story = { name: "An included add-on", args: { editing: { kind: "addon", item: ADDONS[2]! } } };
export const SaveFailed: Story = { name: "Save failed", args: { editing: { kind: "package", item: PACKAGES[0]! }, error: "A package for that filing status already exists." } };

const removed = fn();
const added = fn();
export const PriceDialogTest: Story = {
  name: "Add and remove · test",
  tags: ["!dev", "!autodocs"],
  args: { editing: { kind: "addon", item: ADDONS[1]! }, onRemove: removed },
  play: async () => {
    removed.mockClear();
    const d = within(await screen.findByRole("dialog", { name: "Edit Rental property" }));
    // Remove asks first, saying what will happen.
    await userEvent.click(d.getByRole("button", { name: "Remove" }));
    await expect(d.getByText("Remove Rental property?")).toBeInTheDocument();
    await expect(removed).not.toHaveBeenCalled();
    await userEvent.click(d.getByRole("button", { name: "Yes, remove" }));
    await expect(removed).toHaveBeenCalledWith(ADDONS[1]);
  },
};
export const NewAddonTest: Story = {
  name: "New included add-on · test",
  tags: ["!dev", "!autodocs"],
  args: { editing: { kind: "addon", item: null }, onSave: added },
  play: async () => {
    added.mockClear();
    const d = within(await screen.findByRole("dialog", { name: "Add an add-on" }));
    await userEvent.click(d.getByRole("button", { name: "Add add-on" }));
    await expect(await d.findByText("Give the add-on a name.")).toBeInTheDocument();
    await userEvent.type(d.getByLabelText("Name"), "  Dependent care credit ");
    // Included: no price to enter, and none is sent.
    await userEvent.click(d.getByLabelText("Included, no charge"));
    await expect(d.queryByLabelText("Price")).not.toBeInTheDocument();
    await userEvent.click(d.getByRole("button", { name: "Add add-on" }));
    await expect(added).toHaveBeenCalledWith({ kind: "addon", code: undefined, name: "Dependent care credit", description: "", unitAmountCents: null, appliesWhen: null, active: true });
  },
};
