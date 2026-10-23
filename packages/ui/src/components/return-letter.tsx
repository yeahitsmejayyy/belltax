import { Ban, CheckCircle2, FileSignature, PencilLine, Send, ShieldAlert } from "lucide-react";
import * as React from "react";

import { formatDateTime } from "../format";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { EmptyState } from "./empty-state";
import { Label } from "./label";
import { Skeleton } from "./skeleton";
import { StatusChip } from "./status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Textarea } from "./textarea";

// A return's engagement letter in the preparer admin (admin 16-return-detail-return-letter), the pieces apps/admin's
// return page renders and Storybook shows (ticket 59): draft it from the template, send it for signature, void it, and
// read the signature record (typed name, time, IP, and whether the signed text still matches). Data in; the app does
// the mutations and toasts through the callbacks.

export type ReturnLetterStatus = "draft" | "sent" | "signed" | "void";

/** One signature, as the record keeps it. `hashMatches` is false when the text signed isn't the text on file. */
export type LetterAuditEntry = { personId: string; typedName: string; signedAt: string; ip: string; hashMatches: boolean };

/** The letter as `letter.get` returns it, the parts the admin shows. */
export type ReturnLetterData = {
  status: ReturnLetterStatus;
  sentAt: string | null;
  body: string;
  templateVersion: number;
  signers: { personId: string; name: string }[];
  audit: LetterAuditEntry[] | null;
};

/** How each letter status reads as a chip. */
export const LETTER_STATUS: Record<ReturnLetterStatus, Pick<React.ComponentProps<typeof StatusChip>, "tone" | "icon" | "label">> = {
  draft: { tone: "neutral", icon: PencilLine, label: "Draft" },
  sent: { tone: "info", icon: Send, label: "Out for signature" },
  signed: { tone: "success", icon: CheckCircle2, label: "Signed" },
  void: { tone: "neutral", icon: Ban, label: "Void" },
};

/** While the letter loads. */
export function ReturnLetterLoading() {
  return <Skeleton className="h-80 rounded-xl" />;
}

/** No letter yet: draft one from the template. */
export function ReturnLetterEmpty({ onDraft, pending = false, error }: { onDraft: () => void; pending?: boolean; /** Why drafting failed. */ error?: string | null }) {
  return (
    <div className="grid gap-4">
      {error ? <Banner tone="danger" title="The letter wasn't drafted">{error}</Banner> : null}
      <EmptyState
        icon={FileSignature}
        title="No engagement letter yet"
        description="Draft it from your template in Settings. You can read it before it goes out."
        action={
          <Button variant="outline" disabled={pending} onClick={onDraft}>
            Draft the engagement letter
          </Button>
        }
      />
    </div>
  );
}

