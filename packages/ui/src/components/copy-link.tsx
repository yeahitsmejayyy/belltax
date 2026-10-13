import { Check, Copy } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";

// A one-time link to hand over (an invite, a password reset): shown once, copied in one click (ticket 05). The field
// is read-only and selects itself, so copying still works where the clipboard is refused.
export function CopyLink({ url, label = "One-time link", note, className }: { url: string; label?: string; note?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const field = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const copy = async () => {
    field.current?.select();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Selected: the person can copy it themselves.
    }
  };
  return (
    <div data-slot="copy-link" className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={field}
          id={id}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-md border bg-muted/40 px-3 font-mono text-xs text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="button" variant="outline" onClick={copy} aria-label={copied ? "Copied" : "Copy link"}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
