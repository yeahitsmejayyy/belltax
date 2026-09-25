import type { LucideIcon } from "lucide-react";
import {
  AlertCircle, Ban, CheckCircle2, CircleDashed, Clock, FileCheck2, FileWarning, FileUp, PencilLine, RotateCcw, XCircle,
} from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { TONE_CLASSES, type Tone } from "./tone";

// One pill geometry for every status in the product: stages (StagePill), documents, invoices, payments.
// Icon + label + tone; the label is what a screen reader reads, the icon is decorative.

type StatusChipProps = React.ComponentProps<"span"> & { tone: Tone; icon: LucideIcon; label: string };

export function StatusChip({ tone, icon: Icon, label, className, ...props }: StatusChipProps) {
  return (
    <span
      data-slot="status-chip"
      data-tone={tone}
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}

type Status = { tone: Tone; icon: LucideIcon; label: string };

// A requested document, as the client and the preparer see it. "needed" is a request with no upload yet.
export type DocumentChipStatus = "needed" | "uploaded" | "accepted" | "rejected";
export const DOCUMENT_STATUS: Record<DocumentChipStatus, Status> = {
  needed: { tone: "neutral", icon: CircleDashed, label: "Needed" },
  uploaded: { tone: "brand", icon: FileUp, label: "Uploaded" },
  accepted: { tone: "success", icon: FileCheck2, label: "Accepted" },
  rejected: { tone: "warning", icon: FileWarning, label: "Needs a better copy" },
};

// An invoice's settlement, derived by the invoice_balances view.
export type InvoiceChipStatus = "draft" | "void" | "unpaid" | "partial" | "paid" | "failed_last_attempt" | "overdue";
export const INVOICE_STATUS: Record<InvoiceChipStatus, Status> = {
  draft: { tone: "neutral", icon: PencilLine, label: "Draft" },
  unpaid: { tone: "brand", icon: Clock, label: "Unpaid" },
  partial: { tone: "info", icon: Clock, label: "Partly paid" },
  paid: { tone: "success", icon: CheckCircle2, label: "Paid" },
  failed_last_attempt: { tone: "danger", icon: AlertCircle, label: "Payment failed" },
  overdue: { tone: "warning", icon: Clock, label: "Overdue" },
  void: { tone: "neutral", icon: Ban, label: "Void" },
};

export type PaymentChipStatus = "pending" | "succeeded" | "failed" | "refunded";
export const PAYMENT_STATUS: Record<PaymentChipStatus, Status> = {
  pending: { tone: "info", icon: Clock, label: "Processing" },
  succeeded: { tone: "success", icon: CheckCircle2, label: "Succeeded" },
  failed: { tone: "danger", icon: XCircle, label: "Failed" },
  refunded: { tone: "neutral", icon: RotateCcw, label: "Refunded" },
};

export const DocumentChip = ({ status, ...p }: { status: DocumentChipStatus } & React.ComponentProps<"span">) => <StatusChip {...DOCUMENT_STATUS[status]} {...p} />;
export const InvoiceChip = ({ status, ...p }: { status: InvoiceChipStatus } & React.ComponentProps<"span">) => <StatusChip {...INVOICE_STATUS[status]} {...p} />;
export const PaymentChip = ({ status, ...p }: { status: PaymentChipStatus } & React.ComponentProps<"span">) => <StatusChip {...PAYMENT_STATUS[status]} {...p} />;

