import * as React from "react";
import { toast } from "sonner";

import { BillingTab as BillingTabView, type BillingInvoice, type BillingPayment } from "@app/ui/components/return-billing";
import { formatDate, formatDateTime } from "@app/ui/format";

import { trpc } from "@/lib/trpc";

import { RecordPaymentDialog, VoidInvoiceDialog } from "./billing-dialogs";
import { dayIso, errorText, type Detail, type Invoice } from "./shared";

// Billing (admin 17-return-detail-return-billing): the design system's BillingTab, fed this return's invoices and
// their payment attempts. The admin keeps sending a draft, the toasts and the two dialogs' state.

const toView = (inv: Invoice): BillingInvoice => ({
  ...inv,
  due: inv.dueOn ? formatDate(dayIso(inv.dueOn), { month: "short", day: "numeric" }) : null,
});

export function BillingTab({ d, onCreate }: { d: Detail; onCreate: () => void }) {
  const [paying, setPaying] = React.useState<Invoice | null>(null);
  const [voiding, setVoiding] = React.useState<Invoice | null>(null);
  const utils = trpc.useUtils();
  const issue = trpc.invoice.issue.useMutation();
  const invoices = d.invoices.map(toView);
  const payments: BillingPayment[] = d.invoices
    .flatMap((i) => i.payments)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({ ...p, when: p.receivedOn && p.provider === "manual" ? formatDate(dayIso(p.receivedOn)) : formatDateTime(p.createdAt) }));

  const send = async (inv: BillingInvoice) => {
    try {
      await issue.mutateAsync({ invoiceId: inv.id });
      await utils.invalidate();
      toast.success(`${inv.number} sent to the client`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const sourceOf = (inv: BillingInvoice) => d.invoices.find((i) => i.id === inv.id) ?? null;

  return (
    <BillingTabView
      invoices={invoices}
      payments={payments}
      onCreate={onCreate}
      onSend={send}
      sendingId={issue.isPending ? (issue.variables?.invoiceId ?? null) : null}
      onPay={(inv) => setPaying(sourceOf(inv))}
      onVoid={(inv) => setVoiding(sourceOf(inv))}
    >
      <RecordPaymentDialog invoice={paying} onClose={() => setPaying(null)} />
      <VoidInvoiceDialog invoice={voiding} onClose={() => setVoiding(null)} />
    </BillingTabView>
  );
}
