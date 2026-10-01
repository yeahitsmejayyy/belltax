import { Download, Mail } from "lucide-react";
import type * as React from "react";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@app/ui/components/dialog";
import { ShieldMark } from "@app/ui/components/logo";
import { Money } from "@app/ui/components/money";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@app/ui/components/sheet";
import { Skeleton } from "@app/ui/components/skeleton";
import { InvoiceChip } from "@app/ui/components/status-chip";
import { useIsMobile } from "@app/ui/components/use-mobile";
import { cn } from "@app/ui/utils";

import { trpc, type RouterOutputs } from "@/lib/trpc";

import { METHOD, paidWhen } from "./words";

// The receipt (portal 20): a branded preview in a bottom sheet on a phone, a dialog on a desktop. "Download PDF"
// prints it; the print styles hide everything else on the page, so only the receipt reaches the paper.

type Receipt = RouterOutputs["invoice"]["receipt"];

// While this is open and printing: hide the app and the dim overlay, and let the sheet/dialog flow as a page.
const PRINT_ONLY_THIS =
  "print:[body:has(&)_#root]:hidden print:[body:has(&)_[data-slot$=overlay]]:hidden print:static print:inset-auto print:max-h-none print:w-auto print:max-w-none print:translate-none print:animate-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none print:[&>button]:hidden";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export function ReceiptDocument({ r }: { r: Receipt }) {
  const latest = r.payments[0];
  const p = r.practice;
  return (
    <article aria-label={`Receipt ${r.receiptNumber}`} className="grid gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldMark className="h-10" />
          <div className="grid">
            <span className="text-lg font-bold tracking-tight">{p.practiceName}</span>
            <span className="text-sm text-muted-foreground">
              {p.preparerName} · {p.preparerCredential ?? "Tax preparer"}
            </span>
          </div>
        </div>
        <InvoiceChip status={r.settlement} />
      </header>

      {latest ? (
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Amount paid</p>
          <Money cents={latest.amountCents} className="text-4xl font-semibold tracking-tight" />
          <p className="text-sm text-muted-foreground">{paidWhen(latest)}</p>
        </div>
      ) : null}

      <dl className="grid gap-3 border-b pb-6 text-sm">
        <Row label="Receipt">{r.receiptNumber}</Row>
        <Row label="Invoice">{r.invoiceNumber}</Row>
        <Row label="Billed to">{r.billedTo}</Row>
        {latest ? <Row label="Paid with">{METHOD[latest.method]}</Row> : null}
        {latest ? <Row label="Processed by">{latest.processedBy === "stripe" ? "Stripe" : `Recorded by ${p.preparerName}`}</Row> : null}
      </dl>

      <section className="grid gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Services · Tax year {r.taxYear}</h3>
        <ul className="grid gap-3">
          {r.lines.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-4">
              <span className="text-pretty">
                {l.description}
                {l.quantity > 1 ? <span className="text-muted-foreground"> × {l.quantity}</span> : null}
              </span>
              <Money cents={l.amountCents} />
            </li>
          ))}
          {r.included.map((name) => (
            <li key={name} className="flex items-start justify-between gap-4">
              <span className="text-pretty">{name}</span>
              <span className="text-muted-foreground">Included</span>
            </li>
          ))}
        </ul>
      </section>

      {r.payments.length > 1 ? (
        <section className="grid gap-3 border-t pt-6">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Payments</h3>
          <ul className="grid gap-3 text-sm">
            {r.payments.map((x) => (
              <li key={x.id} className="flex items-start justify-between gap-4">
                <span>
                  {paidWhen(x)} · {METHOD[x.method]}
                </span>
                <Money cents={x.amountCents} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl className="grid gap-3 border-t pt-6">
        <Row label="Subtotal">
          <Money cents={r.totalCents} className="text-muted-foreground" />
        </Row>
        <div className="flex items-start justify-between gap-4 text-lg font-semibold">
          <dt>Total paid</dt>
          <dd>
            <Money cents={r.paidCents} />
          </dd>
        </div>
        {r.balanceCents > 0 ? (
          <Row label="Balance due">
            <Money cents={r.balanceCents} />
          </Row>
        ) : null}
      </dl>

      <footer className="grid gap-1 border-t pt-6 text-xs text-muted-foreground">
        <p>Questions about this receipt? Reply to {p.replyToEmail}.</p>
        <p>
          {p.practiceName}
          {p.city ? ` · ${p.city}${p.state ? `, ${p.state}` : ""}` : ""}
        </p>
      </footer>
    </article>
  );
}

function Body({ invoiceId }: { invoiceId: string }) {
  const q = trpc.invoice.receipt.useQuery({ invoiceId });
  if (q.isLoading) return <Skeleton aria-label="Loading the receipt" className="h-[28rem] rounded-xl" />;
  if (q.error || !q.data)
    return (
      <Banner tone="danger" title="The receipt didn't load">
        Check your connection and open it again.
      </Banner>
    );
  return <ReceiptDocument r={q.data} />;
}

function Actions({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-2 border-t bg-background p-4 print:hidden", className)}>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="touch" disabled aria-describedby="receipt-email-later">
          <Mail aria-hidden="true" /> Email me a copy
        </Button>
        <Button size="touch" onClick={() => window.print()}>
          <Download aria-hidden="true" /> Download PDF
        </Button>
      </div>
      <p id="receipt-email-later" className="text-xs text-muted-foreground">
        Emailing a copy arrives soon. For now, download it and save or print the PDF.
      </p>
    </div>
  );
}

export function ReceiptView({ invoiceId, open, onOpenChange }: { invoiceId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const phone = useIsMobile();
  const body = (
    <div className="overflow-y-auto bg-muted p-4 md:p-6 print:overflow-visible print:bg-transparent print:p-0">
      <Body invoiceId={invoiceId} />
    </div>
  );
  const description = "Your receipt for this invoice. Download it as a PDF to keep.";

  if (phone)
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className={cn("max-h-[92svh] gap-0 rounded-t-xl p-0", PRINT_ONLY_THIS)}>
          <div className="border-b px-4 py-4 print:hidden">
            <SheetTitle className="text-lg">Receipt</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
          </div>
          {body}
          <Actions />
        </SheetContent>
      </Sheet>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg", PRINT_ONLY_THIS)}>
        <div className="border-b px-6 py-4 print:hidden">
          <DialogTitle>Receipt</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </div>
        {body}
        <Actions />
      </DialogContent>
    </Dialog>
  );
}
