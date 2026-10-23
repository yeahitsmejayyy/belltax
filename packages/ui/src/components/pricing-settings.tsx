import type { AddonTrigger } from "@app/schema";
import { Pencil, Plus } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Banner } from "./banner";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { DataTable, type ColumnDef } from "./data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Field } from "./field";
import { Label } from "./label";
import { Money } from "./money";
import { SectionHeader } from "./page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Skeleton } from "./skeleton";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

// Settings › Services & pricing (admin 32-settings-settings-pricing): packages and add-ons, how many of this year's
// returns used each, the Active switch, and the dialog behind the pencil. Presentational: the lists come in as props,
// edits go out through callbacks; the admin saves, toasts and refetches.

/** The filing statuses a package can be for, in the order the dialog offers them. */
export const PACKAGE_STATUSES = ["single", "mfj", "mfs", "hoh"] as const;
export type PackageFilingStatus = (typeof PACKAGE_STATUSES)[number];

export type PricePackage = {
  code: string;
  filingStatus: PackageFilingStatus;
  name: string;
  description: string;
  unitAmountCents: number;
  active: boolean;
  /** How many of this year's returns used it. */
  usedThisYear: number;
};
export type PriceAddon = {
  code: string;
  name: string;
  description: string;
  /** Null when it's included at no charge. */
  unitAmountCents: number | null;
  appliesWhen: AddonTrigger | null;
  active: boolean;
  usedThisYear: number;
};
/** What the dialog is editing: a package or an add-on, or a new one of either (`item: null`). */
export type PriceEditing = { kind: "package"; item: PricePackage | null } | { kind: "addon"; item: PriceAddon | null };
/** What Save sends: the whole price, ready to store. `code` is missing for a new one. */
export type PriceSave =
  | { kind: "package"; code?: string; filingStatus: PackageFilingStatus; name: string; description: string; unitAmountCents: number; active: boolean }
  | { kind: "addon"; code?: string; name: string; description: string; unitAmountCents: number | null; appliesWhen: AddonTrigger | null; active: boolean };

/** What each filing status is called. */
export const PACKAGE_FILING_LABEL: Record<PackageFilingStatus, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  mfs: "Married filing separately",
  hoh: "Head of household",
};
/** What the intake has to say for an add-on to be suggested. */
export const TRIGGER_LABEL: Record<AddonTrigger, string> = {
  self_employment: "Self-employment income",
  rental: "Rental property",
  investments: "Investments",
  ihss: "IHSS home care income",
  covered_california: "Covered California",
  other_state: "Another state's return",
  amended: "Amended return",
};

const returns = (n: number) => `${n} ${n === 1 ? "return" : "returns"}`;

