import type { DocumentView } from "@app/schema";
import { FileCheck2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@app/ui/components/alert-dialog";
import { Button } from "@app/ui/components/button";
import { formatDate } from "@app/ui/format";

import { trpc } from "@/lib/trpc";

// A file already sent: its name and when, and taking it back while it hasn't been reviewed (document.delete). It can't
// be opened again from here (ticket 52, send-only portal): the preparer has it, and a stolen login can't read it.
export function MyUpload({ doc }: { doc: DocumentView }) {
  const utils = trpc.useUtils();
  const remove = trpc.document.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.request.list.invalidate(), utils.document.list.invalidate(), utils.engagement.mine.invalidate()]);
      toast.success(`${doc.filename} removed`);
    },
    onError: (e) => toast.error(e.message),
  });
  const removable = doc.mine && doc.status === "uploaded";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="inline-flex min-h-11 min-w-0 items-center gap-1.5 font-medium md:min-h-8">
        <FileCheck2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{doc.filename}</span>
      </span>
      <span className="text-muted-foreground">· sent {formatDate(doc.uploadedAt)}</span>
      {removable ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="max-md:h-11 text-muted-foreground" disabled={remove.isPending}>
              <Trash2 /> Remove
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {doc.filename}?</AlertDialogTitle>
              <AlertDialogDescription>It hasn't been looked at yet, so you can take it back. You can upload a different file afterwards.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => remove.mutate({ documentId: doc.id })}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
