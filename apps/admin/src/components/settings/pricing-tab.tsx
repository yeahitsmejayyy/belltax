import * as React from "react";
import { toast } from "sonner";

import { PricingSettings, type PriceAddon, type PriceEditing, type PricePackage } from "@app/ui/components/pricing-settings";

import { FILING_LABEL } from "@/lib/labels";
import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";

import { EditPriceDialog } from "./price-dialog";
import { serverMessage } from "./server-error";

// Settings › Services & pricing (admin 32-settings-settings-pricing): packages and add-ons, how many of this
// year's returns used each, and the Active switch. Issued invoices keep their own copies of the amounts.
export function PricingTab() {
  const { taxYear } = useTaxYear();
  const q = trpc.settings.pricing.list.useQuery(taxYear ? { taxYear } : undefined);
  const utils = trpc.useUtils();
  const savePackage = trpc.settings.pricing.savePackage.useMutation();
  const saveAddon = trpc.settings.pricing.saveAddon.useMutation();
  const [editing, setEditing] = React.useState<PriceEditing | null>(null);

  const toggle = async (kind: "package" | "addon", item: PricePackage | PriceAddon, active: boolean) => {
    try {
      if (kind === "package") {
        const p = item as PricePackage;
        await savePackage.mutateAsync({ code: p.code, filingStatus: p.filingStatus, name: p.name, description: p.description, unitAmountCents: p.unitAmountCents, active });
      } else {
        const a = item as PriceAddon;
        await saveAddon.mutateAsync({ code: a.code, name: a.name, description: a.description, unitAmountCents: a.unitAmountCents, appliesWhen: a.appliesWhen, active });
      }
      await utils.settings.pricing.invalidate();
      toast.success(`${item.name} ${active ? "is active" : "is off for new invoices"}`);
    } catch (e) {
      toast.error(serverMessage(e));
    }
  };

  return (
    <PricingSettings
      packages={q.data?.packages}
      addons={q.data?.addons}
      loadError={q.error?.message}
      filingLabels={FILING_LABEL}
      onToggle={(kind, item, active) => void toggle(kind, item, active)}
      onEdit={setEditing}
    >
      <EditPriceDialog editing={editing} onClose={() => setEditing(null)} />
    </PricingSettings>
  );
}
