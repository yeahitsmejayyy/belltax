import { FileCheck2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@app/ui/components/button";

import { sendSampleDocument, type UploadFields } from "@/components/documents/upload";
import { trpc } from "@/lib/trpc";

// In the public demo, where uploads are off: send an invented sample instead (ticket 46). Same lists, same toast, same
// path through the server as a real upload; the visitor's own files never leave their device.
export function SampleButton({ fields, label = "Use a sample document", variant = "outline" }: { fields: UploadFields; label?: string; variant?: "outline" | "ghost" | "default" }) {
  const utils = trpc.useUtils();
  const [pending, setPending] = React.useState(false);
  const send = async () => {
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
  return (
    <Button variant={variant} size="touch" className="w-full md:h-9 md:w-auto md:text-sm" onClick={send} disabled={pending} aria-busy={pending}>
      <FileCheck2 /> {pending ? "Sending…" : label}
    </Button>
  );
}
