import { Ban, CheckCircle2, FileSignature, PencilLine, Send, ShieldAlert } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent } from "@app/ui/components/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@app/ui/components/dialog";
import { EmptyState } from "@app/ui/components/empty-state";
import { Label } from "@app/ui/components/label";
import { Skeleton } from "@app/ui/components/skeleton";
import { StatusChip } from "@app/ui/components/status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@app/ui/components/table";
import { Textarea } from "@app/ui/components/textarea";
import { formatDateTime } from "@app/ui/format";

import { trpc, type RouterOutputs } from "@/lib/trpc";

import { errorText, type Detail } from "./shared";

// Letter (admin 16-return-detail-return-letter): draft it from the template, send it for signature, and read
// the signature record (typed name, time, IP, and whether the signed text still matches).

type Letter = NonNullable<RouterOutputs["letter"]["get"]>;
const STATUS: Record<Letter["status"], Pick<React.ComponentProps<typeof StatusChip>, "tone" | "icon" | "label">> = {
  draft: { tone: "neutral", icon: PencilLine, label: "Draft" },
  sent: { tone: "info", icon: Send, label: "Out for signature" },
  signed: { tone: "success", icon: CheckCircle2, label: "Signed" },
  void: { tone: "neutral", icon: Ban, label: "Void" },
};

function VoidDialog({ letter, open, onOpenChange }: { letter: Letter; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const voidLetter = trpc.letter.void.useMutation();
  const check = (v: string) => {
    const m = v.trim().length >= 3 ? null : "Say why, in a few words. It's logged.";
    setReasonError(m);
    return !m;
  };
  const submit = async () => {
    if (!check(reason)) return;
    setError(null);
    try {
      await voidLetter.mutateAsync({ letterId: letter.id, reason: reason.trim() });
      await utils.invalidate();
      toast.success("Letter voided. You can draft a new one.");
      onOpenChange(false);
      setReason("");
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !voidLetter.isPending && onOpenChange(o)}>
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
              setReason(e.target.value);
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={voidLetter.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={voidLetter.isPending}>
            Void letter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LetterTab({ d }: { d: Detail }) {
  const q = trpc.letter.get.useQuery({ engagementId: d.engagementId });
  const utils = trpc.useUtils();
  const create = trpc.letter.create.useMutation();
  const send = trpc.letter.send.useMutation();
  const [voiding, setVoiding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setError(null);
    try {
      await fn();
      await utils.invalidate();
      toast.success(done);
    } catch (e) {
      setError(errorText(e));
    }
  };

  if (q.isLoading) return <Skeleton className="h-80 rounded-xl" />;
  const letter = q.data;

  if (!letter) {
    return (
      <div className="grid gap-4">
        {error ? <Banner tone="danger" title="The letter wasn't drafted">{error}</Banner> : null}
        <EmptyState
          icon={FileSignature}
          title="No engagement letter yet"
          description="Draft it from your template in Settings. You can read it before it goes out."
          action={
            <Button variant="outline" disabled={create.isPending} onClick={() => run(() => create.mutateAsync({ engagementIds: [d.engagementId] }), "Letter drafted")}>
              Draft the engagement letter
            </Button>
          }
        />
      </div>
    );
  }

  const audit = letter.audit ?? [];
  const mismatch = audit.some((a) => !a.hashMatches);

  return (
    <div className="grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Engagement letter</h2>
          <StatusChip {...STATUS[letter.status]} />
          {letter.sentAt ? <span className="text-sm text-muted-foreground">Sent {formatDateTime(letter.sentAt)}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {letter.status === "draft" ? (
            <Button variant="outline" className="max-md:h-11" disabled={send.isPending} onClick={() => run(() => send.mutateAsync({ letterId: letter.id }), "Letter sent for signature")}>
              <Send /> Send for signature
            </Button>
          ) : null}
          {letter.status === "signed" ? (
            <Button variant="outline" className="max-md:h-11" disabled title="Not built yet: there's no PDF export of the signed letter">
              Download signed PDF (coming)
            </Button>
          ) : null}
          {letter.status !== "void" ? (
            <Button variant="ghost" className="max-md:h-11" onClick={() => setVoiding(true)}>
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
              {letter.signers.map((s) => {
                const a = audit.find((x) => x.personId === s.personId);
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

      <VoidDialog letter={letter} open={voiding} onOpenChange={setVoiding} />
    </div>
  );
}
