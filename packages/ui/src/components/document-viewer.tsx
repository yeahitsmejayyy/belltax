import { ArrowLeft, Check, X } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { DocumentChip, type DocumentChipStatus } from "./status-chip";

// The full-page review of one upload (admin 15-return-detail-return-viewer): the file on the left, what it
// is and the decision on the right. The file itself is the app's to render (an <iframe> of the PDF from
// /api/documents/:id/file, or an <img>); this is the frame around it.

type DocumentViewerProps = {
  filename: string;
  status: DocumentChipStatus;
  meta: { label: string; value: React.ReactNode }[];
  children: React.ReactNode; // the file
  onBack?: () => void;
  onAccept?: () => void;
  onReject?: () => void; // opens the reject dialog; the reason is required and shown to the client
  className?: string;
};

export function DocumentViewer({ filename, status, meta, children, onBack, onAccept, onReject, className }: DocumentViewerProps) {
  const decided = status === "accepted" || status === "rejected";
  return (
    <div data-slot="document-viewer" className={cn("grid min-h-[520px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[1fr_320px]", className)}>
      <div className="flex min-h-0 flex-col bg-muted/50">
        <header className="flex items-center gap-2 border-b bg-card px-3 py-2">
          {onBack ? (
            <Button variant="ghost" size="icon" aria-label="Back to documents" onClick={onBack}>
              <ArrowLeft />
            </Button>
          ) : null}
          <span className="truncate text-sm font-medium">{filename}</span>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">{children}</div>
      </div>
      <aside className="grid content-start gap-5 border-t p-5 lg:border-t-0 lg:border-l">
        <DocumentChip status={status} />
        <dl className="grid gap-3 text-sm">
          {meta.map((m) => (
            <div key={m.label} className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
        {!decided && (onAccept || onReject) ? (
          <div className="grid gap-2">
            {onAccept ? (
              <Button onClick={onAccept}>
                <Check /> Accept
              </Button>
            ) : null}
            {onReject ? (
              <Button variant="outline" onClick={onReject}>
                <X /> Reject with reason
              </Button>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
