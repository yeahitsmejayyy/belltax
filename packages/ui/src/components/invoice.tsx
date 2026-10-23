import type { InvoiceSummary } from "@app/schema";
import { ChevronRight, CircleDashed, CreditCard, Download, Lock, Mail, ReceiptText } from "lucide-react";
import type * as React from "react";

import { formatCents, formatDate } from "../format";
import { cn } from "../utils";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { EmptyState } from "./empty-state";
import { BellMark } from "./logo";
import { Money } from "./money";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";
import { Skeleton } from "./skeleton";
import { InvoiceChip, PaymentChip, StatusChip } from "./status-chip";
import { useIsMobile } from "./use-mobile";

// The client portal's invoice (portal 17 unpaid, 18 failed, 19 paid, 20 receipt; desktop 24), the one the portal
// renders and Storybook shows: the amount, what it covers, then the one thing to do; a failed payment above it, other
// invoices below, and the receipt in a sheet or dialog. Data in, paying/printing/choosing out through callbacks.

/** One invoice as the client sees it (`invoice.list`). */
export type ClientInvoice = InvoiceSummary;
export type ClientPayment = ClientInvoice["payments"][number];

/** A receipt as `invoice.receipt` returns it: one per issued invoice with money on it. */
export type ReceiptData = {
  invoiceId: string;
  invoiceNumber: string;
  receiptNumber: string;
  taxYear: number;
  settlement: "paid" | "partial";
  practice: { practiceName: string; preparerName: string; preparerCredential: string | null; replyToEmail: string; city: string | null; state: string | null };
  billedTo: string;
  lines: { description: string; quantity: number; amountCents: number }[];
  included: string[];
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  payments: { id: string; amountCents: number; paidAt: string; method: "card" | "cash" | "check" | "other" | "zelle"; processedBy: "preparer" | "stripe" }[];
};

// ---------- Words ----------

// How a payment arrived, in words. Stripe payments are cards until bank debits arrive (ticket 09).
const METHOD: Record<"card" | "cash" | "check" | "zelle" | "other", string> = { card: "Card", cash: "Cash", check: "Check", zelle: "Zelle", other: "Other" };
const paymentMethod = (p: Pick<ClientPayment, "provider" | "method">) => METHOD[p.provider === "stripe" ? "card" : (p.method ?? "other")];

