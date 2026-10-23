import { parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

import { INVOICE_LIST_TABS, InvoiceCards, InvoicesEmpty, InvoicesLoading, InvoiceTable, InvoiceTabs, type InvoiceListTab } from "@app/ui/components/invoice-list";
import { LoadMore } from "@app/ui/components/load-more";

import { dueDate, shortWhen } from "@/components/lists/when";
import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// Invoices across the practice (admin 29-clients-invoices-and-activity-invoices): one tab per state,
// problems first, cursor paging. A row opens that return's billing. The screen is packages/ui invoice-list; this page
// fetches, pages, keeps the tab in the URL and routes.

const billing = (r: { engagementId: string }) => `/returns/${r.engagementId}/billing`;
const link = (to: string, children: React.ReactNode, className?: string) => (
  <Link to={to} className={className}>
    {children}
  </Link>
);

export default function Invoices() {
  usePageTitle("Invoices");
  const navigate = useNavigate();
  const { taxYear } = useTaxYear();
  const [tabParam, setTab] = useQueryState("tab", parseAsStringLiteral(INVOICE_LIST_TABS));
  // The dashboard's health checks link here with the older filters.
  const [settlement, setSettlement] = useQueryState("settlement");
  const [overdue, setOverdue] = useQueryState("overdue");
  const tab: InvoiceListTab = tabParam ?? (settlement === "failed_last_attempt" ? "failed" : overdue ? "overdue" : "all");

  const q = trpc.invoice.all.useInfiniteQuery(
    { taxYear, tab: tab === "all" ? undefined : tab, limit: 50 },
    { enabled: !!taxYear, getNextPageParam: (p) => p.next ?? undefined },
  );
  const first = q.data?.pages[0];
  const rows = React.useMemo(
    () =>
      q.data?.pages
        .flatMap((p) => p.items)
        .map((r) => ({ ...r, due: r.dueOn ? dueDate(r.dueOn) : null, lastPayment: r.lastPayment && { ...r.lastPayment, when: shortWhen(r.lastPayment.at) } })) ?? [],
    [q.data],
  );

  const choose = (t: InvoiceListTab) => {
    void setSettlement(null);
    void setOverdue(null);
    void setTab(t === "all" ? null : t);
  };

  if (!first || !taxYear) return <InvoicesLoading />;

  return (
    <div className="grid grid-cols-1 animate-page gap-4">
      <InvoiceTabs value={tab} counts={first.counts} onChange={choose} outstandingCents={first.outstandingCents} />

      {rows.length === 0 ? (
        <InvoicesEmpty tab={tab} />
      ) : (
        <>
          <InvoiceTable rows={rows} href={billing} onOpen={(r) => navigate(billing(r))} renderLink={link} />
          <InvoiceCards rows={rows} href={billing} renderLink={link} />
          <LoadMore hasMore={!!q.hasNextPage} loading={q.isFetchingNextPage} onLoadMore={() => void q.fetchNextPage()} />
        </>
      )}
    </div>
  );
}
