import type { RequestView } from "@app/schema";
import { CircleAlert, FileCheck2, FileText, MessageCircleQuestion, Trash2, Upload } from "lucide-react";
import * as React from "react";

import { formatDate } from "../format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "./alert-dialog";
import { Banner } from "./banner";
import { Button } from "./button";
import { ACCEPTED, FileDropzone, UploadList, type UploadItem } from "./file-dropzone";
import { PageHeader, SectionHeader } from "./page-header";
import { Progress } from "./progress";
import { DocumentChip, type DocumentChipStatus } from "./status-chip";
import { Textarea } from "./textarea";

// The client portal's Documents screen (portal 13-documents, desktop 23-desktop-d-documents), the pieces apps/portal
// renders and Storybook shows: what the preparer asked for and where each stands, an upload on every row, files already
// sent, questions answered in place, and room for anything else. Data in, actions out through callbacks; the app does
// the uploads, the mutations and the toasts.

/** Where a requested document stands, from the request and its latest file. */
export function requestStatus(r: Pick<RequestView, "status" | "latestDocument">): DocumentChipStatus {
  if (r.status === "fulfilled") return "accepted";
  const d = r.latestDocument;
  if (!d) return "needed";
  return d.status === "rejected" ? "rejected" : d.status === "accepted" ? "accepted" : "uploaded";
}

/** Files on their way up, as `useUploads` reports them. Finished ones are left out: they show up as sent files. */
export type UploadsState = { items: UploadItem[]; announcement?: string; onRetry?: (id: string) => void; onRemove?: (id: string) => void };

/** The public demo's stand-in for picking files: send an invented sample instead. */
export type SampleAction = { pending: boolean; onClick: () => void };

// ---------- Lists and sections ----------

/** A bordered card of rows (DocRow, RequestRow, QuestionCard). */
export function DocumentList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y overflow-hidden rounded-xl border bg-card">
      {children}
    </ul>
  );
}

/** A titled group on the page: a heading, a line under it, then its list. */
export function DocumentSection({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <SectionHeader title={title} description={description} />
      {children}
    </section>
  );
}

/** The page heading: how many of the requested documents are accepted and what's still needed, with a progress bar. */
export function DocumentsSummary({ title = "Documents", accepted, needed, total, empty = "Everything your preparer asks for shows up here." }: { title?: string; accepted: number; needed: number; total: number; empty?: string }) {
  const summary = total ? `${accepted} of ${total} accepted · ${needed ? `${needed} still needed from you` : "nothing more needed from you"}` : empty;
  return (
    <div className="grid gap-3">
      <PageHeader title={title} description={summary} />
      {total ? <Progress value={(accepted / total) * 100} aria-label={`${accepted} of ${total} documents accepted`} className="[&>[data-slot=progress-indicator]]:bg-success" /> : null}
    </div>
  );
}

// ---------- Rows ----------

/** One document row: what, for whom, where it stands, an optional action (upload) and what was sent under it. */
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

/** A button that opens the file picker (camera roll or camera on a phone), checked like the dropzone. */
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

/** The preparer's reason a file couldn't be used. */
export function RejectedNote({ preparer, reason }: { preparer: string; reason: string | null }) {
  return (
    <p className="rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-warning-foreground">
      {preparer} says: {reason ?? "This copy can't be used. Please upload a clearer one."}
    </p>
  );
}

/** In the public demo, where uploads are off: send an invented sample instead (ticket 46). */
export function SampleButton({ label = "Use a sample document", variant = "outline", pending = false, onClick }: { label?: string; variant?: "outline" | "ghost" | "default"; pending?: boolean; onClick: () => void }) {
  return (
    <Button variant={variant} size="touch" className="w-full md:h-9 md:w-auto md:text-sm" onClick={onClick} disabled={pending} aria-busy={pending}>
      <FileCheck2 /> {pending ? "Sending…" : label}
    </Button>
  );
}

/** A file already sent. */
export type SentFileItem = { id: string; filename: string; sentAt: string; removable?: boolean; pending?: boolean };

/**
 * A file already sent: its name and when, and taking it back (with a confirm) while it hasn't been reviewed. It can't
 * be opened again from here (ticket 52, send-only portal).
 */
