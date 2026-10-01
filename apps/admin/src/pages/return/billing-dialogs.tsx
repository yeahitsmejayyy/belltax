import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@app/ui/components/dialog";
import { Field, useFieldValidation } from "@app/ui/components/field";
import { Label } from "@app/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { Textarea } from "@app/ui/components/textarea";
import { formatCents } from "@app/ui/format";

import { trpc } from "@/lib/trpc";

import { errorText, todayIso, type Invoice } from "./shared";

// Money received outside the portal (cash, a check, Zelle), and voiding an invoice. Both are logged.

type Method = "cash" | "check" | "zelle" | "other";

const toCents = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

function PaymentForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const balance = invoice.balanceCents;
  const amount = useFieldValidation(
    React.useCallback(
      (v: string) => {
        const c = toCents(v);
        if (!v.trim() || !Number.isFinite(c) || c <= 0) return "Enter the amount received, like 340.00.";
        if (c > balance) return `That's more than the ${formatCents(balance)} still owed.`;
        return null;
      },
      [balance],
    ),
    (balance / 100).toFixed(2),
  );
  const received = useFieldValidation(
    React.useCallback((v: string) => (!v ? "Enter the date it arrived." : v > todayIso() ? "The received date can't be in the future." : null), []),
    todayIso(),
  );
  const [method, setMethod] = React.useState<Method>("check");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const record = trpc.payment.record.useMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (![amount.validateNow(), received.validateNow()].every(Boolean)) return;
    setError(null);
    try {
      await record.mutateAsync({ invoiceId: invoice.id, amountCents: toCents(amount.value), method, receivedOn: received.value, note: note.trim() || undefined });
      await utils.invalidate();
      toast.success(`${formatCents(toCents(amount.value))} recorded on ${invoice.number}`);
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
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
        <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
          <SelectTrigger id="payment-method" className="w-full max-md:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="check">Check</SelectItem>
            <SelectItem value="zelle">Zelle</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field label="Received on" type="date" max={todayIso()} error={received.error} {...received.inputProps} />
      <div className="grid gap-1.5">
        <Label htmlFor="payment-note">Note</Label>
        <Textarea id="payment-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Optional. For example: check no. 1042." />
      </div>
      {error ? <Banner tone="danger" title="It wasn't recorded">{error}</Banner> : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={record.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={record.isPending}>
          Record payment
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RecordPaymentDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{invoice ? <PaymentForm key={invoice.id} invoice={invoice} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function VoidForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const voidInvoice = trpc.invoice.void.useMutation();
  const check = (v: string) => {
    const m = v.trim().length >= 3 ? null : "Say why, in a few words. It's logged.";
    setReasonError(m);
    return !m;
  };
  const submit = async () => {
    if (!check(reason)) return;
    setError(null);
    try {
      await voidInvoice.mutateAsync({ invoiceId: invoice.id, reason: reason.trim() });
      await utils.invalidate();
      toast.success(`${invoice.number} voided`);
      onClose();
    } catch (e) {
      setError(errorText(e));
    }
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
        <Button variant="ghost" onClick={onClose} disabled={voidInvoice.isPending}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={submit} disabled={voidInvoice.isPending}>
          Void invoice
        </Button>
      </DialogFooter>
    </div>
  );
}

export function VoidInvoiceDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{invoice ? <VoidForm key={invoice.id} invoice={invoice} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}
