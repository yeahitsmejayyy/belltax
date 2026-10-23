import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { RejectDocumentDialog } from "../components/return-documents";
import { W2 } from "./admin-return-documents.fixtures";

// Rejecting an upload (admin 21-dialogs-and-sheets-dlg-reject). The reason is required: the client sees it and is asked
// to upload again. Controlled: the app holds the reason and the server's error and sends it in `onConfirm`.
const meta: Meta<typeof RejectDocumentDialog> = {
  title: "Admin/Return/RejectDocumentDialog",
  component: RejectDocumentDialog,
  args: { doc: W2, reason: "", onReasonChange: fn(), onCancel: fn(), onConfirm: fn() },
  parameters: { usage: 'import { RejectDocumentDialog } from "@app/ui/components/return-documents";' },
};
export default meta;
type Story = StoryObj<typeof RejectDocumentDialog>;

export const Open: Story = {};
export const WithReason: Story = { name: "With a reason", args: { reason: "Page 2 is cut off at the bottom." } };
export const Refused: Story = { name: "Refused by the server", args: { reason: "Page 2 is cut off at the bottom.", error: "That document was already reviewed." } };
export const Sending: Story = { args: { reason: "Page 2 is cut off at the bottom.", pending: true } };

const confirmed = fn();
export const OpenTest: Story = {
  name: "A reason is required · test",
  tags: ["!dev", "!autodocs"],
  args: { reason: "x", onConfirm: confirmed },
  play: async () => {
    confirmed.mockClear();
    const d = within(await screen.findByRole("dialog", { name: "Reject W-2?" }));
    await userEvent.click(d.getByRole("button", { name: "Reject and tell the client" }));
    await expect(await d.findByRole("alert")).toHaveTextContent("Tell the client what's wrong, so they know what to send instead.");
    await expect(confirmed).not.toHaveBeenCalled();
  },
};
export const WithReasonTest: Story = {
  ...WithReason,
  name: "A good reason is sent trimmed · test",
  tags: ["!dev", "!autodocs"],
  args: { reason: "  Page 2 is cut off at the bottom. ", onConfirm: confirmed },
  play: async () => {
    confirmed.mockClear();
    const d = within(await screen.findByRole("dialog", { name: "Reject W-2?" }));
    await userEvent.click(d.getByRole("button", { name: "Reject and tell the client" }));
    await expect(confirmed).toHaveBeenCalledWith("Page 2 is cut off at the bottom.");
  },
};
