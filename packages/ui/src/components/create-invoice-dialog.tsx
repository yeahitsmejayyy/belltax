import * as React from "react";

import { Banner } from "./banner";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Label } from "./label";
import { Money } from "./money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Skeleton } from "./skeleton";

// Create invoice (admin 23-dialogs-and-sheets-dlg-invoice): the package and add-ons this return's facts call for,
// pre-ticked from the suggestion and priced from Settings → Services & pricing. Add-ons with no price are
// "Included": named on the invoice, never charged (R26). Presentational: the prices and the suggestion come in as
// props, the chosen lines go out through `onSubmit`; the admin creates, sends, toasts and refetches.

export type InvoicePackageOption = { code: string; name: string; unitAmountCents: number; active: boolean };
/** `unitAmountCents` is null for an add-on included at no charge. */
export type InvoiceAddonOption = { code: string; name: string; unitAmountCents: number | null; active: boolean };
/** What the return's facts call for: a package, priced lines (with how many) and included add-ons. */
export type InvoiceSuggestion = {
  packageCode: string | null;
  lines: { priceCode: string | null; quantity: number }[];
  included: { code: string }[];
};
/** What Create and send sends: the charged lines and the codes of the included add-ons. */
export type InvoiceDraft = {
  lines: { description: string; quantity: number; unitAmountCents: number; priceCode: string }[];
  included: string[];
};

const NONE = "none";

type FormProps = {
  packages: InvoicePackageOption[];
  addons: InvoiceAddonOption[];
  suggestion: InvoiceSuggestion;
  onSubmit: (draft: InvoiceDraft) => void;
  onClose: () => void;
  busy: boolean;
  error?: string | null;
  dueDays: number;
  noPackageLabel: string;
};

function InvoiceForm({ packages: allPackages, addons: allAddons, suggestion, onSubmit, onClose, busy, error, dueDays, noPackageLabel }: FormProps) {
  const packages = allPackages.filter((p) => p.active || p.code === suggestion.packageCode);
  const addons = allAddons.filter((a) => a.active);
  const suggestedQty = new Map(suggestion.lines.map((l) => [l.priceCode, l.quantity]));
  const [pkg, setPkg] = React.useState(suggestion.packageCode ?? NONE);
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set([...suggestion.lines.map((l) => l.priceCode), ...suggestion.included.map((i) => i.code)].filter((c): c is string => !!c && addons.some((a) => a.code === c))),
  );
  const [invalid, setInvalid] = React.useState<string | null>(null);

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

  const submit = () => {
    if (!lines.length) return setInvalid("Choose a package or a priced add-on: an invoice needs something to charge.");
    setInvalid(null);
    onSubmit({ lines, included });
  };
  const shown = invalid ?? error;

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
            <SelectItem value={NONE}>{noPackageLabel}</SelectItem>
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
      <p className="text-xs text-muted-foreground">Due {dueDays} days after sending. Prices come from Settings → Services & pricing.</p>

      {shown ? <Banner tone="danger" title="The invoice wasn't sent">{shown}</Banner> : null}
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

export type CreateInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Who it's for, as the description words it ("Dana & Sam Marigold"). */
  name: string;
  /** Packages and add-ons from Settings; null while loading. Inactive ones are left out (the suggested package stays). */
  pricing: { packages: InvoicePackageOption[]; addons: InvoiceAddonOption[] } | null;
  /** What this return calls for; null while loading. */
  suggestion: InvoiceSuggestion | null;
  /** Why pricing or the suggestion didn't load. */
  loadError?: string | null;
  /** Change it to start the form over (new prices, say). */
  formKey?: React.Key;
  onSubmit: (draft: InvoiceDraft) => void;
  /** True while creating or sending: both buttons wait. */
  busy?: boolean;
  /** Why the last create or send failed. */
  error?: string | null;
  dueDays?: number;
  noPackageLabel?: string;
};

/** The invoice builder: a package, the add-ons (priced or Included), the total, then Create and send. */
export function CreateInvoiceDialog({
  open,
  onOpenChange,
  name,
  pricing,
  suggestion,
  loadError,
  formKey,
  onSubmit,
  busy = false,
  error,
  dueDays = 14,
  noPackageLabel = "No package (add-ons only)",
}: CreateInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
          <DialogDescription>For {name}. The client pays from the portal.</DialogDescription>
        </DialogHeader>
        {loadError ? (
          <Banner tone="danger" title="Pricing didn't load">{loadError}</Banner>
        ) : pricing && suggestion ? (
          <InvoiceForm
            key={formKey}
            packages={pricing.packages}
            addons={pricing.addons}
            suggestion={suggestion}
            onSubmit={onSubmit}
            onClose={() => onOpenChange(false)}
            busy={busy}
            error={error}
            dueDays={dueDays}
            noPackageLabel={noPackageLabel}
          />
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
