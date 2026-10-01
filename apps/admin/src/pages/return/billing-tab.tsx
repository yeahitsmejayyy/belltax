import { Ban, Banknote, Plus, ReceiptText, Send } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent } from "@app/ui/components/card";
import { EmptyState } from "@app/ui/components/empty-state";
import { Money } from "@app/ui/components/money";
import { InvoiceChip, PaymentChip } from "@app/ui/components/status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@app/ui/components/table";
import { formatDate, formatDateTime } from "@app/ui/format";
import { cn } from "@app/ui/utils";

import { trpc } from "@/lib/trpc";

import { RecordPaymentDialog, VoidInvoiceDialog } from "./billing-dialogs";
import { dayIso, errorText, type Detail, type Invoice } from "./shared";

// Billing (admin 17-return-detail-return-billing): each invoice with its lines and what it includes, what's been
// paid, and every payment attempt. A failed latest attempt leads the tab.

type Payment = Invoice["payments"][number];
const METHOD: Record<NonNullable<Payment["method"]>, string> = { cash: "Cash", check: "Check", zelle: "Zelle", other: "Other" };
const methodOf = (p: Payment) => (p.provider === "stripe" ? "Card · Stripe" : p.method ? METHOD[p.method] : "Recorded by hand");

function InvoiceCard({ inv, onPay, onVoid }: { inv: Invoice; onPay: () => void; onVoid: () => void }) {
  const utils = trpc.useUtils();
  const issue = trpc.invoice.issue.useMutation();
  const send = async () => {
    try {
      await issue.mutateAsync({ invoiceId: inv.id });
      await utils.invalidate();
      toast.success(`${inv.number} sent to the client`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const received = inv.payments.some((p) => p.status === "succeeded");

  return (
    <Card className={cn(inv.status === "void" && "opacity-70")}>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{inv.number}</span>
              <InvoiceChip status={inv.settlement} />
            </div>
            <span className="text-sm text-muted-foreground">
              {inv.status === "draft" ? "Draft, not sent yet" : inv.status === "void" ? "Void" : "Sent"}
              {inv.dueOn ? ` · due ${formatDate(dayIso(inv.dueOn), { month: "short", day: "numeric" })}` : ""}
            </span>
          </div>
          <Money cents={inv.totalCents} className="text-2xl font-semibold" />
        </div>

        <ul className="grid gap-2 text-sm">
          {inv.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>
                {l.description}
                {l.quantity > 1 ? <span className="text-muted-foreground"> × {l.quantity}</span> : null}
              </span>
              <Money cents={l.quantity * l.unitAmountCents} />
            </li>
          ))}
          {inv.included.map((name) => (
            <li key={name} className="flex justify-between gap-4 text-muted-foreground">
              <span>{name}</span>
              <span>Included</span>
            </li>
          ))}
        </ul>

        {inv.status === "issued" ? (
          <dl className="grid gap-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Paid</dt>
              <dd>
                <Money cents={inv.paidCents} />
              </dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Balance</dt>
              <dd>
                <Money cents={inv.balanceCents} />
              </dd>
            </div>
          </dl>
        ) : null}

        {inv.status !== "void" ? (
          <div className="flex flex-wrap gap-2">
            {inv.status === "draft" ? (
              <Button variant="outline" size="sm" className="max-md:h-11" disabled={issue.isPending} onClick={send}>
                <Send /> Send to client
              </Button>
            ) : null}
            {inv.status === "issued" && inv.balanceCents > 0 ? (
              <Button variant="outline" size="sm" className="max-md:h-11" onClick={onPay}>
                <Banknote /> Record payment…
              </Button>
            ) : null}
            {!received ? (
              <Button variant="ghost" size="sm" className="max-md:h-11" onClick={onVoid}>
                <Ban /> Void…
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BillingTab({ d, onCreate }: { d: Detail; onCreate: () => void }) {
  const [paying, setPaying] = React.useState<Invoice | null>(null);
  const [voiding, setVoiding] = React.useState<Invoice | null>(null);
  const failed = d.invoices.some((i) => i.settlement === "failed_last_attempt");
  const payments = d.invoices
    .flatMap((i) => i.payments.map((p) => ({ ...p, number: i.number })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Invoices</h2>
        <Button variant="outline" className="max-md:h-11" onClick={onCreate}>
          <Plus /> Create invoice
        </Button>
      </div>

      {failed ? <Banner tone="danger" title="The latest payment attempt failed.">The client sees a retry screen in the portal and can use a different card.</Banner> : null}

      {d.invoices.length ? (
        d.invoices.map((inv) => <InvoiceCard key={inv.id} inv={inv} onPay={() => setPaying(inv)} onVoid={() => setVoiding(inv)} />)
      ) : (
        <EmptyState icon={ReceiptText} title="No invoice yet" description="Create one from this return's package and add-ons." />
      )}

      {payments.length ? (
        <>
          <h2 className="pt-2 text-base font-semibold">Payment attempts</h2>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.receivedOn && p.provider === "manual" ? formatDate(dayIso(p.receivedOn)) : formatDateTime(p.createdAt)}</TableCell>
                    <TableCell>{methodOf(p)}</TableCell>
                    <TableCell>
                      <Money cents={p.amountCents} />
                    </TableCell>
                    <TableCell>
                      <PaymentChip status={p.status} />
                    </TableCell>
                    <TableCell className={cn("whitespace-normal", p.failureMessage ? "text-danger-foreground" : "text-muted-foreground")}>
                      {p.failureMessage ?? p.note ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      <RecordPaymentDialog invoice={paying} onClose={() => setPaying(null)} />
      <VoidInvoiceDialog invoice={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}
