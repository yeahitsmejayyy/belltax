import type { DocumentView, RequestView } from "@app/schema";
import { CircleAlert, FileText, Upload } from "lucide-react";
import * as React from "react";

import { Button } from "@app/ui/components/button";
import { ACCEPTED, UploadList } from "@app/ui/components/file-dropzone";
import { DocumentChip, type DocumentChipStatus } from "@app/ui/components/status-chip";

import { MyUpload } from "@/components/documents/my-upload";
import { useDocumentUploads } from "@/components/documents/use-upload";

// One requested document (portal 13, desktop 23): what, for whom, the preparer's note, where it stands, and
// the upload button. A rejected upload shows the preparer's reason and asks for a better copy.

export function requestStatus(r: RequestView): DocumentChipStatus {
  if (r.status === "fulfilled") return "accepted";
  const d = r.latestDocument;
  if (!d) return "needed";
  return d.status === "rejected" ? "rejected" : d.status === "accepted" ? "accepted" : "uploaded";
}

export function DocRow({ title, meta, status, note, children, action }: { title: string; meta?: string | null; status: DocumentChipStatus; note?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 p-4 md:grid-cols-[auto_1fr_auto]">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText aria-hidden="true" className="size-5" />
      </span>
      <div className="grid min-w-0 content-start gap-1.5">
        <p className="font-medium text-pretty">{title}</p>
        {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
        <DocumentChip status={status} />
        {note}
      </div>
      {action ? <div className="col-span-2 md:col-span-1 md:row-start-1 md:col-start-3">{action}</div> : null}
      {children ? <div className="col-span-2 grid gap-2 md:col-start-2 md:col-span-2">{children}</div> : null}
    </li>
  );
}

// A button that opens the file picker (camera roll or camera on a phone), checked like the dropzone.
export function PickFiles({ label, onFiles, variant = "outline" }: { label: string; onFiles: (files: File[]) => void; variant?: "outline" | "ghost" }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  return (
    <div className="grid gap-1.5 md:justify-items-end">
      <Button variant={variant} size="touch" className="w-full md:h-9 md:w-auto md:text-sm" onClick={() => input.current?.click()} aria-describedby={error ? `${id}-error` : undefined}>
        <Upload /> {label}
      </Button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={ACCEPTED.mime.join(",")}
        multiple
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          const bad = files.find((f) => !ACCEPTED.mime.includes(f.type) || f.size > ACCEPTED.maxBytes);
          if (bad) {
            setError(bad.size > ACCEPTED.maxBytes ? `${bad.name} is over ${Math.round(ACCEPTED.maxBytes / 1024 / 1024)} MB. Try a smaller scan or a photo.` : `${bad.name} isn't a ${ACCEPTED.label} file.`);
            return;
          }
          setError(null);
          if (files.length) onFiles(files);
        }}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RejectedNote({ preparer, reason }: { preparer: string; reason: string | null }) {
  return (
    <p className="rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-warning-foreground">
      {preparer} says: {reason ?? "This copy can't be used. Please upload a clearer one."}
    </p>
  );
}

export function RequestRow({ request, who, engagementId, preparer, files }: { request: RequestView; who: string | null; engagementId: string; preparer: string; files: DocumentView[] }) {
  const status = requestStatus(request);
  const uploads = useDocumentUploads({ engagementId, requestId: request.id });
  const open = request.status === "open";
  const label = status === "needed" ? "Upload" : status === "rejected" ? "Upload again" : "Add another file";
  const sent = files.filter((d) => d.status !== "rejected");

  return (
    <DocRow
      title={request.title}
      meta={[who ? `For ${who}` : null, request.note].filter(Boolean).join(" · ") || null}
      status={status}
      note={status === "rejected" ? <RejectedNote preparer={preparer} reason={request.latestDocument?.rejectReason ?? null} /> : null}
      action={open ? <PickFiles label={label} variant={status === "uploaded" ? "ghost" : "outline"} onFiles={uploads.start} /> : null}
    >
      {sent.length || uploads.items.length ? (
        <>
          {sent.map((d) => (
            <MyUpload key={d.id} doc={d} />
          ))}
          <UploadList items={uploads.items.filter((i) => i.status !== "uploaded")} announcement={uploads.announcement} onRetry={uploads.retry} onRemove={uploads.remove} />
        </>
      ) : null}
    </DocRow>
  );
}
