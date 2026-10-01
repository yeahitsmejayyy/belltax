import type { InvoiceTab } from "@app/schema";
import { ReceiptText } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { EmptyState } from "@app/ui/components/empty-state";
import { Money } from "@app/ui/components/money";
import { Skeleton } from "@app/ui/components/skeleton";
import { InvoiceChip, type InvoiceChipStatus } from "@app/ui/components/status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@app/ui/components/table";
import { formatCents } from "@app/ui/format";
import { cn } from "@app/ui/utils";

import { Segmented } from "@/components/lists/segmented";
import { dueDate, shortWhen } from "@/components/lists/when";
import { useTaxYear } from "@/lib/tax-year";
import { type RouterOutputs, trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// Invoices across the practice (admin 29-clients-invoices-and-activity-invoices): one tab per state,
// problems first, cursor paging. A row opens that return's billing.

type Row = RouterOutputs["invoice"]["all"]["items"][number];
type Tab = InvoiceTab | "all";
const TABS = ["all", "open", "failed", "overdue", "paid", "draft", "void"] as const satisfies readonly Tab[];
const TAB_LABEL: Record<Tab, string> = { all: "All", open: "Open", failed: "Failed", overdue: "Overdue", paid: "Paid", draft: "Draft", void: "Void" };
const METHOD: Record<string, string> = { cash: "Cash", check: "Check", zelle: "Zelle", other: "Other" };

function status(r: Row): InvoiceChipStatus {
  if (r.tab === "failed") return "failed_last_attempt";
  if (r.tab === "open") return r.settlement === "partial" ? "partial" : "unpaid";
  return r.tab;
}

function Attempt({ p }: { p: Row["lastPayment"] }) {
  if (!p) return <span className="text-muted-foreground">No attempts</span>;
  const how = p.provider === "stripe" ? "Card" : (p.method && METHOD[p.method]) || "Recorded";
  if (p.status === "failed") return <span className="font-medium text-danger-foreground">Failed · {p.failureMessage ?? "declined"} · {shortWhen(p.at)}</span>;
  const word = { succeeded: "Succeeded", pending: "Processing", refunded: "Refunded" }[p.status];
  return <span className="text-muted-foreground">{word} · {how} · {shortWhen(p.at)}</span>;
}

export default function Invoices() {
  usePageTitle("Invoices");
  const navigate = useNavigate();
  const { taxYear } = useTaxYear();
  const [tabParam, setTab] = useQueryState("tab", parseAsStringLiteral(TABS));
  // The dashboard's health checks link here with the older filters.
  const [settlement, setSettlement] = useQueryState("settlement");
  const [overdue, setOverdue] = useQueryState("overdue");
  const tab: Tab = tabParam ?? (settlement === "failed_last_attempt" ? "failed" : overdue ? "overdue" : "all");

  const q = trpc.invoice.all.useInfiniteQuery(
    { taxYear, tab: tab === "all" ? undefined : tab, limit: 50 },
    { enabled: !!taxYear, getNextPageParam: (p) => p.next ?? undefined },
  );
  const first = q.data?.pages[0];
  const items = React.useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  const choose = (t: Tab) => {
    void setSettlement(null);
    void setOverdue(null);
    void setTab(t === "all" ? null : t);
  };
  const open = (r: Row) => navigate(`/returns/${r.engagementId}/billing`);

  if (!first || !taxYear) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading invoices">
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const c = first.counts;
  const summary = [`${formatCents(first.outstandingCents)} outstanding`, c.failed ? `${c.failed} failed` : null, c.overdue ? `${c.overdue} overdue` : null].filter(Boolean).join(" · ");

  return (
    <div className="grid grid-cols-1 animate-page gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Invoices to show"
          value={tab}
          onChange={choose}
          options={TABS.map((t) => ({ value: t, label: `${TAB_LABEL[t]} ${c[t]}` }))}
        />
        <p className="text-sm text-muted-foreground tabular-nums">{summary}</p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ReceiptText} title={tab === "all" ? "No invoices yet" : `No ${TAB_LABEL[tab].toLowerCase()} invoices`} description="Invoices are created from a return's Billing tab." />
      ) : (
        <>
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
                {items.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => open(r)}>
                    <TableCell className="pl-4 font-mono text-sm">
                      <Link to={`/returns/${r.engagementId}/billing`} onClick={(e) => e.stopPropagation()} className="rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                        {r.number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">
                      <Money cents={r.totalCents} />
                    </TableCell>
                    <TableCell>
                      <InvoiceChip status={status(r)} />
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      <Attempt p={r.lastPayment} />
                    </TableCell>
                    <TableCell className="pr-4 text-muted-foreground">{r.dueOn ? dueDate(r.dueOn) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-2 md:hidden">
            {items.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/returns/${r.engagementId}/billing`}
                  className="grid gap-2 rounded-xl border bg-card p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="grid gap-0.5">
                      <span className="font-medium">{r.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{r.number}</span>
                    </span>
                    <Money cents={r.totalCents} className="font-medium" />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <InvoiceChip status={status(r)} />
                    <span className={cn("text-muted-foreground", !r.dueOn && "sr-only")}>{r.dueOn ? `Due ${dueDate(r.dueOn)}` : "No due date"}</span>
                  </span>
                  <span className="text-sm">
                    <Attempt p={r.lastPayment} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {q.hasNextPage ? (
            <div className="flex justify-center">
              <Button variant="outline" className="h-11 md:h-9" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
