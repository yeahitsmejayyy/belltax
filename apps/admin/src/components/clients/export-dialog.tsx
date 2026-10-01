import { Download, FolderCheck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Checkbox } from "@app/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@app/ui/components/dialog";
import { Label } from "@app/ui/components/label";

import { trpc, type RouterOutputs } from "@/lib/trpc";

// Export a household (ticket 33; no mockup, the dialog pattern of admin 19): writes the offline copy to the
// practice's export folder on this machine. Only the path comes back; the contents never reach the browser.

type Result = RouterOutputs["household"]["export"];

const size = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

export function ExportHouseholdDialog({ householdId, name }: { householdId: string; name: string }) {
  const [open, setOpen] = React.useState(false);
  const [encrypt, setEncrypt] = React.useState(true);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const run = trpc.household.export.useMutation();

  const onOpenChange = (o: boolean) => {
    if (run.isPending) return;
    setOpen(o);
    if (o) {
      setResult(null);
      setError(null);
    }
  };

  const go = async () => {
    setError(null);
    try {
      const r = await run.mutateAsync({ householdId, encrypt });
      setResult(r);
      toast.success(`${name} exported`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The export didn't finish.");
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
              <dd className="tabular-nums">{size(result.bytes)}</dd>
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
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={run.isPending}>
                Cancel
              </Button>
              <Button onClick={go} disabled={run.isPending}>
                {run.isPending ? "Exporting…" : "Export"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
