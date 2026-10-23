import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { ExportHouseholdDialog } from "../components/export-household-dialog";
import { EXPORT_RESULT } from "./admin-clients.fixtures";

// Export a household (ticket 33), the dialog the admin's household page opens. `onExport` is simulated here; the app
// runs household.export, which writes to the practice's export folder and reports only the path. Invented data.
const meta: Meta<typeof ExportHouseholdDialog> = {
  title: "Admin/Clients/ExportHouseholdDialog",
  component: ExportHouseholdDialog,
  args: { name: "Marigold household" },
};
meta.parameters = { ...meta.parameters, usage: 'import { ExportHouseholdDialog } from "@app/ui/components/export-household-dialog";' };
export default meta;
type Story = StoryObj<typeof ExportHouseholdDialog>;

const exported = fn();
const slow = <T,>(value: () => T, ms = 400) => new Promise<T>((resolve, reject) => setTimeout(() => { try { resolve(value()); } catch (e) { reject(e); } }, ms));

export const Default: Story = {
  args: {
    onExport: (o) => {
      exported(o);
      return slow(() => ({ ...EXPORT_RESULT, encrypted: o.encrypt }));
    },
  },
};

export const Fails: Story = {
  name: "Export fails",
  args: {
    onExport: () =>
      slow(() => {
        throw new Error("The export folder isn't set. Add EXPORT_DIR to the server's environment.");
      }),
  },
};

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Export" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Export Marigold household" }));
    await step("unticking encryption and exporting shows where it went", async () => {
      await userEvent.click(dialog.getByRole("checkbox", { name: "Encrypt with the backup passphrase" }));
      await userEvent.click(dialog.getByRole("button", { name: "Export" }));
      await expect(dialog.getByRole("button", { name: "Exporting…" })).toBeDisabled();
      await expect(await dialog.findByText("Export written")).toBeInTheDocument();
      await expect(exported).toHaveBeenCalledWith({ encrypt: false });
      await expect(dialog.getByText(EXPORT_RESULT.path)).toBeInTheDocument();
      await expect(dialog.getByText("3.3 MB")).toBeInTheDocument();
      await expect(dialog.getByText("No")).toBeInTheDocument();
    });
    await step("Done closes it", async () => {
      await userEvent.click(dialog.getByRole("button", { name: "Done" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  },
};

export const FailsTest: Story = {
  ...Fails,
  name: "Export fails · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Export" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Export" }));
    await expect(await dialog.findByText("The export didn't finish")).toBeInTheDocument();
    await expect(dialog.getByText(/EXPORT_DIR/)).toBeInTheDocument();
    await expect(dialog.getByRole("button", { name: "Export" })).toBeEnabled();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};
