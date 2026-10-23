import type { DocumentView } from "@app/schema";
import * as React from "react";
import { toast } from "sonner";

import { sendSampleDocument, type UploadFields } from "@/components/documents/upload";
import { trpc } from "@/lib/trpc";

// The Documents screen's actions (the components are @app/ui/components/client-documents): each one runs, refreshes
// the lists and says how it went. Pending is tracked per document or request, so one row's spinner never blocks another.

function usePendingIds() {
  const [ids, setIds] = React.useState<ReadonlySet<string>>(new Set());
  const add = (id: string) => setIds((s) => new Set(s).add(id));
  const drop = (id: string) =>
    setIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  return { has: (id: string) => ids.has(id), add, drop };
}

// Taking back a file while it hasn't been reviewed (document.delete).
export function useRemoveDocument() {
  const utils = trpc.useUtils();
  const del = trpc.document.delete.useMutation();
  const pending = usePendingIds();
  const remove = async (doc: Pick<DocumentView, "id" | "filename">) => {
    pending.add(doc.id);
    try {
      await del.mutateAsync({ documentId: doc.id });
      await Promise.all([utils.request.list.invalidate(), utils.document.list.invalidate(), utils.engagement.mine.invalidate()]);
      toast.success(`${doc.filename} removed`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      pending.drop(doc.id);
    }
  };
  return { remove, isPending: pending.has };
}

// Answering a preparer's question in place (request.answer). A failure rejects, so the card can show it by the field.
export function useAnswerQuestion(preparer: string) {
  const utils = trpc.useUtils();
  const answer = trpc.request.answer.useMutation();
  const pending = usePendingIds();
  const send = async (requestId: string, response: string) => {
    pending.add(requestId);
    try {
      await answer.mutateAsync({ requestId, response });
      await Promise.all([utils.request.list.invalidate(), utils.engagement.mine.invalidate()]);
      toast.success(`Answer sent to ${preparer}`);
    } finally {
      pending.drop(requestId);
    }
  };
  return { send, isPending: pending.has };
}

// In the public demo, where uploads are off: send an invented sample instead (ticket 46). Same lists, same toast, same
// path through the server as a real upload; the visitor's own files never leave their device.
export function useSampleDocument(fields: UploadFields) {
  const utils = trpc.useUtils();
  const [pending, setPending] = React.useState(false);
  const onClick = async () => {
    setPending(true);
    try {
      const doc = await sendSampleDocument(fields);
      await Promise.all([utils.request.list.invalidate(), utils.document.list.invalidate(), utils.engagement.mine.invalidate()]);
      toast.success(`${doc.kindLabel} sent`, { description: "A sample with invented details. The tax agent sees it to check." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  return { pending, onClick: () => void onClick() };
}
