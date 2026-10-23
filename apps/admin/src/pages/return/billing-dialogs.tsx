import * as React from "react";
import { toast } from "sonner";

import {
  RecordPaymentDialog as RecordPaymentDialogView,
  VoidInvoiceDialog as VoidInvoiceDialogView,
  type RecordedPayment,
} from "@app/ui/components/return-billing";
import { formatCents } from "@app/ui/format";

import { trpc } from "@/lib/trpc";

import { errorText, todayIso, type Invoice } from "./shared";

// Money received outside the portal (cash, a check, Zelle), and voiding an invoice: the design system's dialogs,
// wired to payment.record and invoice.void. Both are logged.

type Method = "cash" | "check" | "zelle" | "other";

export function RecordPaymentDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const record = trpc.payment.record.useMutation();
  // A new invoice starts with no error, as a fresh form does.
  const [shownFor, setShownFor] = React.useState(invoice?.id);
  if (shownFor !== invoice?.id) {
    setShownFor(invoice?.id);
    setError(null);
  }

  const submit = async (p: RecordedPayment<Method>) => {
    if (!invoice) return;
    setError(null);
    try {
      await record.mutateAsync({ invoiceId: invoice.id, ...p });
      await utils.invalidate();
      toast.success(`${formatCents(p.amountCents)} recorded on ${invoice.number}`);
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return <RecordPaymentDialogView<Method> invoice={invoice} onRecord={submit} onClose={onClose} busy={record.isPending} error={error} today={todayIso()} />;
}

export function VoidInvoiceDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const voidInvoice = trpc.invoice.void.useMutation();
  const [shownFor, setShownFor] = React.useState(invoice?.id);
  if (shownFor !== invoice?.id) {
    setShownFor(invoice?.id);
    setError(null);
  }

  const submit = async (reason: string) => {
    if (!invoice) return;
    setError(null);
    try {
      await voidInvoice.mutateAsync({ invoiceId: invoice.id, reason });
      await utils.invalidate();
      toast.success(`${invoice.number} voided`);
      onClose();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return <VoidInvoiceDialogView invoice={invoice} onVoid={submit} onClose={onClose} busy={voidInvoice.isPending} error={error} />;
}