function NameCell({ name, description, active }: { name: string; description: string; active: boolean }) {
  return (
    <div className={cn("grid gap-0.5 whitespace-normal", !active && "text-muted-foreground")}>
      <span className="font-medium">
        {name}
        {active ? null : <span className="sr-only"> (inactive)</span>}
      </span>
      {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
    </div>
  );
}

/**
 * The packages and add-ons, each a table with an Add button. Skeletons until both lists arrive; `loadError` instead
 * when they couldn't be read. `children` sits after the tables: the PriceDialog.
 */
export function PricingSettings({
  packages,
  addons,
  loadError,
  filingLabels = PACKAGE_FILING_LABEL,
  onToggle,
  onEdit,
  children,
}: {
  /** Undefined while loading. */
  packages?: PricePackage[];
  addons?: PriceAddon[];
  loadError?: string | null;
  filingLabels?: Record<PackageFilingStatus, string>;
  /** The Active switch flipped. */
  onToggle: (kind: "package" | "addon", item: PricePackage | PriceAddon, active: boolean) => void;
  /** The pencil, or an Add button (`item: null`). */
  onEdit: (editing: PriceEditing) => void;
  children?: React.ReactNode;
}) {
  const activeCell = (kind: "package" | "addon", item: PricePackage | PriceAddon) => (
    <Switch checked={item.active} aria-label={`${item.name} active`} onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => onToggle(kind, item, v)} />
  );
  const editCell = (e: PriceEditing) => (
    <Button variant="ghost" size="icon" aria-label={`Edit ${e.item?.name}`} className="max-md:size-11" onClick={() => onEdit(e)}>
      <Pencil aria-hidden="true" />
    </Button>
  );

  const packageColumns: ColumnDef<PricePackage>[] = [
    { accessorKey: "name", header: "Package", cell: ({ row }) => <NameCell {...row.original} /> },
    { accessorKey: "filingStatus", header: "Filing status", cell: ({ row }) => filingLabels[row.original.filingStatus] },
    { accessorKey: "usedThisYear", header: "This year", cell: ({ row }) => <span className="text-muted-foreground">{returns(row.original.usedThisYear)}</span> },
    { accessorKey: "unitAmountCents", header: () => <span className="block text-right">Price</span>, cell: ({ row }) => <Money cents={row.original.unitAmountCents} className="block text-right font-medium" /> },
    { id: "active", header: "Active", enableSorting: false, cell: ({ row }) => activeCell("package", row.original) },
    { id: "edit", header: () => <span className="sr-only">Edit</span>, enableSorting: false, cell: ({ row }) => editCell({ kind: "package", item: row.original }) },
  ];
  const addonColumns: ColumnDef<PriceAddon>[] = [
    { accessorKey: "name", header: "Add-on", cell: ({ row }) => <NameCell {...row.original} /> },
    { accessorKey: "usedThisYear", header: "This year", cell: ({ row }) => <span className="text-muted-foreground">{returns(row.original.usedThisYear)}</span> },
    {
      accessorKey: "unitAmountCents",
      header: () => <span className="block text-right">Price</span>,
      cell: ({ row }) =>
        row.original.unitAmountCents === null ? (
          <span className="block text-right font-medium">Included</span>
        ) : (
          <Money cents={row.original.unitAmountCents} className="block text-right font-medium" />
        ),
    },
    { id: "active", header: "Active", enableSorting: false, cell: ({ row }) => activeCell("addon", row.original) },
    { id: "edit", header: () => <span className="sr-only">Edit</span>, enableSorting: false, cell: ({ row }) => editCell({ kind: "addon", item: row.original }) },
  ];

  if (loadError) return <Banner tone="danger" title="Couldn't load pricing">{loadError}</Banner>;
  if (!packages || !addons) {
    return (
      <div className="grid max-w-5xl gap-4" aria-busy="true" aria-label="Loading pricing">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="grid max-w-5xl gap-8">
      <section className="grid gap-3">
        <SectionHeader
          title="Packages"
          description="The base fee for one return. New invoices start from the package that matches the filing status."
          action={
            <Button variant="outline" onClick={() => onEdit({ kind: "package", item: null })}>
              <Plus aria-hidden="true" />
              Add package
            </Button>
          }
        />
        <DataTable label="Packages" columns={packageColumns} data={packages} getRowId={(r) => r.code} empty={<span className="text-muted-foreground">No packages yet.</span>} />
      </section>

      <section className="grid gap-3">
        <SectionHeader
          title="Add-ons"
          description="Extra work you charge for on top of a package. Pick them when you create an invoice."
          action={
            <Button variant="outline" onClick={() => onEdit({ kind: "addon", item: null })}>
              <Plus aria-hidden="true" />
              Add add-on
            </Button>
          }
        />
        <DataTable label="Add-ons" columns={addonColumns} data={addons} getRowId={(r) => r.code} empty={<span className="text-muted-foreground">No add-ons yet.</span>} />
      </section>

      {children}
    </div>
  );
}

const MANUAL = "manual";
const toDollars = (cents: number) => (cents / 100).toFixed(2);
function toCents(v: string): number | null {
  const s = v.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/**
 * Add or edit a package or an add-on (the pencil). Checks the name and price itself and calls `onSave` with the whole
 * price only when they pass. Remove asks once more, then calls `onRemove`: the admin deletes a price nobody has used
 * and retires one that's on past invoices. Closed while `editing` is null.
 */
export function PriceDialog({
  editing,
  busy = false,
  error,
  filingLabels = PACKAGE_FILING_LABEL,
  triggerLabels = TRIGGER_LABEL,
  onSave,
  onRemove,
  onClose,
  onClearError,
}: {
  editing: PriceEditing | null;
  /** True while a save or remove is in flight: every button waits, and the dialog won't close. */
  busy?: boolean;
  /** Why the last save or remove failed. */
  error?: string | null;
  filingLabels?: Record<PackageFilingStatus, string>;
  triggerLabels?: Record<AddonTrigger, string>;
  onSave: (price: PriceSave) => void;
  /** Remove, after the second click. */
  onRemove: (item: PricePackage | PriceAddon) => void;
  onClose: () => void;
  /** Clear `error`: called as the form is submitted again, and as a remove is confirmed. */
  onClearError?: () => void;
}) {
  const item = editing?.item ?? null;
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [filingStatus, setFilingStatus] = React.useState<PackageFilingStatus>("single");
  const [price, setPrice] = React.useState("");
  const [included, setIncluded] = React.useState(false);
  const [appliesWhen, setAppliesWhen] = React.useState<string>(MANUAL);
  const [errors, setErrors] = React.useState<{ name?: string; price?: string }>({});
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError?.();
    if (!validate()) return;
    if (editing.kind === "package") {
      onSave({
        kind: "package",
        code: editing.item?.code,
        filingStatus,
        name: name.trim(),
        description: description.trim(),
        unitAmountCents: toCents(price)!,
        active: editing.item?.active ?? true,
      });
    } else {
      onSave({
        kind: "addon",
        code: editing.item?.code,
        name: name.trim(),
        description: description.trim(),
        unitAmountCents: included ? null : toCents(price)!,
        appliesWhen: appliesWhen === MANUAL ? null : (appliesWhen as AddonTrigger),
        active: editing.item?.active ?? true,
      });
    }
  };

  const remove = () => {
    if (!item) return;
    if (!confirmRemove) return setConfirmRemove(true);
    onClearError?.();
    onRemove(item);
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
              <Select value={filingStatus} onValueChange={(v) => setFilingStatus(v as PackageFilingStatus)}>
                <SelectTrigger id="price-filing" className="w-full max-md:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {filingLabels[s]}
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
                    {(Object.keys(triggerLabels) as AddonTrigger[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {triggerLabels[t]}
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
              <Button type="button" variant="ghost" className="text-danger-foreground" onClick={remove} disabled={busy}>
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
