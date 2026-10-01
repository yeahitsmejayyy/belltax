import type { AddonTrigger } from "@app/schema";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Checkbox } from "@app/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@app/ui/components/dialog";
import { Field } from "@app/ui/components/field";
import { Label } from "@app/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { Textarea } from "@app/ui/components/textarea";

import { FILING_LABEL } from "@/lib/labels";
import { trpc, type RouterOutputs } from "@/lib/trpc";

import { serverMessage } from "./server-error";

// Add or edit a package or an add-on (admin 32-settings-settings-pricing, the pencil). Remove deletes a price
// nobody has used, and retires one that's on past invoices so what was charged still reads.

type Pricing = RouterOutputs["settings"]["pricing"]["list"];
export type Pkg = Pricing["packages"][number];
export type Addon = Pricing["addons"][number];
export type Editing = { kind: "package"; item: Pkg | null } | { kind: "addon"; item: Addon | null };

export const PACKAGE_STATUSES = ["single", "mfj", "mfs", "hoh"] as const;
export const TRIGGER_LABEL: Record<AddonTrigger, string> = {
  self_employment: "Self-employment income",
  rental: "Rental property",
  investments: "Investments",
  ihss: "IHSS home care income",
  covered_california: "Covered California",
  other_state: "Another state's return",
  amended: "Amended return",
};
const MANUAL = "manual";

const toDollars = (cents: number) => (cents / 100).toFixed(2);
function toCents(v: string): number | null {
  const s = v.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function PriceDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const savePackage = trpc.settings.pricing.savePackage.useMutation();
  const saveAddon = trpc.settings.pricing.saveAddon.useMutation();
  const remove = trpc.settings.pricing.remove.useMutation();
  const busy = savePackage.isPending || saveAddon.isPending || remove.isPending;

  const item = editing?.item ?? null;
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [filingStatus, setFilingStatus] = React.useState<Pkg["filingStatus"]>("single");
  const [price, setPrice] = React.useState("");
  const [included, setIncluded] = React.useState(false);
  const [appliesWhen, setAppliesWhen] = React.useState<string>(MANUAL);
  const [errors, setErrors] = React.useState<{ name?: string; price?: string }>({});
  const [error, setError] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  React.useEffect(() => {
    if (!editing) return;
    const it = editing.item;
    setName(it?.name ?? "");
    setDescription(it?.description ?? "");
    setFilingStatus(editing.kind === "package" && editing.item ? editing.item.filingStatus : "single");
    setPrice(it?.unitAmountCents != null ? toDollars(it.unitAmountCents) : "");
    setIncluded(editing.kind === "addon" && !!editing.item && editing.item.unitAmountCents === null);
    setAppliesWhen(editing.kind === "addon" && editing.item?.appliesWhen ? editing.item.appliesWhen : MANUAL);
    setErrors({});
    setError(null);
    setConfirmRemove(false);
  }, [editing]);

  if (!editing) return <Dialog open={false} />;
  const isPackage = editing.kind === "package";
  const noun = isPackage ? "package" : "add-on";

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = `Give the ${noun} a name.`;
    else if (name.trim().length > 80) next.name = "Keep it under 80 characters.";
    if (!(editing.kind === "addon" && included)) {
      const c = toCents(price);
      if (c === null || c < 1) next.price = "Enter a price in dollars, like 225 or 225.00.";
    }
    setErrors(next);
    return !next.name && !next.price;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    try {
      if (editing.kind === "package") {
        await savePackage.mutateAsync({
          code: editing.item?.code,
          filingStatus,
          name: name.trim(),
          description: description.trim(),
          unitAmountCents: toCents(price)!,
          active: editing.item?.active ?? true,
        });
      } else {
        await saveAddon.mutateAsync({
          code: editing.item?.code,
          name: name.trim(),
          description: description.trim(),
          unitAmountCents: included ? null : toCents(price)!,
          appliesWhen: appliesWhen === MANUAL ? null : (appliesWhen as AddonTrigger),
          active: editing.item?.active ?? true,
        });
      }
      await utils.settings.pricing.invalidate();
      toast.success(item ? `${name.trim()} saved` : `${name.trim()} added`);
      onClose();
    } catch (err) {
      setError(serverMessage(err));
    }
  };

  const onRemove = async () => {
    if (!item) return;
    if (!confirmRemove) return setConfirmRemove(true);
    setError(null);
    try {
      const r = await remove.mutateAsync({ code: item.code });
      await utils.settings.pricing.invalidate();
      toast.success(r.outcome === "deleted" ? "Deleted" : "Retired: it's on past invoices");
      onClose();
    } catch (err) {
      setError(serverMessage(err, "It couldn't be removed."));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{item ? `Edit ${item.name}` : `Add ${isPackage ? "a package" : "an add-on"}`}</DialogTitle>
            <DialogDescription>
              {isPackage
                ? "New invoices start from the package that matches the return's filing status."
                : "Invoices already issued keep the price they were issued with."}
            </DialogDescription>
          </DialogHeader>

          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
          <div className="grid gap-1.5">
            <Label htmlFor="price-description">Description</Label>
            <Textarea id="price-description" value={description} maxLength={160} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
            <p className="text-xs text-muted-foreground">One line clients may see on the invoice. Optional.</p>
          </div>

          {isPackage ? (
            <div className="grid gap-1.5">
              <Label htmlFor="price-filing">Filing status</Label>
              <Select value={filingStatus} onValueChange={(v) => setFilingStatus(v as Pkg["filingStatus"])}>
                <SelectTrigger id="price-filing" className="w-full max-md:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {FILING_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Checkbox id="price-included" checked={included} onCheckedChange={(v) => setIncluded(v === true)} />
                <Label htmlFor="price-included">Included, no charge</Label>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="price-applies">Applies when</Label>
                <Select value={appliesWhen} onValueChange={setAppliesWhen}>
                  <SelectTrigger id="price-applies" className="w-full max-md:h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MANUAL}>I pick it by hand</SelectItem>
                    {(Object.keys(TRIGGER_LABEL) as AddonTrigger[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TRIGGER_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Suggested on a new invoice when the intake says so.</p>
              </div>
            </>
          )}

          {isPackage || !included ? (
            <Field label="Price" inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} hint="In dollars." />
          ) : null}

          {confirmRemove && item ? (
            <Banner tone="warning" title={`Remove ${item.name}?`}>
              Never used: it's deleted. On any past invoice: it's retired and hidden, and those invoices still read the same.
            </Banner>
          ) : null}
          {error ? <Banner tone="danger" title="Not saved">{error}</Banner> : null}

          <DialogFooter className="sm:justify-between">
            {item ? (
              <Button type="button" variant="ghost" className="text-danger-foreground" onClick={onRemove} disabled={busy}>
                {confirmRemove ? "Yes, remove" : "Remove"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {item ? "Save changes" : `Add ${noun}`}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
