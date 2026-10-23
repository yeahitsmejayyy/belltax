import * as React from "react";
import { toast } from "sonner";

import { RequestDocumentSheet, type RequestDraft } from "@app/ui/components/request-document-sheet";

import { trpc } from "@/lib/trpc";

import { errorText, type Detail } from "./shared";

// Asking the client for something (admin 22-dialogs-and-sheets-sheet-request): the sheet is packages/ui's
// RequestDocumentSheet; this reads the document kinds and sends the request.

export function RequestSheet({ d, name, open, onOpenChange }: { d: Detail; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [error, setError] = React.useState<string | null>(null);
  const kinds = trpc.request.documentKinds.useQuery(undefined, { enabled: open, staleTime: 5 * 60_000 });
  const utils = trpc.useUtils();
  const create = trpc.request.create.useMutation();

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const submit = async (request: RequestDraft) => {
    setError(null);
    try {
      await create.mutateAsync({ engagementId: d.engagementId, ...request });
      await utils.invalidate();
      toast.success(request.kind === "document" ? "Request sent. The client sees it on their Documents list." : "Question sent to the client.");
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <RequestDocumentSheet
      name={name}
      open={open}
      onOpenChange={onOpenChange}
      people={d.people}
      kinds={kinds.data ?? []}
      kindsLoading={kinds.isLoading}
      pending={create.isPending}
      error={error}
      onSubmit={submit}
    />
  );
}
