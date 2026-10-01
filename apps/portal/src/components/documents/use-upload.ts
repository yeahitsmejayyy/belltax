import * as React from "react";
import { toast } from "sonner";

import { useUploads } from "@app/ui/components/file-dropzone";

import { uploadDocument, type UploadFields } from "@/components/documents/upload";
import { trpc } from "@/lib/trpc";

// One upload target (a request, or "something else"): progress per file, then fresh lists and a toast.
export function useDocumentUploads(fields: UploadFields) {
  const utils = trpc.useUtils();
  const key = JSON.stringify(fields);
  const upload = React.useCallback(
    async (file: File, onProgress: (f: number) => void) => {
      const doc = await uploadDocument(JSON.parse(key) as UploadFields, file, onProgress);
      await Promise.all([utils.request.list.invalidate(), utils.document.list.invalidate(), utils.engagement.mine.invalidate()]);
      toast.success(`${doc.filename} uploaded`, { description: "We'll let you know once it's been checked." });
    },
    [key, utils],
  );
  return useUploads(upload);
}
