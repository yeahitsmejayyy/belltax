import { Ban, Banknote, Plus, ReceiptText, Send } from "lucide-react";
import * as React from "react";

import { formatCents } from "../format";
import { cn } from "../utils";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { EmptyState } from "./empty-state";
import { Field, useFieldValidation } from "./field";
import { PAYMENT_METHOD_LABELS } from "./invoice-list";
import { Label } from "./label";
import { Money } from "./money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { InvoiceChip, PaymentChip, type InvoiceChipStatus, type PaymentChipStatus } from "./status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Textarea } from "./textarea";

// A return's Billing tab (admin 17-return-detail-return-billing), the pieces apps/admin renders and Storybook shows:
// each invoice with its lines and what it includes (named, never a $0 line: R26), what's been paid, and every payment
// attempt; a failed latest attempt leads the tab. Plus the two dialogs behind its buttons: money received outside the
// portal (cash, a check, Zelle) and voiding an invoice. Data in as props, actions out through callbacks; the admin
// sends, records, voids, toasts and refetches.

/** One invoice on the return. `due` is its due date already worded ("Mar 7"), or null for none. */
export type BillingInvoice = {
  id: string;
  number: string;
  status: "draft" | "issued" | "void";
  settlement: InvoiceChipStatus;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  due: string | null;
  lines: { description: string; quantity: number; unitAmountCents: number }[];
  /** Add-ons it includes at no charge, by name. */
  included: string[];
  /** Its payment attempts: one that succeeded means it can't be voided. */
  payments: { status: PaymentChipStatus }[];
};

/** One payment attempt, newest first in the table. `when` is already worded (a day for money recorded by hand). */
export type BillingPayment = {
  id: string;
  when: string;
  provider: "manual" | "stripe";
  method: string | null;
  amountCents: number;
  status: PaymentChipStatus;
  failureMessage: string | null;
  note: string | null;
};

/** How a payment came in, as the attempts table words it. */
export type PaymentMethodWords = { methods?: Record<string, string>; card?: string; byHand?: string };
export function paymentMethodLabel(p: Pick<BillingPayment, "provider" | "method">, { methods = PAYMENT_METHOD_LABELS, card = "Card · Stripe", byHand = "Recorded by hand" }: PaymentMethodWords = {}) {
  return p.provider === "stripe" ? card : p.method ? (methods[p.method] ?? p.method) : byHand;
}

export type BillingInvoiceCardProps = {
  invoice: BillingInvoice;
  /** Send a draft to the client. */
  onSend: () => void;
  /** True while that send is in flight. */
  sending?: boolean;
  onPay: () => void;
  onVoid: () => void;
};

/** One invoice: number and status, total, lines and included add-ons, paid and balance once sent, and its actions. */
export function BillingInvoiceCard({ invoice: inv, onSend, sending = false, onPay, onVoid }: BillingInvoiceCardProps) {
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
              {inv.due ? ` · due ${inv.due}` : ""}
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
              <Button variant="outline" size="sm" className="max-md:h-11" disabled={sending} onClick={onSend}>
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

/** Every payment attempt on the return: when, how, how much, the result and why it failed (or the note). */
export function PaymentAttemptsTable({ payments, words }: { payments: BillingPayment[]; words?: PaymentMethodWords }) {
  return (
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
              <TableCell>{p.when}</TableCell>
              <TableCell>{paymentMethodLabel(p, words)}</TableCell>
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
  );
}

export type BillingTabProps = {
  invoices: BillingInvoice[];
  /** Every attempt across those invoices, newest first. */
  payments: BillingPayment[];
  onCreate: () => void;
  onSend: (invoice: BillingInvoice) => void;
  /** The invoice whose send is in flight, if any: only its button waits. */
  sendingId?: string | null;
  onPay: (invoice: BillingInvoice) => void;
  onVoid: (invoice: BillingInvoice) => void;
  words?: PaymentMethodWords;
  emptyTitle?: string;
  emptyDescription?: string;
  /** The dialogs behind the buttons, rendered at the end of the tab. */
  children?: React.ReactNode;
};

/** The whole tab: Invoices with Create invoice, the failed-attempt banner, each invoice, then the attempts table. */
export function BillingTab({
  invoices,
  payments,
  onCreate,
  onSend,
  sendingId = null,
  onPay,
  onVoid,
  words,
  emptyTitle = "No invoice yet",
  emptyDescription = "Create one from this return's package and add-ons.",
  children,
}: BillingTabProps) {
  const failed = invoices.some((i) => i.settlement === "failed_last_attempt");

  return (
    <div className="grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Invoices</h2>
        <Button variant="outline" className="max-md:h-11" onClick={onCreate}>
          <Plus /> Create invoice
        </Button>
      </div>

      {failed ? <Banner tone="danger" title="The latest payment attempt failed.">The client sees a retry screen in the portal and can use a different card.</Banner> : null}

      {invoices.length ? (
        invoices.map((inv) => (
          <BillingInvoiceCard key={inv.id} invoice={inv} sending={sendingId === inv.id} onSend={() => onSend(inv)} onPay={() => onPay(inv)} onVoid={() => onVoid(inv)} />
        ))
      ) : (
        <EmptyState icon={ReceiptText} title={emptyTitle} description={emptyDescription} />
      )}

      {payments.length ? (
        <>
          <h2 className="pt-2 text-base font-semibold">Payment attempts</h2>
          <PaymentAttemptsTable payments={payments} words={words} />
        </>
      ) : null}

      {children}
    </div>
  );
}

// ---------- Record a payment ----------

/** The methods a payment recorded by hand can have, in the order the dialog offers them. */
export const MANUAL_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
  { value: "other", label: "Other" },
] as const;
export type PaymentMethodOption = { value: string; label: string };