/** Who signed, the name they typed, when and from where; a signature over changed text is flagged. */
export function LetterAuditTable({ signers, audit }: Pick<ReturnLetterData, "signers" | "audit">) {
  const entries = audit ?? [];
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Signer</TableHead>
            <TableHead>Typed name</TableHead>
            <TableHead>Signed at</TableHead>
            <TableHead>IP address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {signers.map((s) => {
            const a = entries.find((x) => x.personId === s.personId);
            return (
              <TableRow key={s.personId}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{a?.typedName ?? <span className="text-muted-foreground">Not signed yet</span>}</TableCell>
                <TableCell>{a ? formatDateTime(a.signedAt) : "—"}</TableCell>
                <TableCell className="font-mono">
                  {a ? (
                    <span className="inline-flex items-center gap-1.5">
                      {a.ip}
                      {!a.hashMatches ? (
                        <span className="inline-flex items-center gap-1 text-danger-foreground">
                          <ShieldAlert aria-hidden="true" className="size-4" /> text changed
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export type ReturnLetterProps = {
  letter: ReturnLetterData;
  /** Sends a draft for signature. */
  onSend: () => void;
  sendPending?: boolean;
  /** Opens the void dialog. */
  onVoid: () => void;
  /** Why the last action failed. */
  error?: string | null;
  /** Rendered last: the void dialog. */
  children?: React.ReactNode;
};

/** The Letter tab: status and actions, the signature record (or who signs a draft), then the letter's text. */
export function ReturnLetter({ letter, onSend, sendPending = false, onVoid, error, children }: ReturnLetterProps) {
  const mismatch = (letter.audit ?? []).some((a) => !a.hashMatches);
  return (
    <div className="grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Engagement letter</h2>
          <StatusChip {...LETTER_STATUS[letter.status]} />
          {letter.sentAt ? <span className="text-sm text-muted-foreground">Sent {formatDateTime(letter.sentAt)}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {letter.status === "draft" ? (
            <Button variant="outline" className="max-md:h-11" disabled={sendPending} onClick={onSend}>
              <Send /> Send for signature
            </Button>
          ) : null}
          {letter.status === "signed" ? (
            <Button variant="outline" className="max-md:h-11" disabled title="Not built yet: there's no PDF export of the signed letter">
              Download signed PDF (coming)
            </Button>
          ) : null}
          {letter.status !== "void" ? (
            <Button variant="ghost" className="max-md:h-11" onClick={onVoid}>
              <Ban /> Void…
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Banner tone="danger" title="That didn't go through">{error}</Banner> : null}
      {mismatch ? (
        <Banner tone="danger" title="A signature doesn't match the letter text">
          The text signed is not the text on file. Void this letter and send a new one.
        </Banner>
      ) : null}

      {letter.status !== "draft" ? (
        <LetterAuditTable signers={letter.signers} audit={letter.audit} />
      ) : (
        <p className="text-sm text-muted-foreground">
          To be signed by {letter.signers.map((s) => s.name).join(" and ")}. Read it through, then send it.
        </p>
      )}

      <Card>
        <CardContent>
          <div className="text-sm leading-6 whitespace-pre-wrap">{letter.body}</div>
          <p className="mt-6 text-xs text-muted-foreground">Template version {letter.templateVersion}</p>
        </CardContent>
      </Card>

      {children}
    </div>
  );
}

/** The shortest void reason accepted. */
export const MIN_VOID_REASON = 3;
const checkVoidReason = (v: string) => (v.trim().length >= MIN_VOID_REASON ? null : "Say why, in a few words. It's logged.");

export type VoidLetterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Why it's being voided (logged). */
  reason: string;
  onReasonChange: (reason: string) => void;
  /** The server's words when it refused. */
  error?: string | null;
  /** The void is being sent: the buttons wait and the dialog can't be dismissed. */
  pending?: boolean;
  /** Gets the trimmed reason, only once it's long enough. */
  onConfirm: (reason: string) => void;
};

/** Voiding a letter: signatures stay in the record, every filer signs the new one. The reason is required. */
export function VoidLetterDialog({ open, onOpenChange, reason, onReasonChange, error, pending = false, onConfirm }: VoidLetterDialogProps) {
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const check = (v: string) => {
    const m = checkVoidReason(v);
    setReasonError(m);
    return !m;
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this letter?</DialogTitle>
          <DialogDescription>Signatures stay in the record. Every filer signs the new letter again.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="void-letter-reason">Why</Label>
          <Textarea
            id="void-letter-reason"
            autoFocus
            value={reason}
            aria-invalid={reasonError ? true : undefined}
            onChange={(e) => {
              onReasonChange(e.target.value);
              if (reasonError) check(e.target.value);
            }}
            onBlur={() => check(reason)}
            placeholder="The fee changed after we added the rental."
          />
          {reasonError ? (
            <p role="alert" className="text-sm text-danger-foreground">
              {reasonError}
            </p>
          ) : null}
        </div>
        {error ? <Banner tone="danger" title="It wasn't voided">{error}</Banner> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => check(reason) && onConfirm(reason.trim())} disabled={pending}>
            Void letter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
