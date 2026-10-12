import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@app/ui/components/dialog";
import { DocumentViewer } from "@app/ui/components/document-viewer";
import { Label } from "@app/ui/components/label";
import { Textarea } from "@app/ui/components/textarea";
import { formatDateTime } from "@app/ui/format";

import { at } from "@/lib/base";
import { trpc } from "@/lib/trpc";

import { errorText, whoFor, type Detail, type Doc } from "./shared";

// Reviewing one upload: the viewer (admin 15-return-detail-return-viewer) and the reject dialog
// (21-dialogs-and-sheets-dlg-reject). A rejection's reason is shown to the client, so it's required.

export function useDocumentReview() {
  const utils = trpc.useUtils();
  const review = trpc.document.review.useMutation();
  const [rejecting, setRejecting] = React.useState<Doc | null>(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const accept = async (doc: Doc) => {
    try {
      await review.mutateAsync({ documentId: doc.id, decision: "accept" });
      await utils.invalidate();
      toast.success(`${doc.kindLabel} accepted`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const startReject = (doc: Doc) => {
    setRejecting(doc);
    setReason("");
    setReasonError(null);
    setError(null);
  };
  const check = (v: string) => {
    const m = v.trim().length >= 3 ? null : "Tell the client what's wrong, so they know what to send instead.";
    setReasonError(m);
    return !m;
  };
  const reject = async () => {
    if (!rejecting || !check(reason)) return;
    setError(null);
    try {
      await review.mutateAsync({ documentId: rejecting.id, decision: "reject", reason: reason.trim() });
      await utils.invalidate();
      toast.success(`${rejecting.kindLabel} rejected. The client has been asked for a new copy.`);
      setRejecting(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const dialog = (
    <Dialog open={!!rejecting} onOpenChange={(o) => !o && !review.isPending && setRejecting(null)}>
      {rejecting ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting.kindLabel}?</DialogTitle>
            <DialogDescription>{rejecting.filename}. The client sees your reason and is asked to upload it again.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="reject-reason">Reason shown to the client</Label>
            <Textarea
              id="reject-reason"
              autoFocus
              value={reason}
              aria-invalid={reasonError ? true : undefined}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) check(e.target.value);
              }}
              onBlur={() => check(reason)}
              placeholder="Page 2 is cut off at the bottom. Please retake the photo with the whole page showing."
            />
            {reasonError ? (
              <p role="alert" className="text-sm text-danger-foreground">
                {reasonError}
              </p>
            ) : null}
          </div>
          {error ? <Banner tone="danger" title="It wasn't rejected">{error}</Banner> : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)} disabled={review.isPending}>
              Cancel
            </Button>
            <Button onClick={reject} disabled={review.isPending}>
              Reject and tell the client
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );

  return { accept, startReject, dialog, pending: review.isPending };
}

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function FileView({ doc }: { doc: Doc }) {
  const src = at(`/api/documents/${doc.id}/file`);
  if (doc.mimeType === "application/pdf") return <iframe title={doc.filename} src={src} className="h-[70vh] w-full rounded-md border bg-card" />;
  if (doc.mimeType.startsWith("image/") && doc.mimeType !== "image/heic") return <img src={src} alt={`${doc.kindLabel}: ${doc.filename}`} className="max-h-[70vh] max-w-full rounded-md border object-contain" />;
  return (
    <p className="text-sm text-muted-foreground">
      This file type can't be shown here.{" "}
      <a href={src} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
        Open it in a new tab
      </a>
    </p>
  );
}

export function DocumentReview({ d, doc, onBack }: { d: Detail; doc: Doc; onBack: () => void }) {
  const { accept, startReject, dialog } = useDocumentReview();
  const request = doc.requestId ? d.requests.find((r) => r.id === doc.requestId) : undefined;
  return (
    <>
      <DocumentViewer
        filename={doc.filename}
        status={doc.status}
        onBack={onBack}
        onAccept={() => accept(doc)}
        onReject={() => startReject(doc)}
        meta={[
          { label: "Document", value: doc.kindLabel },
          { label: "From", value: whoFor(d, doc.personId) },
          { label: "Uploaded", value: formatDateTime(doc.uploadedAt) },
          { label: "File", value: `${doc.mimeType === "application/pdf" ? "PDF" : doc.mimeType.replace("image/", "").toUpperCase()} · ${size(doc.sizeBytes)}` },
          ...(request ? [{ label: "Answers the request", value: request.title }] : []),
          ...(doc.status === "rejected" && doc.rejectReason ? [{ label: "Reason shown to the client", value: `“${doc.rejectReason}”` }] : []),
        ]}
      >
        <FileView doc={doc} />
      </DocumentViewer>
      {dialog}
    </>
  );
}
