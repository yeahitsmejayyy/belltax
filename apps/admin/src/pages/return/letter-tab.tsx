import * as React from "react";
import { toast } from "sonner";

import { ReturnLetter, ReturnLetterEmpty, ReturnLetterLoading, VoidLetterDialog } from "@app/ui/components/return-letter";

import { trpc } from "@/lib/trpc";

import { errorText, type Detail } from "./shared";

// Letter (admin 16-return-detail-return-letter): the screens are packages/ui's return-letter; this drafts, sends and
// voids through trpc and shows the toasts.

function VoidDialog({ letterId, open, onOpenChange }: { letterId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const voidLetter = trpc.letter.void.useMutation();
  const submit = async (trimmed: string) => {
    setError(null);
    try {
      await voidLetter.mutateAsync({ letterId, reason: trimmed });
      await utils.invalidate();
      toast.success("Letter voided. You can draft a new one.");
      onOpenChange(false);
      setReason("");
    } catch (e) {
      setError(errorText(e));
    }
  };
  return <VoidLetterDialog open={open} onOpenChange={onOpenChange} reason={reason} onReasonChange={setReason} error={error} pending={voidLetter.isPending} onConfirm={submit} />;
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

  if (q.isLoading) return <ReturnLetterLoading />;
  const letter = q.data;

  if (!letter) {
    return <ReturnLetterEmpty error={error} pending={create.isPending} onDraft={() => run(() => create.mutateAsync({ engagementIds: [d.engagementId] }), "Letter drafted")} />;
  }

  return (
    <ReturnLetter letter={letter} error={error} sendPending={send.isPending} onSend={() => run(() => send.mutateAsync({ letterId: letter.id }), "Letter sent for signature")} onVoid={() => setVoiding(true)}>
      <VoidDialog letterId={letter.id} open={voiding} onOpenChange={setVoiding} />
    </ReturnLetter>
  );
}
