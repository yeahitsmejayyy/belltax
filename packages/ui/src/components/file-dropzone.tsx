import { UPLOAD_MAX_BYTES } from "@app/schema";
import { FileUp } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";

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
        <span className="text-sm font-medium max-md:text-base">{label}</span>
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
