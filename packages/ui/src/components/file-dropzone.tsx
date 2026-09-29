import { UPLOAD_MAX_BYTES } from "@app/schema";
import { AlertCircle, CheckCircle2, FileText, FileUp, RotateCcw, X } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { Progress } from "./progress";
import { StatusChip } from "./status-chip";

// Tap to choose on a phone, drop on a desktop (portal 13-documents, 23-desktop-d-documents). It only picks
// files and says what's wrong with them; uploading is the app's job (POST /api/documents).

export const ACCEPTED = {
  // What /api/documents accepts (apps/server/src/rest/documents.ts sniffs the bytes; this is the first check).
  mime: ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"],
  label: "PDF, JPG, PNG or HEIC",
  maxBytes: UPLOAD_MAX_BYTES,
};

type FileDropzoneProps = {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function FileDropzone({ onFiles, multiple = true, disabled, label = "Upload a document", className }: FileDropzoneProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  const take = (list: FileList | null) => {
    const files = [...(list ?? [])];
    const bad = files.find((f) => !ACCEPTED.mime.includes(f.type) || f.size > ACCEPTED.maxBytes);
    if (bad) {
      setError(bad.size > ACCEPTED.maxBytes ? `${bad.name} is over ${Math.round(ACCEPTED.maxBytes / 1024 / 1024)} MB. Try a smaller scan or a photo.` : `${bad.name} isn't a ${ACCEPTED.label} file.`);
      return;
    }
    setError(null);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div data-slot="file-dropzone" className={cn("grid gap-2", className)}>
      <label
        htmlFor={id}
        data-over={over || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) take(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors hover:bg-accent focus-within:ring-[3px] focus-within:ring-ring/50 data-[over]:border-primary data-[over]:bg-brand-subtle",
          disabled && "pointer-events-none opacity-50",
          error && "border-danger",
        )}
      >
        <FileUp aria-hidden="true" className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium max-md:text-base">{over ? "Drop to upload" : label}</span>
        <span className="text-xs text-muted-foreground">
          <span className="md:hidden">Tap to take a photo or choose a file.</span>
          <span className="max-md:hidden">Drop files here, or click to choose.</span> {ACCEPTED.label}, up to {Math.round(ACCEPTED.maxBytes / 1024 / 1024)} MB.
        </span>
        <input
          ref={input}
          id={id}
          type="file"
          className="sr-only"
          accept={ACCEPTED.mime.join(",")}
          multiple={multiple}
          disabled={disabled}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ── What happened to each file ─────────────────────────────────────────────────────────────────────────
// Every pick shows up at once (with a thumbnail for photos), then a progress bar, then Uploaded or what went
// wrong, and a screen reader hears each result. The app supplies `upload` (POST /api/documents with progress);
// the list and the feedback are the same everywhere.

export type UploadStatus = "uploading" | "uploaded" | "failed";
export type UploadItem = { id: string; file: File; status: UploadStatus; progress: number; error?: string; previewUrl?: string };
export type Uploader = (file: File, onProgress: (fraction: number) => void) => Promise<void>;

export function useUploads(upload: Uploader) {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [announcement, setAnnouncement] = React.useState("");
  const urls = React.useRef<string[]>([]);
  React.useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const patch = (id: string, p: Partial<UploadItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const start = React.useCallback(
    (files: File[]) => {
      for (const file of files) {
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
        const previewUrl = file.type.startsWith("image/") && file.type !== "image/heic" ? URL.createObjectURL(file) : undefined;
        if (previewUrl) urls.current.push(previewUrl);
        setItems((xs) => [{ id, file, status: "uploading", progress: 0, previewUrl }, ...xs]);
        setAnnouncement(`Uploading ${file.name}`);
        upload(file, (f) => patch(id, { progress: Math.round(Math.min(1, Math.max(0, f)) * 100) }))
          .then(() => {
            patch(id, { status: "uploaded", progress: 100 });
            setAnnouncement(`${file.name} uploaded`);
          })
          .catch((e: unknown) => {
            const error = e instanceof Error ? e.message : "The upload didn't finish. Try again.";
            patch(id, { status: "failed", error });
            setAnnouncement(`${file.name} didn't upload. ${error}`);
          });
      }
    },
    [upload],
  );

  const retry = (id: string) => {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    setItems((xs) => xs.filter((x) => x.id !== id));
    start([item.file]);
  };
  const remove = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));

  return { items, start, retry, remove, announcement };
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function UploadList({ items, announcement, onRetry, onRemove, className }: { items: UploadItem[]; announcement?: string; onRetry?: (id: string) => void; onRemove?: (id: string) => void; className?: string }) {
  return (
    <div data-slot="upload-list" className={cn("grid gap-2", className)}>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {items.length ? (
        <ul aria-label="Your uploads" className="grid gap-2">
          {items.map((i) => (
            <li key={i.id} data-status={i.status} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                <Thumb url={i.previewUrl} />
              </span>
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="truncate text-sm font-medium">{i.file.name}</span>
                {i.status === "uploading" ? (
                  <Progress value={i.progress} aria-label={`Uploading ${i.file.name}`} className="h-1.5" />
                ) : i.status === "failed" ? (
                  <span className="text-xs text-danger-foreground">{i.error}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">{kb(i.file.size)}</span>
                )}
              </span>
              {i.status === "uploaded" ? (
                <StatusChip tone="success" icon={CheckCircle2} label="Uploaded" />
              ) : i.status === "failed" ? (
                <span className="flex items-center gap-1">
                  <StatusChip tone="danger" icon={AlertCircle} label="Failed" />
                  {onRetry ? (
                    <Button variant="ghost" size="icon-sm" aria-label={`Try ${i.file.name} again`} onClick={() => onRetry(i.id)}>
                      <RotateCcw />
                    </Button>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground tabular-nums">{i.progress}%</span>
              )}
              {onRemove && i.status !== "uploading" ? (
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${i.file.name} from this list`} onClick={() => onRemove(i.id)}>
                  <X />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// A photo's thumbnail, or the file icon when there's nothing to preview (PDFs, HEIC, unreadable images).
function Thumb({ url }: { url?: string }) {
  const [broken, setBroken] = React.useState(false);
  return url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} className="size-full object-cover" /> : <FileText aria-hidden="true" className="size-5" />;
}
