import { useSearchParams } from "react-router-dom";

import { ReturnDocuments } from "@app/ui/components/return-documents";

import { DocumentReview, toReturnDocument, useDocumentReview } from "./document-review";
import { whoFor, type Detail } from "./shared";

// Documents (admin 14-return-detail-return-documents): every upload and every request still waiting on one, from
// packages/ui (return-documents). Uploads open in the viewer (15) at ?doc=<id>, so a review can be linked to.

export function DocumentsTab({ d, onRequest }: { d: Detail; onRequest: () => void }) {
  const [params, setParams] = useSearchParams();
  const { accept, startReject, dialog, pending } = useDocumentReview();
  const open = params.get("doc");
  const selected = open ? d.documents.find((x) => x.id === open) : undefined;
  const show = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set("doc", id);
        else p.delete("doc");
        return p;
      },
      { replace: false },
    );

  if (selected) return <DocumentReview d={d} doc={selected} onBack={() => show(null)} />;

  const waiting = d.requests
    .filter((r) => r.kind === "document" && r.status === "open" && !r.latestDocument)
    .map((r) => ({ id: r.id, title: r.title, who: whoFor(d, r.personId), createdAt: r.createdAt, note: r.note }));

  return (
    <ReturnDocuments documents={d.documents.map((doc) => toReturnDocument(d, doc))} waiting={waiting} pending={pending} onOpen={show} onAccept={accept} onReject={startReject} onRequest={onRequest}>
      {dialog}
    </ReturnDocuments>
  );
}
