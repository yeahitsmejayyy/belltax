import type { InvoiceTab } from "@app/schema";
import { ReceiptText } from "lucide-react";
import * as React from "react";

import { formatCents } from "../format";
import { cn } from "../utils";
import type { RenderLink } from "./client-home";
import { EmptyState } from "./empty-state";
import { Money } from "./money";
import { Segmented } from "./segmented";
import { Skeleton } from "./skeleton";
import { InvoiceChip, type InvoiceChipStatus } from "./status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

// Invoices across the practice (admin 29-clients-invoices-and-activity-invoices), the pieces apps/admin renders and
// Storybook shows: one tab per state with its count, problems first, a table from md up and cards on a phone. A row
// opens that return's billing. Data in (rows, counts, the tab), changes out through `onChange` and `onOpen`, links
// through `renderLink`; the app owns the query, the paging and the URL.

export type InvoiceListTab = InvoiceTab | "all";

/** The tabs in order. */
export const INVOICE_LIST_TABS = ["all", "open", "failed", "overdue", "paid", "draft", "void"] as const satisfies readonly InvoiceListTab[];
export const INVOICE_LIST_TAB_LABELS: Record<InvoiceListTab, string> = { all: "All", open: "Open", failed: "Failed", overdue: "Overdue", paid: "Paid", draft: "Draft", void: "Void" };
export const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: "Cash", check: "Check", zelle: "Zelle", other: "Other" };

/** The latest payment attempt, plus `when`, its time already worded for a list ("2:14 PM", "Yesterday"). */
export type PaymentAttemptView = {
  status: "failed" | "pending" | "refunded" | "succeeded";
  provider: "manual" | "stripe";
  method: string | null;
  failureMessage: string | null;
  when: string;
};

/** One invoice row. `due` is the due date already worded ("Mar 7"), or null for none. */
export type InvoiceListRow = {
  id: string;
  number: string;
  name: string;
  totalCents: number;
  tab: InvoiceTab;
  settlement: string;
  due: string | null;
  lastPayment: PaymentAttemptView | null;
};

/** The chip for a row: failed and partly paid say so, the rest are their tab. */
export function invoiceRowStatus(r: Pick<InvoiceListRow, "tab" | "settlement">): InvoiceChipStatus {
  if (r.tab === "failed") return "failed_last_attempt";
  if (r.tab === "open") return r.settlement === "partial" ? "partial" : "unpaid";
  return r.tab;
}

/** "Failed · Card declined · Yesterday", "Succeeded · Zelle · Mar 7", or "No attempts". */
export function PaymentAttempt({ p, methods = PAYMENT_METHOD_LABELS }: { p: PaymentAttemptView | null; methods?: Record<string, string> }) {
  if (!p) return <span className="text-muted-foreground">No attempts</span>;
  const how = p.provider === "stripe" ? "Card" : (p.method && methods[p.method]) || "Recorded";
  if (p.status === "failed") return <span className="font-medium text-danger-foreground">Failed · {p.failureMessage ?? "declined"} · {p.when}</span>;
  const word = { succeeded: "Succeeded", pending: "Processing", refunded: "Refunded" }[p.status];
  return <span className="text-muted-foreground">{word} · {how} · {p.when}</span>;
}

// ---------- Tabs, summary and states ----------

export type InvoiceTabsProps = {
  value: InvoiceListTab;
  counts: Record<InvoiceListTab, number>;
  onChange: (tab: InvoiceListTab) => void;
  /** The money still owed, and how many failed and overdue: the line beside the tabs. */
  outstandingCents: number;
  tabs?: readonly InvoiceListTab[];
  labels?: Record<InvoiceListTab, string>;
  label?: string;
};

