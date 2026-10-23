import { CalendarPlus, CheckCircle2, CircleSlash, Sprout, XCircle } from "lucide-react";
import * as React from "react";

import { adminAnchor, householdHref, plural, type AdminLink } from "./admin-clients";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./alert-dialog";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { DataTable, type ColumnDef } from "./data-table";
import { EmptyState } from "./empty-state";
import { returnHref } from "./household-detail";
import { Label } from "./label";
import { PageHeader } from "./page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Skeleton } from "./skeleton";
import { StatusChip } from "./status-chip";

// New season in the preparer admin (no mockup; the table and dialog patterns of admin 06 and 19), the pieces apps/admin
// renders and Storybook shows (ticket 58): every completed original return from one tax year becomes next year's
// return, same people and still-open sources. Preview first, then one confirmed action, then what happened. Data in;
// choosing a year, opening the confirm and running it go out through callbacks.

/** One return in the preview: rolled over or skipped (and why). */
export type SeasonPreviewItem = {
  householdId: string;
  householdName: string;
  fromEngagementId: string;
  filers: string[];
  action: "create" | "skip";
  reason: string | null;
  people: number;
  dependentsLeft: string[];
  sourcesToCarry: number;
};

export type SeasonPreview = { fromYear: number; toYear: number; items: SeasonPreviewItem[] };

/** What a rollover did. */
export type RolloverReport = {
  toYear: number;
  created: { engagementId: string; householdName: string; people: number; sourcesCarried: number; requestsCreated: number; dependentsLeft: string[] }[];
  skipped: { fromEngagementId: string; householdName: string; reason: string }[];
  failed: { fromEngagementId: string; householdName: string; error: string }[];
};

function previewColumns(renderLink: AdminLink, householdHrefFor: (id: string) => string): ColumnDef<SeasonPreviewItem>[] {
  return [
    {
      accessorKey: "householdName",
      header: "Household",
      cell: ({ row }) => renderLink(householdHrefFor(row.original.householdId), row.original.householdName, "font-medium hover:underline"),
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
}

/** The preview table: each return from the year, whether it rolls over, and what it carries. */
export function SeasonPreviewTable({ fromYear, items, renderLink = adminAnchor, householdHrefFor = householdHref }: { fromYear: number; items: SeasonPreviewItem[]; renderLink?: AdminLink; householdHrefFor?: (id: string) => string }) {
  const columns = React.useMemo(() => previewColumns(renderLink, householdHrefFor), [renderLink, householdHrefFor]);
  return <DataTable label={`Returns from TY ${fromYear}`} columns={columns} data={items} getRowId={(r) => r.fromEngagementId} />;
}

/** What a rollover did: created (each a link to the new return), skipped, and failed. */
export function RolloverReportCard({ report: r, renderLink = adminAnchor, returnHrefFor = returnHref }: { report: RolloverReport; renderLink?: AdminLink; returnHrefFor?: (engagementId: string) => string }) {
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
                  {renderLink(returnHrefFor(c.engagementId), c.householdName, "font-medium hover:underline")}
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

/** "Open TY N for M returns?": the one confirm before a rollover. Stays open while it runs. */
export function RolloverConfirmDialog({
  open,
  onOpenChange,
  toYear,
  toCreate,
  skipped,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toYear?: number;
  toCreate: number;
  skipped: number;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Open TY {toYear} for {plural(toCreate, "return")}?</AlertDialogTitle>
          <AlertDialogDescription>
            Each gets a new return with last year's people, still-open sources and a day-one document checklist. {skipped ? `${skipped} will be skipped. ` : ""}
            Returns already on TY {toYear} are skipped if you run it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "Opening…" : `Open TY ${toYear}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type NewSeasonPageProps = {
  /** Tax years to roll over from, newest first. */
  years: number[];
  fromYear?: number;
  onFromYearChange: (year: number) => void;
  /** The preview for `fromYear`; undefined while it loads. */
  preview?: SeasonPreview;
  /** Why the preview couldn't be built. */
  previewError?: string | null;
  /** The last rollover's report, shown above the preview. */
  report?: RolloverReport | null;
  /** Why the last rollover didn't run. */
  error?: string | null;
  /** The confirm dialog. */
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  /** Runs the rollover (after the confirm). */
  onRollover: () => void;
  pending?: boolean;
  renderLink?: AdminLink;
  householdHrefFor?: (id: string) => string;
  returnHrefFor?: (engagementId: string) => string;
};

/** The whole New season screen. */
export function NewSeasonPage({
  years,
  fromYear,
  onFromYearChange,
  preview,
  previewError,
  report,
  error,
  confirmOpen,
  onConfirmOpenChange,
  onRollover,
  pending = false,
  renderLink,
  householdHrefFor,
  returnHrefFor,
}: NewSeasonPageProps) {
  const items = preview?.items ?? [];
  const toCreate = items.filter((i) => i.action === "create").length;
  const skipped = items.length - toCreate;
  const toYear = preview?.toYear ?? (fromYear ? fromYear + 1 : undefined);

  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      <PageHeader
        title="New season"
        description="Every completed return rolls into the next tax year with the same people and their still-open sources, plus its day-one checklist."
        action={
          <Button onClick={() => onConfirmOpenChange(true)} disabled={!preview || !toCreate || pending}>
            <CalendarPlus aria-hidden="true" />
            {toYear ? `Open TY ${toYear} for ${plural(toCreate, "return")}` : "Open next season"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="season-from">Roll over from</Label>
          <Select value={fromYear ? String(fromYear) : undefined} onValueChange={(v) => onFromYearChange(Number(v))}>
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
        {preview ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {plural(toCreate, "return")} will roll into TY {preview.toYear} · {skipped} skipped
          </p>
        ) : null}
      </div>

      {error ? <Banner tone="danger" title="The rollover didn't run">{error}</Banner> : null}
      {report ? <RolloverReportCard report={report} renderLink={renderLink} returnHrefFor={returnHrefFor} /> : null}

      {previewError ? (
        <Banner tone="danger" title="Couldn't build the preview">{previewError}</Banner>
      ) : !preview ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading the preview">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      ) : !items.length ? (
        <EmptyState icon={Sprout} title={`Nothing to roll over from TY ${preview.fromYear}`} description="Only completed original returns roll into the next year." />
      ) : (
        <SeasonPreviewTable fromYear={preview.fromYear} items={items} renderLink={renderLink} householdHrefFor={householdHrefFor} />
      )}

      <RolloverConfirmDialog open={confirmOpen} onOpenChange={onConfirmOpenChange} toYear={toYear} toCreate={toCreate} skipped={skipped} pending={pending} onConfirm={onRollover} />
    </div>
  );
}
