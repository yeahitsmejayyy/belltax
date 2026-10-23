import { Stage } from "@app/schema";
import { FilePlus2, ReceiptText, Users } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { ReturnHeader } from "../components/return-header";
import { StageMoveDialog, type StageMoveDraft } from "../components/stage-move-dialog";
import { RETURN_COMPLETE, RETURN_PREPARING, RETURN_READY, type ReturnFixture } from "./admin-return.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-header.stories?raw";

// The top of a return (admin 12-return-overview), the same header apps/admin/src/pages/return/return-header.tsx
// renders: who, which year, the stage and how long it's been there, the one primary action and the ⋯ menu. Moves ask
// first (StageMoveDialog; the admin's useStageMove sends them). Invented data.
const meta: Meta<typeof ReturnHeader> = {
  title: "Admin/Return/ReturnHeader",
  component: ReturnHeader,
  parameters: { usage: 'import { ReturnHeader, type ReturnHeaderAction } from "@app/ui/components/return-header";' },
};
export default meta;
type Story = StoryObj<typeof ReturnHeader>;

const moved = fn();
const requested = fn();
const invoiced = fn();
const opened = fn();

function HeaderScreen({ ret }: { ret: ReturnFixture }) {
  const [move, setMove] = useState<StageMoveDraft | null>(null);
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState<Stage>(ret.stage);
  const at = Stage.options.indexOf(stage);
  return (
    <ReturnHeader
      name={ret.name}
      subtitle={ret.subtitle}
      stage={stage}
      daysInStage={stage === ret.stage ? ret.daysInStage : 0}
      nextStage={stage === ret.stage ? ret.nextStage : (Stage.options[at + 1] ?? null)}
      previousStage={stage === ret.stage ? ret.previousStage : (Stage.options[at - 1] ?? null)}
      onMove={(to) => (setReason(""), setMove({ name: ret.name, from: stage, to }))}
      actions={[
        { id: "request", label: "Request a document…", icon: FilePlus2, onSelect: requested },
        { id: "invoice", label: "Create invoice…", icon: ReceiptText, onSelect: invoiced },
        { id: "household", label: "Open household", icon: Users, onSelect: opened },
      ]}
      dialog={
        <StageMoveDialog
          move={move}
          reason={reason}
          onReasonChange={setReason}
          onCancel={() => setMove(null)}
          onConfirm={() => {
            moved(move?.to, reason);
            if (move) setStage(move.to);
            setMove(null);
          }}
        />
      }
    />
  );
}

const source = { docs: { source: { code: fnSource(raw, "HeaderScreen") } } };

export const Preparing: Story = { render: () => <HeaderScreen ret={RETURN_PREPARING} />, parameters: source };
export const Stale: Story = { name: "In stage over a week", render: () => <HeaderScreen ret={RETURN_READY} />, parameters: source };
export const Complete: Story = { name: "Complete (no next stage)", render: () => <HeaderScreen ret={RETURN_COMPLETE} />, parameters: source };

export const PreparingTest: Story = {
  ...Preparing,
  name: "Preparing · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    moved.mockClear();
    await expect(c.getByRole("heading", { level: 1 })).toHaveTextContent("Dana & Sam Marigold");
    await expect(c.getByText("TY 2026 · Married filing jointly · Marigold household")).toBeInTheDocument();
    await expect(c.getByText("3 days in stage")).toBeInTheDocument();
    await step("the menu's actions go out through their callbacks", async () => {
      await userEvent.click(await c.findByRole("button", { name: "More actions" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: "Request a document…" }));
      await expect(requested).toHaveBeenCalled();
      await userEvent.click(await c.findByRole("button", { name: "More actions" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: "Open household" }));
      await expect(opened).toHaveBeenCalled();
    });
    await step("moving back asks why first", async () => {
      await userEvent.click(await c.findByRole("button", { name: "More actions" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: "Move back to Ready to prep…" }));
      await screen.findByRole("dialog", { name: "Move back to Ready to prep?" });
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
    await step("advancing confirms and moves the stage", async () => {
      await userEvent.click(await c.findByRole("button", { name: "Advance to Client review" }));
      const dialog = await screen.findByRole("dialog", { name: "Advance to Client review?" });
      await userEvent.click(within(dialog).getByRole("button", { name: "Advance to Client review" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expect(moved).toHaveBeenCalledWith("review", "");
      await expect(c.getByText("Client review")).toBeInTheDocument();
      await expect(c.getByRole("button", { name: "Advance to Filed" })).toBeInTheDocument();
    });
  },
};

export const CompleteTest: Story = {
  ...Complete,
  name: "Complete · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByRole("button", { name: /Advance to/ })).toBeNull();
    await expect(c.getByText("9 days in stage")).toBeInTheDocument();
  },
};
