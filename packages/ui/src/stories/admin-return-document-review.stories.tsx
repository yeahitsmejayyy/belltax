import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { RejectDocumentDialog, ReturnDocumentReview, type ReturnDocument } from "../components/return-documents";
import { DAYCARE, HEIC, INTEREST, PHOTO_ID, SAMPLE_IMAGE_SRC, SAMPLE_PDF_SRC, VERIFIED_ID, W2 } from "./admin-return-documents.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-document-review.stories?raw";

// Reviewing one upload (admin 15-return-detail-return-viewer), the same component
// apps/admin/src/pages/return/document-review.tsx renders: what it is and who it's from, the file, and Accept / Reject.
// Accepting a photo ID verifies it and deletes the image (ticket 49). The file is a data: URI here; the app passes
// /api/documents/:id/file. Invented data.
const meta: Meta<typeof ReturnDocumentReview> = {
  title: "Admin/Return/ReturnDocumentReview",
  component: ReturnDocumentReview,
  parameters: { fill: true, usage: 'import { ReturnDocumentReview, DocumentFile, RejectDocumentDialog } from "@app/ui/components/return-documents";' },
};
export default meta;
type Story = StoryObj<typeof ReturnDocumentReview>;

const back = fn();

function ReviewScreen({ doc: start, src }: { doc: ReturnDocument; src: string }) {
  const [doc, setDoc] = useState(start);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <ReturnDocumentReview
      doc={doc}
      src={src}
      onBack={back}
      onAccept={() => setDoc((d) => ({ ...d, status: "accepted", deletedAt: d.identity ? new Date().toISOString() : null }))}
      onReject={() => (setRejecting(true), setReason(""))}
    >
      <RejectDocumentDialog
        doc={rejecting ? doc : null}
        reason={reason}
        onReasonChange={setReason}
        onCancel={() => setRejecting(false)}
        onConfirm={(why) => {
          setDoc((d) => ({ ...d, status: "rejected", rejectReason: why }));
          setRejecting(false);
        }}
      />
    </ReturnDocumentReview>
  );
}

const source = { docs: { source: { code: fnSource(raw, "ReviewScreen") } } };

export const Image: Story = { name: "An image", render: () => <ReviewScreen doc={W2} src={SAMPLE_IMAGE_SRC} />, parameters: source };
export const Pdf: Story = { name: "A PDF, accepted", render: () => <ReviewScreen doc={INTEREST} src={SAMPLE_PDF_SRC} />, parameters: source };
export const PhotoId: Story = { name: "A photo ID", render: () => <ReviewScreen doc={PHOTO_ID} src={SAMPLE_IMAGE_SRC} />, parameters: source };
export const VerifiedId: Story = { name: "A verified photo ID", render: () => <ReviewScreen doc={VERIFIED_ID} src={SAMPLE_IMAGE_SRC} />, parameters: source };
export const Rejected: Story = { render: () => <ReviewScreen doc={DAYCARE} src={SAMPLE_PDF_SRC} />, parameters: source };
export const Unviewable: Story = { name: "A file the browser can't show", render: () => <ReviewScreen doc={HEIC} src={SAMPLE_IMAGE_SRC} />, parameters: source };

export const PhotoIdTest: Story = {
  ...PhotoId,
  name: "Accepting a photo ID · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Accepting verifies this ID and deletes the image")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Back to documents" }));
    await expect(back).toHaveBeenCalled();
    await userEvent.click(c.getByRole("button", { name: "Accept" }));
    await expect(c.queryByText("Accepting verifies this ID and deletes the image")).toBeNull();
    await expect(c.getByText(/The image was deleted then; this note is all the portal keeps\./)).toBeInTheDocument();
    await expect(c.queryByRole("img", { name: /sam-drivers-license/ })).toBeNull();
  },
};
export const ImageTest: Story = {
  ...Image,
  name: "Rejecting needs a reason · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Answers the request")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Reject with reason" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Reject W-2?" }));
    await userEvent.type(dialog.getByLabelText("Reason shown to the client"), "no");
    await userEvent.click(dialog.getByRole("button", { name: "Reject and tell the client" }));
    await expect(await dialog.findByText("Tell the client what's wrong, so they know what to send instead.")).toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText("Reason shown to the client"), "t the whole page");
    await userEvent.click(dialog.getByRole("button", { name: "Reject and tell the client" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(c.getByText("“not the whole page”")).toBeInTheDocument();
    await expect(c.queryByRole("button", { name: "Accept" })).toBeNull();
  },
};
