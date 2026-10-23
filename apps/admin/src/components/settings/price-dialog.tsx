import * as React from "react";
import { toast } from "sonner";

import { PriceDialog, type PriceEditing, type PriceSave } from "@app/ui/components/pricing-settings";

import { FILING_LABEL } from "@/lib/labels";
import { trpc } from "@/lib/trpc";

import { serverMessage } from "./server-error";

// Add or edit a package or an add-on (admin 32-settings-settings-pricing, the pencil). Remove deletes a price
// nobody has used, and retires one that's on past invoices so what was charged still reads. The dialog is the design
// system's; this saves, toasts and refetches.
export function EditPriceDialog({ editing, onClose }: { editing: PriceEditing | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const savePackage = trpc.settings.pricing.savePackage.useMutation();
  const saveAddon = trpc.settings.pricing.saveAddon.useMutation();
  const remove = trpc.settings.pricing.remove.useMutation();
  const busy = savePackage.isPending || saveAddon.isPending || remove.isPending;
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (editing) setError(null);
  }, [editing]);

  const onSave = async (price: PriceSave) => {
    try {
      if (price.kind === "package") {
        const { kind: _, ...input } = price;
        await savePackage.mutateAsync(input);
      } else {
        const { kind: _, ...input } = price;
        await saveAddon.mutateAsync(input);
      }
      await utils.settings.pricing.invalidate();
      toast.success(editing?.item ? `${price.name} saved` : `${price.name} added`);
      onClose();
    } catch (err) {
      setError(serverMessage(err));
    }
  };

  const onRemove = async (code: string) => {
    try {
      const r = await remove.mutateAsync({ code });
      await utils.settings.pricing.invalidate();
      toast.success(r.outcome === "deleted" ? "Deleted" : "Retired: it's on past invoices");
      onClose();
    } catch (err) {
      setError(serverMessage(err, "It couldn't be removed."));
    }
  };

  return (
    <PriceDialog
      editing={editing}
      busy={busy}
      error={error}
      filingLabels={FILING_LABEL}
      onSave={(p) => void onSave(p)}
      onRemove={(item) => void onRemove(item.code)}
      onClose={onClose}
      onClearError={() => setError(null)}
    />
  );
}
