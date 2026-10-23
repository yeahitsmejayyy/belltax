import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { RejectDocumentDialog, ReturnDocuments, type ReturnDocument } from "../components/return-documents";
import { DOCUMENTS, WAITING } from "./admin-return-documents.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-documents.stories?raw";

// A return's Documents tab in the preparer admin (admin 14-return-detail-return-documents), the same component
// apps/admin/src/pages/return/documents-tab.tsx renders: every upload (Accept / Reject inline) and every request still
// waiting on one. A verified photo ID shows its note, the image is gone. The review is simulated here; the app runs
// document.review and opens the viewer at ?doc=. Invented data.
const meta: Meta<typeof ReturnDocuments> = {
  title: "Admin/Return/ReturnDocuments",
  component: ReturnDocuments,
  parameters: { usage: 'import { ReturnDocuments, RejectDocumentDialog } from "@app/ui/components/return-documents";' },
};
export default meta;
type Story = StoryObj<typeof ReturnDocuments>;

const opened = fn();
const requested = fn();

function DocumentsScreen({ documents: start, waiting }: { documents: ReturnDocument[]; waiting: typeof WAITING }) {
  const [documents, setDocuments] = useState(start);
  const [rejecting, setRejecting] = useState<ReturnDocument | null>(null);
  const [reason, setReason] = useState("");
  const decide = (id: string, change: Partial<ReturnDocument>) => setDocuments((all) => all.map((d) => (d.id === id ? { ...d, ...change } : d)));
  return (
    <ReturnDocuments
      documents={documents}
      waiting={waiting}
      onOpen={opened}
      onRequest={requested}
      onAccept={(doc) => decide(doc.id, doc.identity ? { status: "accepted", deletedAt: new Date().toISOString() } : { status: "accepted" })}
      onReject={(doc) => (setRejecting(doc), setReason(""))}
    >
      <RejectDocumentDialog
        doc={rejecting}
        reason={reason}
        onReasonChange={setReason}
        onCancel={() => setRejecting(null)}
        onConfirm={(why) => {
          decide(rejecting!.id, { status: "rejected", rejectReason: why });
          setRejecting(null);
        }}
      />
    </ReturnDocuments>
  );
}

const source = { docs: { source: { code: fnSource(raw, "DocumentsScreen") } } };

export const Documents: Story = { render: () => <DocumentsScreen documents={DOCUMENTS} waiting={WAITING} />, parameters: source };
export const Empty: Story = { name: "Nothing yet", render: () => <DocumentsScreen documents={[]} waiting={[]} />, parameters: source };
export const OnlyWaiting: Story = { name: "Only requests waiting", render: () => <DocumentsScreen documents={[]} waiting={WAITING} />, parameters: source };

export const DocumentsTest: Story = {
  ...Documents,
  name: "Accept and reject · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByText("2 of 5 accepted · 2 need review · 2 outstanding")).toBeInTheDocument();
    await expect(c.getByText(/Dana · Verified .* · image deleted/)).toBeInTheDocument();
    await step("opening a row and asking for a document go out through the callbacks", async () => {
      await userEvent.click(c.getByRole("button", { name: "Open W-2, w2-harbor-freight.jpg" }));
      await expect(opened).toHaveBeenCalledWith("doc-w2");
      await userEvent.click(c.getByRole("button", { name: "Request a document" }));
      await expect(requested).toHaveBeenCalled();
    });
    await step("accepting the photo ID verifies it and the image is gone", async () => {
      await userEvent.click(c.getAllByRole("button", { name: "Accept" })[1]!);
      await expect(c.getByText(/Sam · Verified .* · image deleted/)).toBeInTheDocument();
      await expect(c.getByText("3 of 5 accepted · 1 need review · 2 outstanding")).toBeInTheDocument();
    });
    await step("a rejection needs a reason, and the client sees it", async () => {
      await userEvent.click(c.getByRole("button", { name: "Reject" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Reject W-2?" }));
      await userEvent.click(dialog.getByRole("button", { name: "Reject and tell the client" }));
      await expect(await dialog.findByText("Tell the client what's wrong, so they know what to send instead.")).toBeInTheDocument();
      await userEvent.type(dialog.getByLabelText("Reason shown to the client"), "  The box 1 wages are blurry. ");
      await userEvent.click(dialog.getByRole("button", { name: "Reject and tell the client" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expect(c.getByText("Reason shown to the client: “The box 1 wages are blurry.”")).toBeInTheDocument();
    });
  },
};
