import { ChevronRight, ReceiptText } from "lucide-react";
import * as React from "react";

import { Banner } from "@app/ui/components/banner";
import { EmptyState } from "@app/ui/components/empty-state";
import { Money } from "@app/ui/components/money";
import { Skeleton } from "@app/ui/components/skeleton";
import { InvoiceChip } from "@app/ui/components/status-chip";

import { InvoiceCard } from "@/components/invoice/invoice-card";
import { PaymentFailed } from "@/components/invoice/payment-failed";
import { ReceiptView } from "@/components/invoice/receipt";
import { usePageTitle, useReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The invoice (portal 17 unpaid, 18 failed, 19 paid, 20 receipt; desktop 24): the newest issued invoice for this
// return, a failed payment above it when there is one, and any other invoices underneath.
export default function Invoice() {
  usePageTitle("Invoice");
  const { current, loading } = useReturn();
  const id = current?.engagementId;
  const q = trpc.invoice.list.useQuery({ engagementId: id! }, { enabled: !!id });
  const practice = trpc.practice.public.useQuery(undefined, { staleTime: Infinity }).data;
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [receiptFor, setReceiptFor] = React.useState<string | null>(null);

  const invoices = q.data ?? [];
  const newestIssued = [...invoices].reverse().find((i) => i.status === "issued") ?? invoices.at(-1); // oldest first
  const shown = invoices.find((i) => i.id === chosen) ?? newestIssued;
  const others = invoices.filter((i) => i.id !== shown?.id).reverse();
  const preparer = practice?.preparerName ?? "your preparer";
  const lastPayment = shown?.payments[0];

  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-1 content-start gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Invoice</h1>

      {loading || q.isLoading ? (
        <Skeleton aria-label="Loading your invoice" className="h-96 rounded-xl" />
      ) : q.error ? (
        <Banner tone="danger" title="Your invoice didn't load">
          Check your connection and refresh the page.
        </Banner>
      ) : !shown ? (
        <EmptyState
          icon={ReceiptText}
          title="No invoice yet"
          description={`${preparer} sends the invoice once your return is ready. It'll be here, with what it covers and how to pay.`}
        />
      ) : (
        <>
          {shown.settlement === "failed_last_attempt" && lastPayment?.status === "failed" ? (
            <PaymentFailed payment={lastPayment} preparer={preparer} replyTo={practice?.replyToEmail ?? "your preparer"} />
          ) : null}
          <InvoiceCard invoice={shown} preparer={preparer} onReceipt={() => setReceiptFor(shown.id)} />
        </>
      )}

      {others.length ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Other invoices</h2>
          <ul className="grid divide-y rounded-xl border bg-card">
            {others.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setChosen(i.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate font-medium">Invoice {i.number}</span>
                    <InvoiceChip status={i.settlement} />
                  </span>
                  <Money cents={i.totalCents} />
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {receiptFor ? <ReceiptView invoiceId={receiptFor} open onOpenChange={(o) => !o && setReceiptFor(null)} /> : null}
    </div>
  );
}