/** What Record payment sends: whole cents, the method, the day it arrived (YYYY-MM-DD) and an optional note. */
export type RecordedPayment<M extends string = string> = { amountCents: number; method: M; receivedOn: string; note?: string };

/** "$1,240.50" or "1240.5" to cents; NaN when it isn't a number. */
export const dollarsToCents = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

export type RecordPaymentDialogProps<M extends string = string> = {
  /** The invoice being paid; null keeps the dialog closed. */
  invoice: { id: string; number: string; balanceCents: number } | null;
  onRecord: (payment: RecordedPayment<M>) => void;
  onClose: () => void;
  /** True while the record is in flight: both buttons wait. */
  busy?: boolean;
  /** Why the last record failed. */
  error?: string | null;
  methods?: readonly { value: M; label: string }[];
  defaultMethod?: M;
  /** Today, YYYY-MM-DD: the default received date and the latest one allowed. */
  today?: string;
};

function PaymentForm<M extends string>({
  invoice,
  onRecord,
  onClose,
  busy,
  error,
  methods,
  defaultMethod,
  today,
}: Required<Omit<RecordPaymentDialogProps<M>, "invoice" | "error">> & { invoice: NonNullable<RecordPaymentDialogProps<M>["invoice"]>; error?: string | null }) {
  const balance = invoice.balanceCents;
  const amount = useFieldValidation(
    React.useCallback(
      (v: string) => {
        const c = dollarsToCents(v);
        if (!v.trim() || !Number.isFinite(c) || c <= 0) return "Enter the amount received, like 340.00.";
        if (c > balance) return `That's more than the ${formatCents(balance)} still owed.`;
        return null;
      },
      [balance],
    ),
    (balance / 100).toFixed(2),
  );
  const received = useFieldValidation(
    React.useCallback((v: string) => (!v ? "Enter the date it arrived." : v > today ? "The received date can't be in the future." : null), [today]),
    today,
  );
  const [method, setMethod] = React.useState<M>(defaultMethod);
  const [note, setNote] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (![amount.validateNow(), received.validateNow()].every(Boolean)) return;
    onRecord({ amountCents: dollarsToCents(amount.value), method, receivedOn: received.value, note: note.trim() || undefined });
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Record a payment on {invoice.number}</DialogTitle>
        <DialogDescription>{formatCents(balance)} still owed. For money that came in outside the portal.</DialogDescription>
      </DialogHeader>
      <Field label="Amount" inputMode="decimal" autoFocus error={amount.error} {...amount.inputProps} />
      <div className="grid gap-1.5">
        <Label htmlFor="payment-method">Method</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as M)}>
          <SelectTrigger id="payment-method" className="w-full max-md:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {methods.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Field label="Received on" type="date" max={today} error={received.error} {...received.inputProps} />
      <div className="grid gap-1.5">
        <Label htmlFor="payment-note">Note</Label>
        <Textarea id="payment-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Optional. For example: check no. 1042." />
      </div>
      {error ? <Banner tone="danger" title="It wasn't recorded">{error}</Banner> : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          Record payment
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Money that came in outside the portal: amount (up to the balance), method, the day it arrived and a note. */
export function RecordPaymentDialog<M extends string = (typeof MANUAL_PAYMENT_METHODS)[number]["value"]>({
  invoice,
  onRecord,
  onClose,
  busy = false,
  error,
  methods = MANUAL_PAYMENT_METHODS as unknown as readonly { value: M; label: string }[],
  defaultMethod = "check" as M,
  today = localToday(),
}: RecordPaymentDialogProps<M>) {
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {invoice ? (
          <PaymentForm key={invoice.id} invoice={invoice} onRecord={onRecord} onClose={onClose} busy={busy} error={error} methods={methods} defaultMethod={defaultMethod} today={today} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Void ----------

export type VoidInvoiceDialogProps = {
  /** The invoice being voided; null keeps the dialog closed. */
  invoice: { id: string; number: string } | null;
  /** Void, with the reason (trimmed, at least three characters). */
  onVoid: (reason: string) => void;
  onClose: () => void;
  busy?: boolean;
  /** Why the last void failed. */
  error?: string | null;
};

function VoidForm({ invoice, onVoid, onClose, busy, error }: Omit<VoidInvoiceDialogProps, "invoice"> & { invoice: { number: string } }) {
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const check = (v: string) => {
    const m = v.trim().length >= 3 ? null : "Say why, in a few words. It's logged.";
    setReasonError(m);
    return !m;
  };
  const submit = () => {
    if (!check(reason)) return;
    onVoid(reason.trim());
  };
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Void {invoice.number}?</DialogTitle>
        <DialogDescription>The client stops seeing it. It stays in the record as void.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="void-invoice-reason">Why</Label>
        <Textarea
          id="void-invoice-reason"
          autoFocus
          value={reason}
          aria-invalid={reasonError ? true : undefined}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError) check(e.target.value);
          }}
          onBlur={() => check(reason)}
          placeholder="Wrong package: they're filing separately."
        />
        {reasonError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {reasonError}
          </p>
        ) : null}
      </div>
      {error ? <Banner tone="danger" title="It wasn't voided">{error}</Banner> : null}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={submit} disabled={busy}>
          Void invoice
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Void an invoice: the client stops seeing it, it stays in the record. Asks why; the reason is logged. */
export function VoidInvoiceDialog({ invoice, onVoid, onClose, busy = false, error }: VoidInvoiceDialogProps) {
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{invoice ? <VoidForm key={invoice.id} invoice={invoice} onVoid={onVoid} onClose={onClose} busy={busy} error={error} /> : null}</DialogContent>
    </Dialog>
  );
}