/** The tab row ("Open 4") beside "$1,240.00 outstanding · 1 failed · 2 overdue". */
export function InvoiceTabs({ value, counts, onChange, outstandingCents, tabs = INVOICE_LIST_TABS, labels = INVOICE_LIST_TAB_LABELS, label = "Invoices to show" }: InvoiceTabsProps) {
  const summary = [`${formatCents(outstandingCents)} outstanding`, counts.failed ? `${counts.failed} failed` : null, counts.overdue ? `${counts.overdue} overdue` : null].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Segmented label={label} value={value} onChange={onChange} options={tabs.map((t) => ({ value: t, label: `${labels[t]} ${counts[t]}` }))} />
      <p className="text-sm text-muted-foreground tabular-nums">{summary}</p>
    </div>
  );
}

export function InvoicesLoading({ label = "Loading invoices" }: { label?: string }) {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label={label}>
      <Skeleton className="h-9 w-full max-w-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

/** No invoices in this tab. */
export function InvoicesEmpty({ tab, labels = INVOICE_LIST_TAB_LABELS, description = "Invoices are created from a return's Billing tab." }: { tab: InvoiceListTab; labels?: Record<InvoiceListTab, string>; description?: string }) {
  return <EmptyState icon={ReceiptText} title={tab === "all" ? "No invoices yet" : `No ${labels[tab].toLowerCase()} invoices`} description={description} />;
}

// ---------- Rows ----------

const anchor: RenderLink = (to, children, className) => (
  <a href={to} className={className}>
    {children}
  </a>
);

export type InvoiceRowsProps<T extends InvoiceListRow> = {
  rows: T[];
  /** Where a row links to (its return's billing). */
  href: (row: T) => string;
  /** A click anywhere on a table row except its link. */
  onOpen?: (row: T) => void;
  renderLink?: RenderLink;
  methods?: Record<string, string>;
};

/** From md up: number, household, amount, status, latest attempt and due date. The whole row opens the invoice. */
export function InvoiceTable<T extends InvoiceListRow>({ rows, href, onOpen, renderLink = anchor, methods }: InvoiceRowsProps<T>) {
  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Invoice</TableHead>
            <TableHead>Household</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Latest payment attempt</TableHead>
            <TableHead className="pr-4">Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              className="cursor-pointer"
              onClick={(e: React.MouseEvent) => {
                // The number is a link of its own: let it navigate instead.
                if (e.target instanceof Element && e.target.closest("a")) return;
                onOpen?.(r);
              }}
            >
              <TableCell className="pl-4 font-mono text-sm">{renderLink(href(r), r.number, "rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50")}</TableCell>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right">
                <Money cents={r.totalCents} />
              </TableCell>
              <TableCell>
                <InvoiceChip status={invoiceRowStatus(r)} />
              </TableCell>
              <TableCell className="max-w-md truncate">
                <PaymentAttempt p={r.lastPayment} methods={methods} />
              </TableCell>
              <TableCell className="pr-4 text-muted-foreground">{r.due ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Below md: one linked card per invoice. */
export function InvoiceCards<T extends InvoiceListRow>({ rows, href, renderLink = anchor, methods }: Omit<InvoiceRowsProps<T>, "onOpen">) {
  return (
    <ul className="grid gap-2 md:hidden">
      {rows.map((r) => (
        <li key={r.id}>
          {renderLink(
            href(r),
            <>
              <span className="flex items-start justify-between gap-3">
                <span className="grid gap-0.5">
                  <span className="font-medium">{r.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.number}</span>
                </span>
                <Money cents={r.totalCents} className="font-medium" />
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <InvoiceChip status={invoiceRowStatus(r)} />
                <span className={cn("text-muted-foreground", !r.due && "sr-only")}>{r.due ? `Due ${r.due}` : "No due date"}</span>
              </span>
              <span className="text-sm">
                <PaymentAttempt p={r.lastPayment} methods={methods} />
              </span>
            </>,
            "grid gap-2 rounded-xl border bg-card p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          )}
        </li>
      ))}
    </ul>
  );
}