export function SentFile({ filename, sentAt, removable = false, pending = false, onRemove }: Omit<SentFileItem, "id"> & { onRemove?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="inline-flex min-h-11 min-w-0 items-center gap-1.5 font-medium md:min-h-8">
        <FileCheck2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{filename}</span>
      </span>
      <span className="text-muted-foreground">· sent {formatDate(sentAt)}</span>
      {removable ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="max-md:h-11 text-muted-foreground" disabled={pending}>
              <Trash2 /> Remove
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {filename}?</AlertDialogTitle>
              <AlertDialogDescription>It hasn't been looked at yet, so you can take it back. You can upload a different file afterwards.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => onRemove?.()}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

export type RequestRowProps = {
  title: string;
  /** Who it's for ("you", a first name), or null for the whole household. */
  who?: string | null;
  /** The preparer's note on the request. */
  note?: string | null;
  status: DocumentChipStatus;
  /** The preparer's first name, for a rejected file's reason. */
  preparer: string;
  rejectReason?: string | null;
  /** Still taking files: shows the upload (or sample) button. */
  open?: boolean;
  /** Files already sent for it (rejected ones left out). */
  files?: SentFileItem[];
  onRemoveFile?: (id: string) => void;
  /** Uploads in progress for it. */
  uploads?: UploadsState;
  onFiles?: (files: File[]) => void;
  /** Public demo: a sample button in place of the file picker. */
  sample?: SampleAction | null;
};

/** One requested document (portal 13, desktop 23). A rejected upload shows the preparer's reason and asks for a better copy. */
export function RequestRow({ title, who, note, status, preparer, rejectReason = null, open = true, files = [], onRemoveFile, uploads, onFiles = () => {}, sample }: RequestRowProps) {
  const label = status === "needed" ? "Upload" : status === "rejected" ? "Upload again" : "Add another file";
  const variant = status === "uploaded" ? "ghost" : "outline";
  const items = uploads?.items ?? [];
  const pick = sample ? (
    <SampleButton label={status === "rejected" ? "Send a sample again" : "Use a sample document"} variant={variant} pending={sample.pending} onClick={sample.onClick} />
  ) : (
    <PickFiles label={label} variant={variant} onFiles={onFiles} />
  );

  return (
    <DocRow
      title={title}
      meta={[who ? `For ${who}` : null, note].filter(Boolean).join(" · ") || null}
      status={status}
      note={status === "rejected" ? <RejectedNote preparer={preparer} reason={rejectReason} /> : null}
      action={open ? pick : null}
    >
      {files.length || items.length ? (
        <>
          {files.map(({ id, ...f }) => (
            <SentFile key={id} {...f} onRemove={() => onRemoveFile?.(id)} />
          ))}
          <UploadList items={items.filter((i) => i.status !== "uploaded")} announcement={uploads?.announcement} onRetry={uploads?.onRetry} onRemove={uploads?.onRemove} />
        </>
      ) : null}
    </DocRow>
  );
}

// ---------- Questions ----------

/**
 * A question from the preparer, answered in place. `onAnswer` gets the trimmed answer; if it returns a promise that
 * rejects, its message shows under the field. Once answered the app drops it from the list.
 */
export function QuestionCard({ title, note, pending = false, onAnswer }: { title: string; note?: string | null; pending?: boolean; onAnswer: (answer: string) => void | Promise<unknown> }) {
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const field = React.useRef<HTMLTextAreaElement>(null);
  const id = React.useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError("Write your answer first.");
      field.current?.focus();
      return;
    }
    setError(null);
    Promise.resolve(onAnswer(value.trim())).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  return (
    <li className="grid gap-3 p-4">
      <div className="flex gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-subtle text-info-foreground">
          <MessageCircleQuestion aria-hidden="true" className="size-5" />
        </span>
        <div className="grid min-w-0 gap-1">
          <p id={`${id}-q`} className="font-medium text-pretty">{title}</p>
          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-2 md:pl-14" noValidate>
        <label htmlFor={`${id}-a`} className="sr-only">
          Your answer
        </label>
        <Textarea
          ref={field}
          id={`${id}-a`}
          aria-describedby={[`${id}-q`, error ? `${id}-e` : null].filter(Boolean).join(" ")}
          aria-invalid={error ? true : undefined}
          placeholder="Your answer"
          maxLength={2000}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error && e.target.value.trim()) setError(null);
          }}
        />
        {error ? (
          <p id={`${id}-e`} role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" size="touch" className="w-full md:h-9 md:w-auto md:justify-self-end md:text-sm" disabled={pending}>
          {pending ? "Sending…" : "Send answer"}
        </Button>
      </form>
    </li>
  );
}

// ---------- Something else ----------

/**
 * Room for anything not asked for: a dropzone (or, in the public demo, a banner with a sample button), the uploads in
 * progress, then whatever was sent this way (`children`, usually a DocumentList of DocRows).
 */
export function SendSomethingElse({
  title = "Something else to send?",
  description = "A letter from the IRS, a form you think matters: send it and it goes with your return.",
  publicDemo = false,
  sample,
  onFiles = () => {},
  disabled,
  uploads,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Uploads are off: a banner instead of the dropzone. */
  publicDemo?: boolean;
  /** The banner's sample button (public demo only); none when null. */
  sample?: SampleAction | null;
  onFiles?: (files: File[]) => void;
  disabled?: boolean;
  uploads?: UploadsState;
  children?: React.ReactNode;
}) {
  return (
    <DocumentSection title={title} description={description}>
      {publicDemo ? (
        <Banner tone="info" title="Uploads are off in the public demo" action={sample ? <SampleButton label="Send a sample" pending={sample.pending} onClick={sample.onClick} /> : null}>
          So nothing real can be sent here. A sample has invented details and goes through exactly the same steps.
        </Banner>
      ) : (
        <FileDropzone label="Upload something else" onFiles={onFiles} disabled={disabled} />
      )}
      <UploadList items={(uploads?.items ?? []).filter((i) => i.status !== "uploaded")} announcement={uploads?.announcement} onRetry={uploads?.onRetry} onRemove={uploads?.onRemove} />
      {children}
    </DocumentSection>
  );
}
