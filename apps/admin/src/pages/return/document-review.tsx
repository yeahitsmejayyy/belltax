import * as React from "react";
import { toast } from "sonner";

import { RejectDocumentDialog, ReturnDocumentReview, type ReturnDocument } from "@app/ui/components/return-documents";

import { at } from "@/lib/base";
import { trpc } from "@/lib/trpc";

import { errorText, whoFor, type Detail, type Doc } from "./shared";

// Reviewing one upload: the viewer and the reject dialog come from packages/ui (return-documents); this keeps the
// review mutation, its toasts and the mapping from the return's detail.

/** A document as the design system shows it: who it's from, and the request it answers. */
export const toReturnDocument = (d: Detail, doc: Doc): ReturnDocument => ({
  ...doc,
  who: whoFor(d, doc.personId),
  request: doc.requestId ? (d.requests.find((r) => r.id === doc.requestId)?.title ?? null) : null,
});

export function useDocumentReview() {
  const utils = trpc.useUtils();
  const review = trpc.document.review.useMutation();
  const [rejecting, setRejecting] = React.useState<Pick<Doc, "id" | "kindLabel" | "filename"> | null>(null);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const accept = async (doc: Pick<Doc, "id" | "kindLabel">) => {
    try {
      const done = await review.mutateAsync({ documentId: doc.id, decision: "accept" });
      await utils.invalidate();
      if (done.deletedAt) toast.success(`${doc.kindLabel} verified`, { description: "The image is deleted. A note stays: verified, when, and what kind." });
      else toast.success(`${doc.kindLabel} accepted`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const startReject = (doc: Pick<Doc, "id" | "kindLabel" | "filename">) => {
    setRejecting(doc);
    setReason("");
    setError(null);
  };
  const reject = async (trimmed: string) => {
    if (!rejecting) return;
    setError(null);
    try {
      await review.mutateAsync({ documentId: rejecting.id, decision: "reject", reason: trimmed });
      await utils.invalidate();
      toast.success(`${rejecting.kindLabel} rejected. The client has been asked for a new copy.`);
      setRejecting(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const dialog = (
    <RejectDocumentDialog doc={rejecting} reason={reason} onReasonChange={setReason} error={error} pending={review.isPending} onCancel={() => setRejecting(null)} onConfirm={reject} />
  );

  return { accept, startReject, dialog, pending: review.isPending };
}

export function DocumentReview({ d, doc, onBack }: { d: Detail; doc: Doc; onBack: () => void }) {
  const { accept, startReject, dialog } = useDocumentReview();
  return (
    <ReturnDocumentReview doc={toReturnDocument(d, doc)} src={at(`/api/documents/${doc.id}/file`)} onBack={onBack} onAccept={() => accept(doc)} onReject={() => startReject(doc)}>
      {dialog}
    </ReturnDocumentReview>
  );
}