/** "March 12, 2026 at 6:18 PM", in the viewer's time zone. */
const longDateTime = (iso: string) =>
  `${formatDate(iso, { month: "long", day: "numeric", year: "numeric" })} at ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

/** A date-only value ("2026-04-15") as "April 15, 2026", never shifted a day by the time zone. */
const longDay = (day: string) => formatDate(`${day}T12:00:00Z`, { month: "long", day: "numeric", year: "numeric" });

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/** When a receipt's payment arrived: a card payment has a time; one recorded by hand only has its day. */
const paidWhen = (p: { paidAt: string; processedBy: "stripe" | "preparer" }) => (p.processedBy === "stripe" ? longDateTime(p.paidAt) : longDay(p.paidAt.slice(0, 10)));

const paidOn = (p: ClientPayment) => (p.receivedOn ? longDay(p.receivedOn) : longDateTime(p.createdAt));
const today = () => new Date().toISOString().slice(0, 10);

// ---------- The invoice ----------

function DueChip({ invoice }: { invoice: ClientInvoice }) {
  const s = invoice.settlement;
  if (s === "paid" || s === "partial" || s === "failed_last_attempt" || s === "void") return <InvoiceChip status={s} />;
  if (invoice.dueOn && invoice.dueOn < today()) return <StatusChip tone="warning" icon={CircleDashed} label={`Overdue since ${longDay(invoice.dueOn)}`} />;
  return <StatusChip tone="neutral" icon={CircleDashed} label={invoice.dueOn ? `Due ${longDay(invoice.dueOn)}` : "Due before filing"} />;
}

/**
 * One invoice in full (portal 17 unpaid, 18 failed, 19 paid; desktop 24). Paying online goes to Stripe's hosted
 * checkout when it's set up (`onPay` given); otherwise the button stays off and says why. `paying` while it opens.
 */
export function InvoiceDetailCard({
  invoice,
  preparer,
  onReceipt,
  onPay,
  paying = false,
}: {
  invoice: ClientInvoice;
  /** Who else the client can pay, by name. */
  preparer: string;
  onReceipt: () => void;
  onPay?: () => void;
  paying?: boolean;
}) {
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
            <Button size="touch" disabled={!onPay || paying} aria-busy={paying} onClick={onPay} aria-describedby={`pay-note-${invoice.id}`}>
              {onPay ? <CreditCard aria-hidden="true" /> : null}
              {paying ? "Opening checkout…" : `Pay ${formatCents(invoice.balanceCents)}`}
            </Button>
            <p id={`pay-note-${invoice.id}`} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {onPay ? (
                <span>
                  Secure checkout by Stripe, in test mode: no real money moves. Use card <span className="font-mono">4242 4242 4242 4242</span>, any future date
                  and any CVC. You can also pay {preparer} by Zelle, check or cash.
                </span>
              ) : (
                <>Online payment opens soon. You can also pay {preparer} by Zelle, check or cash.</>
              )}
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

/**
 * The last attempt to pay failed (portal 18, desktop 24): what happened and when, what to do about it, and that it
 * doesn't hold up the return. The Pay button stays on the invoice below, so there's one primary action.
 */
export function PaymentFailed({ payment, preparer, replyTo }: { payment: Pick<ClientPayment, "failureMessage" | "createdAt">; /** The preparer's full name. */ preparer: string; /** Where questions go: the practice's reply-to email. */ replyTo: string }) {
  return (
    <section aria-label="Payment problem" className="grid gap-4">
      <Banner tone="danger" title="Your payment didn't go through">
        <p>
          {payment.failureMessage ?? "The payment was declined."} You have not been charged. Tried {longDateTime(payment.createdAt)}.
        </p>
      </Banner>
      <div className="grid gap-3 rounded-xl bg-muted p-5">
        <h2 className="font-semibold">What you can do</h2>
        <ol className="grid list-decimal gap-2 pl-5">
          <li>Try again once online payment opens. Sometimes it works the second time.</li>
          <li>Use a different card, or pay {preparer} another way: Zelle, check or cash.</li>
          <li>Call the number on the back of your card. Banks sometimes block a new charge until you confirm it.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          This doesn't hold up your return. {firstName(preparer)} keeps working while you sort it out. Questions? Write to {replyTo}.
        </p>
      </div>
    </section>
  );
}

/** Back from Stripe's checkout: received (balance zero) or still confirming. */
export function PaymentReturnBanner({ received, onDismiss }: { received: boolean; onDismiss: () => void }) {
  return (
    <Banner
      tone={received ? "success" : "info"}
      title={received ? "Payment received. Thank you!" : "Payment sent. Confirming with Stripe…"}
      action={
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      }
    >
      {received ? "Your receipt is below." : "This usually takes a few seconds."}
    </Banner>
  );
}

/** The client's other invoices for this return, newest first; choosing one shows it. */
export function OtherInvoices({ invoices, onChoose }: { invoices: Pick<ClientInvoice, "id" | "number" | "settlement" | "totalCents">[]; onChoose: (id: string) => void }) {
  if (!invoices.length) return null;
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Other invoices</h2>
      <ul className="grid divide-y rounded-xl border bg-card">
        {invoices.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onChoose(i.id)}
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
  );
}

// ---------- The receipt ----------

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

/** The receipt itself (portal 20): branded, what was paid, how, for what. Prints on its own. */
export function ReceiptDocument({ r }: { r: ReceiptData }) {
  const latest = r.payments[0];
  const p = r.practice;
  return (
    <article aria-label={`Receipt ${r.receiptNumber}`} className="grid gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BellMark className="size-10" />
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

function ReceiptActions({ onDownload, className }: { onDownload: () => void; className?: string }) {
  return (
    <div className={cn("grid gap-2 border-t bg-background p-4 print:hidden", className)}>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="touch" disabled aria-describedby="receipt-email-later">
          <Mail aria-hidden="true" /> Email me a copy
        </Button>
        <Button size="touch" onClick={onDownload}>
          <Download aria-hidden="true" /> Download PDF
        </Button>
      </div>
      <p id="receipt-email-later" className="text-xs text-muted-foreground">
        Emailing a copy arrives soon. For now, download it and save or print the PDF.
      </p>
    </div>
  );
}

/**
 * The receipt in a bottom sheet on a phone, a dialog on a desktop (portal 20). "Download PDF" calls `onDownload`
 * (the portal prints: the print styles hide everything else on the page, so only the receipt reaches the paper).
 * `loading` shows a placeholder; no `receipt` after that says it didn't load.
 */
export function ReceiptView({
  receipt,
  loading = false,
  open,
  onOpenChange,
  onDownload,
}: {
  receipt?: ReceiptData | null;
  loading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
}) {
  const phone = useIsMobile();
  const body = (
    <div className="overflow-y-auto bg-muted p-4 md:p-6 print:overflow-visible print:bg-transparent print:p-0">
      {loading ? (
        <Skeleton aria-label="Loading the receipt" className="h-[28rem] rounded-xl" />
      ) : !receipt ? (
        <Banner tone="danger" title="The receipt didn't load">
          Check your connection and open it again.
        </Banner>
      ) : (
        <ReceiptDocument r={receipt} />
      )}
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
          <ReceiptActions onDownload={onDownload} />
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
        <ReceiptActions onDownload={onDownload} />
      </DialogContent>
    </Dialog>
  );
}

// ---------- The whole screen ----------

/**
 * The Invoice screen (portal 17-20; desktop 24): the invoice being shown, a "back from checkout" banner and a failed
 * payment above it, other invoices underneath, and the receipt (`receipt`, a wired ReceiptView) when it's open.
 */
export function InvoiceScreen({
  loading = false,
  error = false,
  invoice,
  others = [],
  preparer,
  replyTo,
  returnedFromCheckout = false,
  onDismissReturn,
  onChoose,
  onReceipt,
  onPay,
  paying = false,
  receipt,
}: {
  loading?: boolean;
  /** The invoices didn't load. */
  error?: boolean;
  /** The invoice to show; none yet when undefined. */
  invoice?: ClientInvoice;
  others?: ClientInvoice[];
  /** The preparer's full name, or a stand-in like "your preparer". */
  preparer: string;
  /** Where questions about a failed payment go. */
  replyTo: string;
  /** Back from Stripe's checkout (?paid=1). */
  returnedFromCheckout?: boolean;
  onDismissReturn: () => void;
  onChoose: (invoiceId: string) => void;
  onReceipt: (invoiceId: string) => void;
  /** Leave out while online payment is off. */
  onPay?: (invoiceId: string) => void;
  paying?: boolean;
  receipt?: React.ReactNode;
}) {
  const lastPayment = invoice?.payments[0];
  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-1 content-start gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Invoice</h1>

      {loading ? (
        <Skeleton aria-label="Loading your invoice" className="h-96 rounded-xl" />
      ) : error ? (
        <Banner tone="danger" title="Your invoice didn't load">
          Check your connection and refresh the page.
        </Banner>
      ) : !invoice ? (
        <EmptyState
          icon={ReceiptText}
          title="No invoice yet"
          description={`${preparer} sends the invoice once your return is ready. It'll be here, with what it covers and how to pay.`}
        />
      ) : (
        <>
          {returnedFromCheckout ? <PaymentReturnBanner received={invoice.balanceCents === 0} onDismiss={onDismissReturn} /> : null}
          {invoice.settlement === "failed_last_attempt" && lastPayment?.status === "failed" ? <PaymentFailed payment={lastPayment} preparer={preparer} replyTo={replyTo} /> : null}
          <InvoiceDetailCard
            invoice={invoice}
            preparer={preparer}
            onReceipt={() => onReceipt(invoice.id)}
            onPay={onPay ? () => onPay(invoice.id) : undefined}
            paying={paying}
          />
        </>
      )}

      <OtherInvoices invoices={others} onChoose={onChoose} />

      {receipt}
    </div>
  );
}
