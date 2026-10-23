import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { InvoiceScreen, ReceiptView } from "@app/ui/components/invoice";

import { usePageTitle, useReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The invoice (portal 17 unpaid, 18 failed, 19 paid, 20 receipt; desktop 24): the newest issued invoice for this
// return, a failed payment above it when there is one, and any other invoices underneath. The screen is InvoiceScreen
// from the design system; this fetches, opens checkout and the receipt.

function Receipt({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const q = trpc.invoice.receipt.useQuery({ invoiceId });
  return <ReceiptView receipt={q.error ? undefined : q.data} loading={q.isLoading} open onOpenChange={(o) => !o && onClose()} onDownload={() => window.print()} />;
}

export default function Invoice() {
  usePageTitle("Invoice");
  const { current, loading } = useReturn();
  const id = current?.engagementId;
  const q = trpc.invoice.list.useQuery({ engagementId: id! }, { enabled: !!id });
  const practice = trpc.practice.public.useQuery(undefined, { staleTime: Infinity }).data;
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [receiptFor, setReceiptFor] = React.useState<string | null>(null);
  // Back from Stripe's checkout (?paid=1): the webhook may land a moment after the redirect, so look again briefly.
  const [params, setParams] = useSearchParams();
  const back = params.get("paid") === "1";
  const online = trpc.payment.online.useQuery(undefined, { staleTime: Infinity }).data?.enabled ?? false;
  const checkout = trpc.payment.checkout.useMutation({
    onSuccess: ({ url }) => location.assign(url),
    onError: (e) => toast.error(e.message),
  });
  const settled = (q.data ?? []).every((i) => i.status !== "issued" || i.balanceCents === 0);
  React.useEffect(() => {
    if (!back || settled) return;
    const t = setInterval(() => q.refetch(), 2000);
    const stop = setTimeout(() => clearInterval(t), 30_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [back, settled, q]);

  const invoices = q.data ?? [];
  const newestIssued = [...invoices].reverse().find((i) => i.status === "issued") ?? invoices.at(-1); // oldest first
  const shown = invoices.find((i) => i.id === chosen) ?? newestIssued;
  const others = invoices.filter((i) => i.id !== shown?.id).reverse();

  return (
    <InvoiceScreen
      loading={loading || q.isLoading}
      error={!!q.error}
      invoice={shown}
      others={others}
      preparer={practice?.preparerName ?? "your preparer"}
      replyTo={practice?.replyToEmail ?? "your preparer"}
      returnedFromCheckout={back}
      onDismissReturn={() => setParams({}, { replace: true })}
      onChoose={setChosen}
      onReceipt={setReceiptFor}
      onPay={online ? (invoiceId) => checkout.mutate({ invoiceId }) : undefined}
      paying={checkout.isPending || checkout.isSuccess}
      receipt={receiptFor ? <Receipt invoiceId={receiptFor} onClose={() => setReceiptFor(null)} /> : null}
    />
  );
}
