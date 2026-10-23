import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { ReturnLetter, ReturnLetterEmpty, ReturnLetterLoading, VoidLetterDialog, type ReturnLetterData } from "../components/return-letter";
import { DRAFT_LETTER, MISMATCHED_LETTER, SENT_LETTER, SIGNED_LETTER, VOID_LETTER } from "./admin-return-documents.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-letter.stories?raw";

// A return's engagement letter (admin 16-return-detail-return-letter), the same components
// apps/admin/src/pages/return/letter-tab.tsx renders: draft from the template, send for signature, void with a reason,
// and the signature record (typed name, time, IP, and whether the signed text still matches). The "server" is local
// state here; the app runs letter.create, letter.send and letter.void. Invented data, documentation IPs.
const meta: Meta<typeof ReturnLetter> = {
  title: "Admin/Return/ReturnLetter",
  component: ReturnLetter,
  parameters: { usage: 'import { ReturnLetter, ReturnLetterEmpty, ReturnLetterLoading, VoidLetterDialog } from "@app/ui/components/return-letter";' },
};
export default meta;
type Story = StoryObj<typeof ReturnLetter>;

const voided = fn();

function LetterScreen({ letter: start }: { letter: ReturnLetterData | null }) {
  const [letter, setLetter] = useState(start);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  if (!letter) return <ReturnLetterEmpty onDraft={() => setLetter(DRAFT_LETTER)} />;
  return (
    <ReturnLetter letter={letter} onSend={() => setLetter((l) => l && { ...l, status: "sent", sentAt: new Date().toISOString(), audit: [] })} onVoid={() => setVoiding(true)}>
      <VoidLetterDialog
        open={voiding}
        onOpenChange={setVoiding}
        reason={reason}
        onReasonChange={setReason}
        onConfirm={(why) => {
          voided(why);
          setLetter((l) => l && { ...l, status: "void" });
          setVoiding(false);
          setReason("");
        }}
      />
    </ReturnLetter>
  );
}

const source = { docs: { source: { code: fnSource(raw, "LetterScreen") } } };

export const Draft: Story = { render: () => <LetterScreen letter={DRAFT_LETTER} />, parameters: source };
export const Sent: Story = { name: "Out for signature", render: () => <LetterScreen letter={SENT_LETTER} />, parameters: source };
export const Signed: Story = { render: () => <LetterScreen letter={SIGNED_LETTER} />, parameters: source };
export const TextChanged: Story = { name: "A signature over changed text", render: () => <LetterScreen letter={MISMATCHED_LETTER} />, parameters: source };
export const Void: Story = { render: () => <LetterScreen letter={VOID_LETTER} />, parameters: source };
export const NoLetter: Story = { name: "No letter yet", render: () => <LetterScreen letter={null} />, parameters: source };
export const DraftFailed: Story = { name: "Drafting failed", render: () => <ReturnLetterEmpty onDraft={fn()} error="There's no letter template yet. Write one in Settings." /> };
export const Loading: Story = { render: () => <ReturnLetterLoading /> };

export const NoLetterTest: Story = {
  ...NoLetter,
  name: "Draft, send and void · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    voided.mockClear();
    const c = within(canvasElement);
    await step("drafting shows who signs", async () => {
      await userEvent.click(c.getByRole("button", { name: "Draft the engagement letter" }));
      await expect(c.getByText("To be signed by Dana Marigold and Sam Marigold. Read it through, then send it.")).toBeInTheDocument();
    });
    await step("sending puts it out for signature and shows the record", async () => {
      await userEvent.click(c.getByRole("button", { name: "Send for signature" }));
      await expect(c.getByText("Out for signature")).toBeInTheDocument();
      await expect(c.getAllByText("Not signed yet")).toHaveLength(2);
      await expect(c.queryByRole("button", { name: "Send for signature" })).toBeNull();
    });
    await step("voiding needs a reason", async () => {
      await userEvent.click(c.getByRole("button", { name: "Void…" }));
      const d = within(await screen.findByRole("dialog", { name: "Void this letter?" }));
      await userEvent.click(d.getByRole("button", { name: "Void letter" }));
      await expect(await d.findByText("Say why, in a few words. It's logged.")).toBeInTheDocument();
      await expect(voided).not.toHaveBeenCalled();
      await userEvent.type(d.getByLabelText("Why"), "The fee changed after we added the rental.");
      await userEvent.click(d.getByRole("button", { name: "Void letter" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expect(voided).toHaveBeenCalledWith("The fee changed after we added the rental.");
      await expect(c.getByText("Void")).toBeInTheDocument();
      await expect(c.queryByRole("button", { name: "Void…" })).toBeNull();
    });
  },
};
export const TextChangedTest: Story = {
  ...TextChanged,
  name: "Changed text is flagged · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("A signature doesn't match the letter text")).toBeInTheDocument();
    await expect(c.getAllByText("Sam Marigold", { selector: "td" })).toHaveLength(2);
    await expect(c.getByText("198.51.100.7")).toBeInTheDocument();
    await expect(c.getByText("text changed")).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "Download signed PDF (coming)" })).toBeDisabled();
  },
};
