import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import { Button } from "../components/button";
import { StageMoveDialog, type StageMoveDraft } from "../components/stage-move-dialog";
import { fnSource } from "./fixtures";
import raw from "./admin-stage-move-dialog.stories?raw";

// Moving a return between stages (admin 19-dialogs-and-sheets-dlg-advance, 20-dlg-back). Forward asks to confirm;
// backward always asks why (the reason is logged); a skip is refused in words. The admin's useStageMove holds the
// move and sends it; here the "server" is a promise. Invented households.
const meta: Meta<typeof StageMoveDialog> = {
  title: "Admin/Pipeline/StageMoveDialog",
  component: StageMoveDialog,
  parameters: { usage: 'import { StageMoveDialog, moveDirection, type StageMoveDraft } from "@app/ui/components/stage-move-dialog";' },
};
export default meta;
type Story = StoryObj<typeof StageMoveDialog>;

const moved = fn();

function MoveDialog({ initial, refuse }: { initial: StageMoveDraft; refuse?: string }) {
  const [move, setMove] = useState<StageMoveDraft | null>(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    await new Promise((r) => setTimeout(r, 300)); // the server
    setPending(false);
    if (refuse) return setError(refuse);
    moved(move, reason);
    setMove(null);
  };
  return (
    <>
      <Button variant="outline" onClick={() => (setMove(initial), setReason(""), setError(null))}>
        Move {initial.name}
      </Button>
      <StageMoveDialog move={move} reason={reason} onReasonChange={setReason} error={error} pending={pending} onCancel={() => setMove(null)} onConfirm={confirm} />
    </>
  );
}

const source = { docs: { source: { code: fnSource(raw, "MoveDialog") } } };
export const Forward: Story = { render: () => <MoveDialog initial={{ name: "Dana & Sam Marigold", from: "preparing", to: "review" }} />, parameters: source };
export const ToFiled: Story = { name: "Forward to Filed", render: () => <MoveDialog initial={{ name: "Sidney Kestrel", from: "review", to: "filed" }} />, parameters: source };
export const Backward: Story = { render: () => <MoveDialog initial={{ name: "Toni Wren", from: "preparing", to: "documents" }} />, parameters: source };
export const Skip: Story = { name: "Skipping a stage", render: () => <MoveDialog initial={{ name: "Remy Dovetail", from: "intake", to: "preparing" }} />, parameters: source };
export const Refused: Story = {
  name: "Refused by the server",
  render: () => <MoveDialog initial={{ name: "Toni Wren", from: "documents", to: "ready" }} refuse="3 requested documents are still missing." />,
  parameters: source,
};

export const BackwardTest: Story = {
  ...Backward,
  name: "Backward · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ step }) => {
    const dialog = await screen.findByRole("dialog", { name: "Move back to Documents?" });
    const send = () => screen.getByRole("button", { name: "Move back" });
    await step("a reason is required", async () => {
      await expect(send()).toBeDisabled();
      await userEvent.type(screen.getByLabelText("Why is it moving back?"), "A corrected 1099 is on its way.");
      await expect(send()).toBeEnabled();
    });
    await step("confirming sends the move with the reason and closes", async () => {
      await userEvent.click(send());
      await waitFor(() => expect(moved).toHaveBeenCalledWith({ name: "Toni Wren", from: "preparing", to: "documents" }, "A corrected 1099 is on its way."));
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
    });
  },
};
export const SkipTest: Story = {
  ...Skip,
  name: "Skipping a stage · test",
  tags: ["!dev", "!autodocs"],
  play: async () => {
    await screen.findByRole("dialog", { name: "Advance to Preparing?" });
    await expect(screen.getByText("Returns move one stage at a time")).toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "Advance to Preparing" })).toBeDisabled();
  },
};
export const RefusedTest: Story = {
  ...Refused,
  name: "Refused by the server · test",
  tags: ["!dev", "!autodocs"],
  play: async () => {
    await screen.findByRole("dialog", { name: "Advance to Ready to prep?" });
    await userEvent.click(screen.getByRole("button", { name: "Advance to Ready to prep" }));
    await expect(await screen.findByText("3 requested documents are still missing.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};
