import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { SentFile } from "../components/client-documents";
import { REVIEWED, SENT } from "./portal-documents.fixtures";

// A file the client already sent: its name and when. While nobody has looked at it, it can be taken back (with a
// confirm); the app does the removing through `onRemove`. It never opens again from the portal (ticket 52). Invented data.
const meta: Meta<typeof SentFile> = {
  title: "Portal/Documents/SentFile",
  component: SentFile,
  parameters: { usage: 'import { SentFile } from "@app/ui/components/client-documents";' },
  args: { filename: SENT[0]!.filename, sentAt: SENT[0]!.sentAt, removable: true, pending: false, onRemove: fn() },
  decorators: [(Story) => <div className="w-[26rem] max-w-full"><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof SentFile>;

export const Removable: Story = {};
export const Removing: Story = { args: { pending: true } };
export const Reviewed: Story = { name: "Reviewed (can't be removed)", args: { filename: REVIEWED.filename, sentAt: REVIEWED.sentAt, removable: false } };

export const RemovableTest: Story = {
  ...Removable,
  name: "Removable · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args, step }) => {
    const c = within(canvasElement);
    await expect(c.getByText(SENT[0]!.filename)).toBeInTheDocument();
    await expect(c.getByText(/· sent Feb 3, 2026/)).toBeInTheDocument();

    await step("Keep it closes the confirm and removes nothing", async () => {
      await userEvent.click(c.getByRole("button", { name: "Remove" }));
      const dialog = await screen.findByRole("alertdialog");
      await expect(within(dialog).getByText(`Remove ${SENT[0]!.filename}?`)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole("button", { name: "Keep it" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      await expect(args.onRemove).not.toHaveBeenCalled();
    });

    await step("Remove in the confirm asks the app to remove it", async () => {
      await userEvent.click(c.getByRole("button", { name: "Remove" }));
      const dialog = await screen.findByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
      await expect(args.onRemove).toHaveBeenCalledTimes(1);
    });
  },
};

export const ReviewedTest: Story = {
  ...Reviewed,
  name: "Reviewed · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "Remove" })).toBeNull();
  },
};
