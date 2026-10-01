import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Checkbox } from "@app/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@app/ui/components/dialog";
import { Label } from "@app/ui/components/label";
import { Money } from "@app/ui/components/money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { Skeleton } from "@app/ui/components/skeleton";

import { trpc, type RouterOutputs } from "@/lib/trpc";

import { errorText, type Detail } from "./shared";

// Create invoice (admin 23-dialogs-and-sheets-dlg-invoice): the package and add-ons this return's facts call for,
// pre-ticked from invoice.suggest and priced from Settings → Services & pricing. Add-ons with no price are
// "Included": named on the invoice, never charged. Create and send issues it straight away.

type Pricing = RouterOutputs["settings"]["pricing"]["list"];
type Suggestion = RouterOutputs["invoice"]["suggest"];
const NONE = "none";
const DUE_DAYS = 14;

function dueOn() {
  const d = new Date(Date.now() + DUE_DAYS * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function InvoiceForm({ d, name, pricing, suggestion, onClose }: { d: Detail; name: string; pricing: Pricing; suggestion: Suggestion; onClose: () => void }) {
  const packages = pricing.packages.filter((p) => p.active || p.code === suggestion.packageCode);
  const addons = pricing.addons.filter((a) => a.active);
  const suggestedQty = new Map(suggestion.lines.map((l) => [l.priceCode, l.quantity]));
  const [pkg, setPkg] = React.useState(suggestion.packageCode ?? NONE);
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set([...suggestion.lines.map((l) => l.priceCode), ...suggestion.included.map((i) => i.code)].filter((c): c is string => !!c && addons.some((a) => a.code === c))),
  );
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const create = trpc.invoice.create.useMutation();
  const issue = trpc.invoice.issue.useMutation();
  const busy = create.isPending || issue.isPending;

  const chosenPkg = packages.find((p) => p.code === pkg);
  const chosen = addons.filter((a) => checked.has(a.code));
  const lines = [
    ...(chosenPkg ? [{ description: chosenPkg.name, quantity: 1, unitAmountCents: chosenPkg.unitAmountCents, priceCode: chosenPkg.code }] : []),
    ...chosen
      .filter((a) => a.unitAmountCents !== null)
      .map((a) => ({ description: a.name, quantity: suggestedQty.get(a.code) ?? 1, unitAmountCents: a.unitAmountCents!, priceCode: a.code })),
  ];
  const included = chosen.filter((a) => a.unitAmountCents === null).map((a) => a.code);
  const total = lines.reduce((s, l) => s + l.quantity * l.unitAmountCents, 0);

  const toggle = (code: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });

  const submit = async () => {
    if (!lines.length) return setError("Choose a package or a priced add-on: an invoice needs something to charge.");
    setError(null);
    try {
      const inv = await create.mutateAsync({ engagementId: d.engagementId, lines, included, dueOn: dueOn() });
      try {
        await issue.mutateAsync({ invoiceId: inv.id });
        toast.success(`${inv.number} sent to ${name}`);
        onClose();
      } catch (e) {
        setError(`${inv.number} was created as a draft but not sent: ${errorText(e)}`);
      }
      await utils.invalidate();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="invoice-package">Package</Label>
        <Select value={pkg} onValueChange={setPkg}>
          <SelectTrigger id="invoice-package" className="w-full max-md:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {packages.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.name} · <Money cents={p.unitAmountCents} />
              </SelectItem>
            ))}
            <SelectItem value={NONE}>No package (add-ons only)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {addons.length ? (
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">Add-ons</legend>
          {addons.map((a) => {
            const qty = suggestedQty.get(a.code) ?? 1;
            return (
              <div key={a.code} className="flex min-h-11 items-center justify-between gap-3 md:min-h-0">
                <Label className="font-normal">
                  <Checkbox checked={checked.has(a.code)} onCheckedChange={(v) => toggle(a.code, v === true)} />
                  {a.name}
                  {qty > 1 ? <span className="text-muted-foreground">× {qty}</span> : null}
                </Label>
                {a.unitAmountCents === null ? <span className="text-sm text-muted-foreground">Included</span> : <Money cents={a.unitAmountCents * qty} className="text-sm" />}
              </div>
            );
          })}
        </fieldset>
      ) : null}

      <div className="flex items-center justify-between border-t pt-3 font-semibold">
        <span>Total</span>
        <Money cents={total} />
      </div>
      <p className="text-xs text-muted-foreground">Due {DUE_DAYS} days after sending. Prices come from Settings → Services & pricing.</p>

      {error ? <Banner tone="danger" title="The invoice wasn't sent">{error}</Banner> : null}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy}>
          Create and send
        </Button>
      </DialogFooter>
    </>
  );
}

export function InvoiceDialog({ d, name, open, onOpenChange }: { d: Detail; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const pricing = trpc.settings.pricing.list.useQuery({ taxYear: d.taxYear }, { enabled: open });
  const suggestion = trpc.invoice.suggest.useQuery({ engagementId: d.engagementId }, { enabled: open });
  const failed = pricing.error ?? suggestion.error;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
          <DialogDescription>For {name}. The client pays from the portal.</DialogDescription>
        </DialogHeader>
        {failed ? (
          <Banner tone="danger" title="Pricing didn't load">{failed.message}</Banner>
        ) : pricing.data && suggestion.data ? (
          <InvoiceForm key={String(pricing.dataUpdatedAt)} d={d} name={name} pricing={pricing.data} suggestion={suggestion.data} onClose={() => onOpenChange(false)} />
        ) : (
          <div className="grid gap-3" aria-busy="true" aria-label="Loading pricing">
            <Skeleton className="h-9" />
            <Skeleton className="h-32" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
