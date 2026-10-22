import { ChevronRight, FilePlus2, FileText, FolderOpen, Upload } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { EmptyState } from "@app/ui/components/empty-state";
import { DocumentChip } from "@app/ui/components/status-chip";
import { formatDateTime } from "@app/ui/format";

import { DocumentReview, useDocumentReview } from "./document-review";
import { whoFor, type Detail } from "./shared";

// Documents (admin 14-return-detail-return-documents): every upload and every request still waiting on one.
// Uploads open in the viewer (15) at ?doc=<id>, so a review can be linked to.

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

  const waiting = d.requests.filter((r) => r.kind === "document" && r.status === "open" && !r.latestDocument);
  const accepted = d.documents.filter((x) => x.status === "accepted").length;
  const toReview = d.documents.filter((x) => x.status === "uploaded").length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {accepted} of {d.documents.length} accepted · {toReview} need review · {waiting.length} outstanding
        </p>
        <Button variant="outline" className="max-md:h-11" onClick={onRequest}>
          <FilePlus2 /> Request a document
        </Button>
      </div>

      {d.documents.length || waiting.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {d.documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
              <span aria-hidden="true" className="hidden size-12 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground sm:flex">
                <FileText className="size-5" />
              </span>
              <button type="button" onClick={() => show(doc.id)} className="grid min-w-0 flex-1 gap-1 rounded-md text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{doc.kindLabel}</span>
                  <DocumentChip status={doc.status} />
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {doc.deletedAt
                    ? `${whoFor(d, doc.personId)} · Verified ${formatDateTime(doc.deletedAt)} · image deleted`
                    : `${whoFor(d, doc.personId)} · Uploaded ${formatDateTime(doc.uploadedAt)} · ${doc.filename}`}
                </span>
                {doc.status === "rejected" && doc.rejectReason ? (
                  <span className="text-sm text-warning-foreground">Reason shown to the client: “{doc.rejectReason}”</span>
                ) : null}
              </button>
              {doc.status === "uploaded" ? (
                <div className="flex shrink-0 gap-1 max-sm:hidden">
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => accept(doc)}>
                    Accept
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => startReject(doc)}>
                    Reject
                  </Button>
                </div>
              ) : null}
              <Button variant="ghost" size="icon" className="shrink-0 max-md:size-11" aria-label={`Open ${doc.kindLabel}, ${doc.filename}`} onClick={() => show(doc.id)}>
                <ChevronRight />
              </Button>
            </li>
          ))}
          {waiting.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
              <span aria-hidden="true" className="hidden size-12 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground sm:flex">
                <Upload className="size-5" />
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{r.title}</span>
                  <DocumentChip status="needed" />
                </span>
                <span className="text-sm text-muted-foreground">
                  {whoFor(d, r.personId)} · Requested {formatDateTime(r.createdAt)}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FolderOpen} title="No documents yet" description="Nothing has been uploaded or requested for this return." />
      )}
      {dialog}
    </div>
  );
}
