import { Pencil, Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { DataTable, type ColumnDef } from "@app/ui/components/data-table";
import { Money } from "@app/ui/components/money";
import { SectionHeader } from "@app/ui/components/page-header";
import { Skeleton } from "@app/ui/components/skeleton";
import { Switch } from "@app/ui/components/switch";
import { cn } from "@app/ui/utils";

import { FILING_LABEL } from "@/lib/labels";
import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";

import { PriceDialog, type Addon, type Editing, type Pkg } from "./price-dialog";
import { serverMessage } from "./server-error";

// Settings › Services & pricing (admin 32-settings-settings-pricing): packages and add-ons, how many of this
// year's returns used each, and the Active switch. Issued invoices keep their own copies of the amounts.

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

export function PricingTab() {
  const { taxYear } = useTaxYear();
  const q = trpc.settings.pricing.list.useQuery(taxYear ? { taxYear } : undefined);
  const utils = trpc.useUtils();
  const savePackage = trpc.settings.pricing.savePackage.useMutation();
  const saveAddon = trpc.settings.pricing.saveAddon.useMutation();
  const [editing, setEditing] = React.useState<Editing | null>(null);

  const toggle = async (kind: "package" | "addon", item: Pkg | Addon, active: boolean) => {
    try {
      if (kind === "package") {
        const p = item as Pkg;
        await savePackage.mutateAsync({ code: p.code, filingStatus: p.filingStatus, name: p.name, description: p.description, unitAmountCents: p.unitAmountCents, active });
      } else {
        const a = item as Addon;
        await saveAddon.mutateAsync({ code: a.code, name: a.name, description: a.description, unitAmountCents: a.unitAmountCents, appliesWhen: a.appliesWhen, active });
      }
      await utils.settings.pricing.invalidate();
      toast.success(`${item.name} ${active ? "is active" : "is off for new invoices"}`);
    } catch (e) {
      toast.error(serverMessage(e));
    }
  };

  const activeCell = (kind: "package" | "addon", item: Pkg | Addon) => (
    <Switch
      checked={item.active}
      aria-label={`${item.name} active`}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(v) => toggle(kind, item, v)}
    />
  );
  const editCell = (e: Editing) => (
    <Button variant="ghost" size="icon" aria-label={`Edit ${e.item?.name}`} className="max-md:size-11" onClick={() => setEditing(e)}>
      <Pencil aria-hidden="true" />
    </Button>
  );

  const packageColumns: ColumnDef<Pkg>[] = [
    { accessorKey: "name", header: "Package", cell: ({ row }) => <NameCell {...row.original} /> },
    { accessorKey: "filingStatus", header: "Filing status", cell: ({ row }) => FILING_LABEL[row.original.filingStatus] },
    { accessorKey: "usedThisYear", header: "This year", cell: ({ row }) => <span className="text-muted-foreground">{returns(row.original.usedThisYear)}</span> },
    { accessorKey: "unitAmountCents", header: () => <span className="block text-right">Price</span>, cell: ({ row }) => <Money cents={row.original.unitAmountCents} className="block text-right font-medium" /> },
    { id: "active", header: "Active", enableSorting: false, cell: ({ row }) => activeCell("package", row.original) },
    { id: "edit", header: () => <span className="sr-only">Edit</span>, enableSorting: false, cell: ({ row }) => editCell({ kind: "package", item: row.original }) },
  ];
  const addonColumns: ColumnDef<Addon>[] = [
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

  if (q.error) return <Banner tone="danger" title="Couldn't load pricing">{q.error.message}</Banner>;
  if (!q.data) {
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
            <Button variant="outline" onClick={() => setEditing({ kind: "package", item: null })}>
              <Plus aria-hidden="true" />
              Add package
            </Button>
          }
        />
        <DataTable label="Packages" columns={packageColumns} data={q.data.packages} getRowId={(r) => r.code} empty={<span className="text-muted-foreground">No packages yet.</span>} />
      </section>

      <section className="grid gap-3">
        <SectionHeader
          title="Add-ons"
          description="Extra work you charge for on top of a package. Pick them when you create an invoice."
          action={
            <Button variant="outline" onClick={() => setEditing({ kind: "addon", item: null })}>
              <Plus aria-hidden="true" />
              Add add-on
            </Button>
          }
        />
        <DataTable label="Add-ons" columns={addonColumns} data={q.data.addons} getRowId={(r) => r.code} empty={<span className="text-muted-foreground">No add-ons yet.</span>} />
      </section>

      <PriceDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
