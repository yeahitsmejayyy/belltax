import { ChevronRight, FilePlus2, FileText, FolderOpen, Upload } from "lucide-react";
import * as React from "react";

import { formatDateTime } from "../format";
import { Banner } from "./banner";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { DocumentViewer } from "./document-viewer";
import { EmptyState } from "./empty-state";
import { Label } from "./label";
import { DocumentChip } from "./status-chip";
import { Textarea } from "./textarea";

// A return's documents in the preparer admin (admin 14-return-detail-return-documents, 15-return-detail-return-viewer,
// 21-dialogs-and-sheets-dlg-reject), the pieces apps/admin's return page renders and Storybook shows (ticket 59): every
// upload and every request still waiting on one, the review of one upload, and the reject dialog. A verified photo ID
// (ticket 49) has no image any more, only a note: verified, when, and what kind. Data in; the app does the review
// mutation, its toasts and the ?doc= selection through the callbacks.

/** One upload on the return, as the admin shows it. */
export type ReturnDocument = {
  id: string;
  kindLabel: string;
  status: "uploaded" | "accepted" | "rejected";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** When the image was deleted (a verified photo ID); the row then reads "Verified … · image deleted". */
  deletedAt: string | null;
  /** Shown to the client when rejected. */
  rejectReason: string | null;
  /** A photo ID: accepting it verifies it and deletes the image. */
  identity: boolean;
  /** Who it's from, in a word: a first name, or "Household". */
  who: string;
  /** The title of the request it answers, if any. */
  request?: string | null;
};

/** A document request with nothing uploaded yet. */
export type ReturnWaitingRequest = { id: string; title: string; who: string; createdAt: string; note: string | null };

// ---------- The list ----------

export type ReturnDocumentsProps = {
  documents: ReturnDocument[];
  waiting: ReturnWaitingRequest[];
  /** Opens one upload in the viewer. */
  onOpen: (id: string) => void;
  onAccept: (doc: ReturnDocument) => void;
  /** Starts a rejection (opens the reject dialog). */
  onReject: (doc: ReturnDocument) => void;
  /** Opens the request-a-document sheet. */
  onRequest: () => void;
  /** A review is being sent: Accept and Reject wait. */
  pending?: boolean;
  /** Rendered after the list: the reject dialog. */
  children?: React.ReactNode;
};

/** The Documents tab: counts, Request a document, then uploads (with Accept / Reject inline) and waiting requests. */
export function ReturnDocuments({ documents, waiting, onOpen, onAccept, onReject, onRequest, pending = false, children }: ReturnDocumentsProps) {
  const accepted = documents.filter((x) => x.status === "accepted").length;
  const toReview = documents.filter((x) => x.status === "uploaded").length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {accepted} of {documents.length} accepted · {toReview} need review · {waiting.length} outstanding
        </p>
        <Button variant="outline" className="max-md:h-11" onClick={onRequest}>
          <FilePlus2 /> Request a document
        </Button>
      </div>

      {documents.length || waiting.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
              <span aria-hidden="true" className="hidden size-12 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground sm:flex">
                <FileText className="size-5" />
              </span>
              <button type="button" onClick={() => onOpen(doc.id)} className="grid min-w-0 flex-1 gap-1 rounded-md text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{doc.kindLabel}</span>
                  <DocumentChip status={doc.status} />
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {doc.deletedAt
                    ? `${doc.who} · Verified ${formatDateTime(doc.deletedAt)} · image deleted`
                    : `${doc.who} · Uploaded ${formatDateTime(doc.uploadedAt)} · ${doc.filename}`}
                </span>
                {doc.status === "rejected" && doc.rejectReason ? (
                  <span className="text-sm text-warning-foreground">Reason shown to the client: “{doc.rejectReason}”</span>
                ) : null}
              </button>
              {doc.status === "uploaded" ? (
                <div className="flex shrink-0 gap-1 max-sm:hidden">
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => onAccept(doc)}>
                    Accept
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => onReject(doc)}>
                    Reject
                  </Button>
                </div>
              ) : null}
              <Button variant="ghost" size="icon" className="shrink-0 max-md:size-11" aria-label={`Open ${doc.kindLabel}, ${doc.filename}`} onClick={() => onOpen(doc.id)}>
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
                  {r.who} · Requested {formatDateTime(r.createdAt)}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FolderOpen} title="No documents yet" description="Nothing has been uploaded or requested for this return." />
      )}
      {children}
    </div>
  );
}

// ---------- Reviewing one upload ----------

