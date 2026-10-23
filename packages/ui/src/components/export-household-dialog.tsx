import { Download, FolderCheck } from "lucide-react";
import * as React from "react";

import { Banner } from "./banner";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Label } from "./label";

// Export a household (ticket 33; no mockup, the dialog pattern of admin 19), the dialog apps/admin renders and Storybook
// shows (ticket 58): the offline copy goes to the practice's export folder on this machine, and only where it went
// comes back. The app does the export through `onExport` (and any toast); the dialog shows pending, the result and errors.

/** What an export reports back: where it was written, never its contents. */
export type ExportResult = { path: string; documents: number; bytes: number; encrypted: boolean };

export const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

export type ExportHouseholdDialogProps = {
  /** The household's name, for the title. */
  name: string;
  /** Runs the export. Resolve with the result; throw (an Error's message is shown) when it didn't finish. */
  onExport: (options: { encrypt: boolean }) => Promise<ExportResult>;
  /** Whether "Encrypt with the backup passphrase" starts ticked. */
  defaultEncrypt?: boolean;
};

export function ExportHouseholdDialog({ name, onExport, defaultEncrypt = true }: ExportHouseholdDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [encrypt, setEncrypt] = React.useState(defaultEncrypt);
  const [result, setResult] = React.useState<ExportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const onOpenChange = (o: boolean) => {
    if (pending) return;
    setOpen(o);
    if (o) {
      setResult(null);
      setError(null);
    }
  };

  const go = async () => {
    setError(null);
    setPending(true);
    try {
      setResult(await onExport({ encrypt }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The export didn't finish.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download aria-hidden="true" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export {name}</DialogTitle>
          <DialogDescription>
            Writes an offline copy of this household (people, returns, invoices, letters and every document) to the practice's export
            folder on this computer. Nothing is downloaded to the browser.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <Banner tone="success" title="Export written">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1">
              <dt>Folder</dt>
              <dd className="font-mono text-xs break-all">{result.path}</dd>
              <dt>Documents</dt>
              <dd className="tabular-nums">{result.documents}</dd>
              <dt>Size</dt>
              <dd className="tabular-nums">{fileSize(result.bytes)}</dd>
              <dt>Encrypted</dt>
              <dd>{result.encrypted ? "Yes, with the backup passphrase" : "No"}</dd>
            </dl>
          </Banner>
        ) : (
          <div className="flex items-start gap-3">
            <Checkbox id="export-encrypt" checked={encrypt} onCheckedChange={(v) => setEncrypt(v === true)} className="mt-0.5" />
            <div className="grid gap-1">
              <Label htmlFor="export-encrypt">Encrypt with the backup passphrase</Label>
              <p className="text-xs text-muted-foreground">Recommended. Open it later with bun run export:open.</p>
            </div>
          </div>
        )}

        {error ? <Banner tone="danger" title="The export didn't finish">{error}</Banner> : null}

        <DialogFooter>
          {result ? (
            <Button onClick={() => setOpen(false)}>
              <FolderCheck aria-hidden="true" />
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={go} disabled={pending}>
                {pending ? "Exporting…" : "Export"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
