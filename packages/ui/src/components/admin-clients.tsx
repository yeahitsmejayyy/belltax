import { Archive, Search, Users } from "lucide-react";
import * as React from "react";

import { formatDate, relativeDays } from "../format";
import { Banner } from "./banner";
import { Button } from "./button";
import { DataTable, type ColumnDef } from "./data-table";
import { EmptyState } from "./empty-state";
import { Input } from "./input";
import { Label } from "./label";
import { Skeleton } from "./skeleton";
import { StatusChip } from "./status-chip";
import { Switch } from "./switch";

// The preparer admin's Clients screen (admin 27-clients-invoices-and-activity-clients), the pieces apps/admin renders and
// Storybook shows (ticket 58): every household, newest activity first, a search, "Show archived", and the
// "nobody can sign in yet" filter. Data in; links out through `renderLink`, searching and filtering out through callbacks.
// The app does the fetching, the debounce and the URL.

/** How an admin component asks the app for a link to `to` (a router link there, a plain <a> in stories). */
export type AdminLink = (to: string, children: React.ReactNode, className?: string, onClick?: React.MouseEventHandler<HTMLAnchorElement>) => React.ReactNode;
export const adminAnchor: AdminLink = (to, children, className, onClick) => (
  <a href={to} className={className} onClick={onClick}>
    {children}
  </a>
);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One household in the list, as `household.list` returns it. */
export type ClientRow = {
  id: string;
  displayName: string;
  archivedAt: string | null;
  members: number;
  logins: number;
  latestTaxYear: number | null;
  lastActivityAt: string | null;
};

function lastActivity(iso: string | null) {
  if (!iso) return <span className="text-muted-foreground">None yet</span>;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return <span className="text-muted-foreground" title={formatDate(iso)}>{days < 7 ? relativeDays(iso) : formatDate(iso, { month: "short", day: "numeric" })}</span>;
}

/** The household's page, from its id. */
export const householdHref = (id: string) => `/clients/${id}`;

function clientColumns(renderLink: AdminLink, hrefFor: (id: string) => string): ColumnDef<ClientRow>[] {
  return [
    {
      accessorKey: "displayName",
      header: "Household",
      cell: ({ row }) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {renderLink(hrefFor(row.original.id), row.original.displayName, "font-medium hover:underline", (e) => e.stopPropagation())}
          {row.original.archivedAt ? <StatusChip tone="neutral" icon={Archive} label="Archived" /> : null}
        </span>
      ),
    },
    { accessorKey: "members", header: "Members", cell: ({ row }) => plural(row.original.members, "member") },
    {
      accessorKey: "latestTaxYear",
      header: "Returns",
      cell: ({ row }) => (row.original.latestTaxYear ? `Latest TY ${row.original.latestTaxYear}` : <span className="text-muted-foreground">No returns</span>),
    },
    {
      accessorKey: "logins",
      header: "Portal logins",
      cell: ({ row }) =>
        row.original.logins ? <span className="tabular-nums">{row.original.logins}</span> : <span className="text-muted-foreground">No login yet</span>,
    },
    { accessorKey: "lastActivityAt", header: "Last activity", sortUndefined: "last", cell: ({ row }) => lastActivity(row.original.lastActivityAt) },
  ];
}

/** The search field, "Show archived", and how many households are showing (once known). */
export function ClientsToolbar({
  search,
  onSearchChange,
  includeArchived,
  onIncludeArchivedChange,
  count,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  /** Households showing; leave it out while the list loads. */
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="relative w-full max-w-sm">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search households"
          placeholder="Search households, names"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 max-md:h-11"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="show-archived" checked={includeArchived} onCheckedChange={onIncludeArchivedChange} />
        <Label htmlFor="show-archived">Show archived</Label>
      </div>
      {count !== undefined ? <span className="ml-auto text-sm text-muted-foreground tabular-nums">{plural(count, "household")}</span> : null}
    </div>
  );
}

/** The households table: a link on each name, a click anywhere on the row opens it. */
export function ClientsTable({
  rows,
  query,
  onOpen,
  renderLink = adminAnchor,
  hrefFor = householdHref,
}: {
  rows: ClientRow[];
  /** The search being shown, for the "no match" line. */
  query?: string;
  onOpen?: (row: ClientRow) => void;
  renderLink?: AdminLink;
  hrefFor?: (id: string) => string;
}) {
  const columns = React.useMemo(() => clientColumns(renderLink, hrefFor), [renderLink, hrefFor]);
  return (
    <DataTable
      label="Households"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      onRowClick={onOpen}
      empty={<span className="text-muted-foreground">{query ? `No household matches “${query}”.` : "No households here."}</span>}
    />
  );
}

export type ClientsPageProps = {
  /** The households to show, already filtered; undefined while loading. */
  rows?: ClientRow[];
  /** No households at all, before any search or "Show archived": the empty state instead of the table. */
  noClients?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  /** The search the rows answer (trimmed, debounced). */
  query?: string;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  /** Only households nobody can sign in to yet (the dashboard's health check), with a way back to all. */
  pendingOnly?: boolean;
  onShowAll?: () => void;
  onOpen?: (row: ClientRow) => void;
  renderLink?: AdminLink;
  hrefFor?: (id: string) => string;
};

/** The whole Clients screen. */
export function ClientsPage({ rows, noClients = false, search, onSearchChange, query, includeArchived, onIncludeArchivedChange, pendingOnly = false, onShowAll, onOpen, renderLink, hrefFor }: ClientsPageProps) {
  return (
    <div className="grid grid-cols-1 animate-page gap-4">
      <ClientsToolbar search={search} onSearchChange={onSearchChange} includeArchived={includeArchived} onIncludeArchivedChange={onIncludeArchivedChange} count={rows?.length} />

      {pendingOnly ? (
        <Banner
          tone="info"
          title="Households nobody can sign in to yet"
          action={
            <Button variant="outline" size="sm" onClick={onShowAll}>
              Show all
            </Button>
          }
        >
          Their invite hasn't been accepted, or they were added without one.
        </Banner>
      ) : null}

      {!rows ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading clients">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      ) : noClients ? (
        <EmptyState icon={Users} title="No clients yet" description="Invite a client from the header and their household appears here." />
      ) : (
        <ClientsTable rows={rows} query={query} onOpen={onOpen} renderLink={renderLink} hrefFor={hrefFor} />
      )}
    </div>
  );
}
