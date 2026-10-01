import { CircleDashed, Lock, ReceiptText } from "lucide-react";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent } from "@app/ui/components/card";
import { Money } from "@app/ui/components/money";
import { InvoiceChip, PaymentChip, StatusChip } from "@app/ui/components/status-chip";
import { formatCents } from "@app/ui/format";

import { longDay, longDateTime, paymentMethod, type ClientInvoice, type ClientPayment } from "./words";

// One invoice as the client sees it (portal 17 unpaid, 18 failed, 19 paid; desktop 24): the amount, what it
// covers, then the one thing to do. Paying online stays off until Stripe (ticket 09), and says why.

const paidOn = (p: ClientPayment) => (p.receivedOn ? longDay(p.receivedOn) : longDateTime(p.createdAt));
const today = () => new Date().toISOString().slice(0, 10);

function DueChip({ invoice }: { invoice: ClientInvoice }) {
  const s = invoice.settlement;
  if (s === "paid" || s === "partial" || s === "failed_last_attempt" || s === "void") return <InvoiceChip status={s} />;
  if (invoice.dueOn && invoice.dueOn < today()) return <StatusChip tone="warning" icon={CircleDashed} label={`Overdue since ${longDay(invoice.dueOn)}`} />;
  return <StatusChip tone="neutral" icon={CircleDashed} label={invoice.dueOn ? `Due ${longDay(invoice.dueOn)}` : "Due before filing"} />;
}

export function InvoiceCard({ invoice, preparer, onReceipt }: { invoice: ClientInvoice; preparer: string; onReceipt: () => void }) {
  const owes = invoice.status === "issued" && invoice.balanceCents > 0;
  const paid = invoice.payments.filter((p) => p.status === "succeeded" || p.status === "refunded");
  const hasReceipt = invoice.paidCents > 0;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-6 p-6">
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Invoice {invoice.number}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Money cents={invoice.totalCents} className="text-4xl font-semibold tracking-tight" />
            <DueChip invoice={invoice} />
          </div>
        </div>

        <div className="grid gap-3">
          <h2 className="text-sm text-muted-foreground">What it covers</h2>
          <ul className="grid gap-3">
            {invoice.lines.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-4">
                <span className="text-pretty">
                  {l.description}
                  {l.quantity > 1 ? <span className="text-muted-foreground"> × {l.quantity}</span> : null}
                </span>
                <Money cents={l.quantity * l.unitAmountCents} />
              </li>
            ))}
            {invoice.included.map((name) => (
              <li key={name} className="flex items-start justify-between gap-4">
                <span className="text-pretty">{name}</span>
                <span className="text-muted-foreground">Included</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t pt-3 font-semibold">
            <span>Total</span>
            <Money cents={invoice.totalCents} />
          </div>
        </div>

        {invoice.settlement === "paid" && paid.length === 1 ? (
          <Banner tone="success" title={`Paid ${paidOn(paid[0]!)} with ${paymentMethod(paid[0]!).toLowerCase()}.`} />
        ) : paid.length ? (
          <div className="grid gap-3">
            <h2 className="text-sm text-muted-foreground">Payments</h2>
            <ul className="grid gap-3">
              {paid.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4">
                  <span className="grid gap-1">
                    <span>{paymentMethod(p)}</span>
                    <span className="text-sm text-muted-foreground">{paidOn(p)}</span>
                  </span>
                  <span className="grid justify-items-end gap-1">
                    <Money cents={p.amountCents} />
                    {p.status === "refunded" ? <PaymentChip status="refunded" /> : null}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-4 border-t pt-3 font-semibold">
              <span>{owes ? "Still to pay" : "Balance"}</span>
              <Money cents={invoice.balanceCents} />
            </div>
          </div>
        ) : null}

        {owes ? (
          <div className="grid gap-3">
            <Button size="touch" disabled aria-describedby={`pay-later-${invoice.id}`}>
              Pay {formatCents(invoice.balanceCents)}
            </Button>
            <p id={`pay-later-${invoice.id}`} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Online payment opens soon. You can also pay {preparer} by Zelle, check or cash.
            </p>
          </div>
        ) : null}

        {hasReceipt ? (
          <Button variant="outline" size="touch" onClick={onReceipt}>
            <ReceiptText aria-hidden="true" /> View receipt
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