/** "1.2 MB", or "84 KB" (never less than 1 KB). */
export const fileSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** "PDF", "JPEG", "PNG": the file type in a word. */
export const fileType = (mimeType: string) => (mimeType === "application/pdf" ? "PDF" : mimeType.replace("image/", "").toUpperCase());

/**
 * The file itself: a PDF in an <iframe>, an image (not HEIC) in an <img>, anything else as a link. A verified ID whose
 * image is deleted shows the note that's left instead. `src` is the file's URL, built by the app.
 */
export function DocumentFile({ doc, src }: { doc: Pick<ReturnDocument, "kindLabel" | "filename" | "mimeType" | "deletedAt">; src: string }) {
  if (doc.deletedAt) return <p className="text-sm text-muted-foreground">Verified on {formatDateTime(doc.deletedAt)}. The image was deleted then; this note is all the portal keeps.</p>;
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

export type ReturnDocumentReviewProps = {
  doc: ReturnDocument;
  /** The file's URL. */
  src: string;
  onBack: () => void;
  onAccept: () => void;
  /** Starts a rejection (opens the reject dialog). */
  onReject: () => void;
  /** Rendered after the viewer: the reject dialog. */
  children?: React.ReactNode;
};

/** One upload in the viewer: what it is, who it's from, the file, and Accept / Reject. A photo ID warns that accepting deletes it. */
export function ReturnDocumentReview({ doc, src, onBack, onAccept, onReject, children }: ReturnDocumentReviewProps) {
  return (
    <>
      <DocumentViewer
        filename={doc.filename}
        status={doc.status}
        onBack={onBack}
        onAccept={onAccept}
        onReject={onReject}
        meta={[
          { label: "Document", value: doc.kindLabel },
          { label: "From", value: doc.who },
          { label: "Uploaded", value: formatDateTime(doc.uploadedAt) },
          { label: "File", value: `${fileType(doc.mimeType)} · ${fileSize(doc.sizeBytes)}` },
          ...(doc.request ? [{ label: "Answers the request", value: doc.request }] : []),
          ...(doc.status === "rejected" && doc.rejectReason ? [{ label: "Reason shown to the client", value: `“${doc.rejectReason}”` }] : []),
        ]}
      >
        <div className="grid w-full gap-3">
          {doc.identity && doc.status === "uploaded" ? (
            <Banner tone="info" title="Accepting verifies this ID and deletes the image">
              Right away, with no copy kept. The portal keeps a note: verified, when, and what kind.
            </Banner>
          ) : null}
          <DocumentFile doc={doc} src={src} />
        </div>
      </DocumentViewer>
      {children}
    </>
  );
}

// ---------- Rejecting ----------

/** The shortest rejection reason accepted: the client has to know what to send instead. */
export const MIN_REJECT_REASON = 3;
const checkReason = (v: string) => (v.trim().length >= MIN_REJECT_REASON ? null : "Tell the client what's wrong, so they know what to send instead.");

export type RejectDocumentDialogProps = {
  /** The upload being rejected; null keeps the dialog closed. */
  doc: Pick<ReturnDocument, "id" | "kindLabel" | "filename"> | null;
  /** The reason shown to the client. */
  reason: string;
  onReasonChange: (reason: string) => void;
  /** The server's words when it refused. */
  error?: string | null;
  /** The rejection is being sent: the buttons wait and the dialog can't be dismissed. */
  pending?: boolean;
  onCancel: () => void;
  /** Gets the trimmed reason, only once it's long enough. */
  onConfirm: (reason: string) => void;
};

function RejectForm({ doc, reason, onReasonChange, error, pending, onCancel, onConfirm }: Omit<RejectDocumentDialogProps, "doc"> & { doc: NonNullable<RejectDocumentDialogProps["doc"]> }) {
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const check = (v: string) => {
    const m = checkReason(v);
    setReasonError(m);
    return !m;
  };
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Reject {doc.kindLabel}?</DialogTitle>
        <DialogDescription>{doc.filename}. The client sees your reason and is asked to upload it again.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="reject-reason">Reason shown to the client</Label>
        <Textarea
          id="reject-reason"
          autoFocus
          value={reason}
          aria-invalid={reasonError ? true : undefined}
          onChange={(e) => {
            onReasonChange(e.target.value);
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
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={() => check(reason) && onConfirm(reason.trim())} disabled={pending}>
          Reject and tell the client
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Rejecting an upload: the reason is required, because the client sees it and is asked to upload again. */
export function RejectDocumentDialog({ doc, pending = false, onCancel, ...rest }: RejectDocumentDialogProps) {
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && !pending && onCancel()}>
      {doc ? <RejectForm key={doc.id} doc={doc} pending={pending} onCancel={onCancel} {...rest} /> : null}
    </Dialog>
  );
}
