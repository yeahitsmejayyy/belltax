import * as React from "react";
import { toast } from "sonner";

import { CreateInvoiceDialog, type InvoiceDraft } from "@app/ui/components/create-invoice-dialog";

import { trpc } from "@/lib/trpc";

import { errorText, type Detail } from "./shared";

// Create invoice (admin 23-dialogs-and-sheets-dlg-invoice): the design system's CreateInvoiceDialog, priced from
// settings.pricing.list and pre-ticked from invoice.suggest. Create and send issues it straight away.

const DUE_DAYS = 14;

function dueOn() {
  const d = new Date(Date.now() + DUE_DAYS * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InvoiceDialog({ d, name, open, onOpenChange }: { d: Detail; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const pricing = trpc.settings.pricing.list.useQuery({ taxYear: d.taxYear }, { enabled: open });
  const suggestion = trpc.invoice.suggest.useQuery({ engagementId: d.engagementId }, { enabled: open });
  const failed = pricing.error ?? suggestion.error;
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const create = trpc.invoice.create.useMutation();
  const issue = trpc.invoice.issue.useMutation();
  const close = () => onOpenChange(false);

  const submit = async ({ lines, included }: InvoiceDraft) => {
    setError(null);
    try {
      const inv = await create.mutateAsync({ engagementId: d.engagementId, lines, included, dueOn: dueOn() });
      try {
        await issue.mutateAsync({ invoiceId: inv.id });
        toast.success(`${inv.number} sent to ${name}`);
        close();
      } catch (e) {
        setError(`${inv.number} was created as a draft but not sent: ${errorText(e)}`);
      }
      await utils.invalidate();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <CreateInvoiceDialog
      open={open}
      onOpenChange={(o) => {
        // A closed dialog forgets its last failure, as its form does.
        if (!o) setError(null);
        onOpenChange(o);
      }}
      name={name}
      pricing={pricing.data ?? null}
      suggestion={suggestion.data ?? null}
      loadError={failed?.message ?? null}
      formKey={String(pricing.dataUpdatedAt)}
      onSubmit={submit}
      busy={create.isPending || issue.isPending}
      error={error}
      dueDays={DUE_DAYS}
    />
  );
}
