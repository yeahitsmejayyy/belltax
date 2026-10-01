import { CalendarPlus, CheckCircle2, CircleSlash, Sprout, XCircle } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@app/ui/components/alert-dialog";
import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { DataTable, type ColumnDef } from "@app/ui/components/data-table";
import { EmptyState } from "@app/ui/components/empty-state";
import { Label } from "@app/ui/components/label";
import { PageHeader } from "@app/ui/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { Skeleton } from "@app/ui/components/skeleton";
import { StatusChip } from "@app/ui/components/status-chip";

import { useTaxYear } from "@/lib/tax-year";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// New season (no mockup; the table and dialog patterns of admin 06 and 19): every completed original return from
// one tax year becomes next year's return, same people and still-open sources. Preview first, then one action.

type Item = RouterOutputs["season"]["preview"]["items"][number];
type Report = RouterOutputs["season"]["rollover"];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const columns: ColumnDef<Item>[] = [
  {
    accessorKey: "householdName",
    header: "Household",
    cell: ({ row }) => (
      <Link to={`/clients/${row.original.householdId}`} className="font-medium hover:underline">
        {row.original.householdName}
      </Link>
    ),
  },
  { id: "filers", header: "Filers", enableSorting: false, cell: ({ row }) => row.original.filers.join(" & ") || "—" },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) =>
      row.original.action === "create" ? <StatusChip tone="success" icon={CalendarPlus} label="Roll over" /> : <StatusChip tone="neutral" icon={CircleSlash} label="Skip" />,
  },
  { accessorKey: "people", header: "People", cell: ({ row }) => <span className="tabular-nums">{row.original.people}</span> },
  {
    id: "dependentsLeft",
    header: "Dependents left off",
    enableSorting: false,
    cell: ({ row }) => (row.original.dependentsLeft.length ? row.original.dependentsLeft.join(", ") : <span className="text-muted-foreground">None</span>),
  },
  { accessorKey: "sourcesToCarry", header: "Sources to carry", cell: ({ row }) => <span className="tabular-nums">{row.original.sourcesToCarry}</span> },
  {
    id: "reason",
    header: "Why skipped",
    enableSorting: false,
    cell: ({ row }) => <span className="whitespace-normal text-muted-foreground">{row.original.reason ?? ""}</span>,
  },
];

function ReportCard({ r }: { r: Report }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>TY {r.toYear} is open</CardTitle>
        <CardDescription>
          {plural(r.created.length, "return")} created · {r.skipped.length} skipped · {r.failed.length} failed
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {r.failed.length ? (
          <Banner tone="danger" title={`${plural(r.failed.length, "return")} didn't roll over`}>
            Nothing from those households was kept. Fix the problem and run it again; returns already opened are skipped.
            <ul className="mt-2 grid gap-1">
              {r.failed.map((f) => (
                <li key={f.fromEngagementId}>
                  <XCircle aria-hidden="true" className="mr-1 inline size-3.5" />
                  <strong>{f.householdName}</strong>: {f.error}
                </li>
              ))}
            </ul>
          </Banner>
        ) : null}
        {r.created.length ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Created</h3>
            <ul className="grid gap-1 text-sm">
              {r.created.map((c) => (
                <li key={c.engagementId} className="flex flex-wrap items-center gap-x-2">
                  <CheckCircle2 aria-hidden="true" className="size-3.5 text-success-foreground" />
                  <Link to={`/returns/${c.engagementId}`} className="font-medium hover:underline">
                    {c.householdName}
                  </Link>
                  <span className="text-muted-foreground">
                    {plural(c.people, "person", "people")} · {plural(c.sourcesCarried, "source")} carried · {plural(c.requestsCreated, "request")}
                    {c.dependentsLeft.length ? ` · left off: ${c.dependentsLeft.join(", ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {r.skipped.length ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Skipped</h3>
            <ul className="grid gap-1 text-sm">
              {r.skipped.map((s) => (
                <li key={s.fromEngagementId}>
                  <span className="font-medium">{s.householdName}</span> <span className="text-muted-foreground">· {s.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Season() {
  usePageTitle("New season", { label: "Settings", to: "/settings" });
  const { years } = useTaxYear();
  const [chosen, setChosen] = React.useState<number | undefined>();
  const fromYear = chosen ?? years[0];
  const q = trpc.season.preview.useQuery({ fromYear: fromYear! }, { enabled: !!fromYear });
  const utils = trpc.useUtils();
  const rollover = trpc.season.rollover.useMutation();
  const [confirm, setConfirm] = React.useState(false);
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const items = q.data?.items ?? [];
  const toCreate = items.filter((i) => i.action === "create").length;
  const skipped = items.length - toCreate;
  const toYear = q.data?.toYear ?? (fromYear ? fromYear + 1 : undefined);

  const run = async () => {
    if (!fromYear) return;
    setError(null);
    try {
      const r = await rollover.mutateAsync({ fromYear });
      setReport(r);
      await utils.invalidate();
      toast.success(`TY ${r.toYear}: ${plural(r.created.length, "return")} opened`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The rollover didn't run.");
    } finally {
      setConfirm(false);
    }
  };

  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      <PageHeader
        title="New season"
        description="Every completed return rolls into the next tax year with the same people and their still-open sources, plus its day-one checklist."
        action={
          <Button onClick={() => setConfirm(true)} disabled={!q.data || !toCreate || rollover.isPending}>
            <CalendarPlus aria-hidden="true" />
            {toYear ? `Open TY ${toYear} for ${plural(toCreate, "return")}` : "Open next season"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="season-from">Roll over from</Label>
          <Select
            value={fromYear ? String(fromYear) : undefined}
            onValueChange={(v) => {
              setChosen(Number(v));
              setReport(null);
              setError(null);
            }}
          >
            <SelectTrigger id="season-from" className="w-32 max-md:h-11">
              <SelectValue placeholder="Tax year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  TY {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {q.data ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {plural(toCreate, "return")} will roll into TY {q.data.toYear} · {skipped} skipped
          </p>
        ) : null}
      </div>

      {error ? <Banner tone="danger" title="The rollover didn't run">{error}</Banner> : null}
      {report ? <ReportCard r={report} /> : null}

      {q.error ? (
        <Banner tone="danger" title="Couldn't build the preview">{q.error.message}</Banner>
      ) : !q.data ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading the preview">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      ) : !items.length ? (
        <EmptyState icon={Sprout} title={`Nothing to roll over from TY ${q.data.fromYear}`} description="Only completed original returns roll into the next year." />
      ) : (
        <DataTable label={`Returns from TY ${q.data.fromYear}`} columns={columns} data={items} getRowId={(r) => r.fromEngagementId} />
      )}

      <AlertDialog open={confirm} onOpenChange={(o) => !rollover.isPending && setConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open TY {toYear} for {plural(toCreate, "return")}?</AlertDialogTitle>
            <AlertDialogDescription>
              Each gets a new return with last year's people, still-open sources and a day-one document checklist. {skipped ? `${skipped} will be skipped. ` : ""}
              Returns already on TY {toYear} are skipped if you run it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollover.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rollover.isPending}
              onClick={(e) => {
                e.preventDefault();
                void run();
              }}
            >
              {rollover.isPending ? "Opening…" : `Open TY ${toYear}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
