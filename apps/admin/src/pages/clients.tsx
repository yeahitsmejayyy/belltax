import { Archive, Search, Users } from "lucide-react";
import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { DataTable, type ColumnDef } from "@app/ui/components/data-table";
import { EmptyState } from "@app/ui/components/empty-state";
import { Input } from "@app/ui/components/input";
import { Label } from "@app/ui/components/label";
import { Skeleton } from "@app/ui/components/skeleton";
import { StatusChip } from "@app/ui/components/status-chip";
import { Switch } from "@app/ui/components/switch";
import { formatDate, relativeDays } from "@app/ui/format";

import { trpc, type RouterOutputs } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// Clients (admin 27-clients-invoices-and-activity-clients): every household, newest activity first, from
// household.list. ?invite=pending (the dashboard's health check) narrows to households nobody can sign in to yet.

type Row = RouterOutputs["household"]["list"][number];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function lastActivity(iso: string | null) {
  if (!iso) return <span className="text-muted-foreground">None yet</span>;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return <span className="text-muted-foreground" title={formatDate(iso)}>{days < 7 ? relativeDays(iso) : formatDate(iso, { month: "short", day: "numeric" })}</span>;
}

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "displayName",
    header: "Household",
    cell: ({ row }) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Link to={`/clients/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
          {row.original.displayName}
        </Link>
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

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Clients() {
  usePageTitle("Clients");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const pendingOnly = params.get("invite") === "pending";
  const [search, setSearch] = React.useState("");
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const q = useDebounced(search.trim());
  const list = trpc.household.list.useQuery({ search: q || undefined, includeArchived }, { placeholderData: (prev) => prev });

  const rows = React.useMemo(() => (list.data ?? []).filter((h) => !pendingOnly || h.logins === 0), [list.data, pendingOnly]);

  return (
    <div className="grid grid-cols-1 animate-page gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search households"
            placeholder="Search households, names"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 max-md:h-11"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-archived" checked={includeArchived} onCheckedChange={setIncludeArchived} />
          <Label htmlFor="show-archived">Show archived</Label>
        </div>
        {list.data ? <span className="ml-auto text-sm text-muted-foreground tabular-nums">{plural(rows.length, "household")}</span> : null}
      </div>

      {pendingOnly ? (
        <Banner
          tone="info"
          title="Households nobody can sign in to yet"
          action={
            <Button variant="outline" size="sm" onClick={() => setParams({})}>
              Show all
            </Button>
          }
        >
          Their invite hasn't been accepted, or they were added without one.
        </Banner>
      ) : null}

      {!list.data ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading clients">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      ) : !list.data.length && !q && !includeArchived ? (
        <EmptyState icon={Users} title="No clients yet" description="Invite a client from the header and their household appears here." />
      ) : (
        <DataTable
          label="Households"
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          onRowClick={(r) => navigate(`/clients/${r.id}`)}
          empty={<span className="text-muted-foreground">{q ? `No household matches “${q}”.` : "No households here."}</span>}
        />
      )}
    </div>
  );
}
