import { Stage, type EfileStatus } from "@app/schema";
import { Filter, Search, SearchX, UserPlus, Workflow } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { DataTable, type ColumnDef } from "./data-table";
import { EmptyState } from "./empty-state";
import { Input } from "./input";
import { Money } from "./money";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Skeleton } from "./skeleton";
import { STAGE_META, StagePill } from "./stage-pill";

// The pipeline's pieces around the board (admin 05-pipeline-board, 06-table, 07-stale, 08-empty, 35-phone-m-pipeline):
// the toolbar (view switch, search, stage and quick filters with counts, folded into a Filters popover on phones), the
// table view, and the loading and empty states. All controlled: the app keeps the filters (in the URL), filters the
// rows and passes in what to show; every change comes back through a callback.

// ---------- Toolbar ----------

export type PipelineView = "board" | "table";

/** A quick filter: a pressed/unpressed button with how many returns it matches. */
export type PipelineChip = { id: string; label: string; on: boolean; count: number; onToggle: () => void };

export type PipelineToolbarProps = {
  view: PipelineView;
  onViewChange: (view: PipelineView) => void;
  /** The name search, as typed. */
  query: string;
  onQueryChange: (query: string) => void;
  /** The stage filter; null is "All stages". */
  stage: Stage | null;
  onStageChange: (stage: Stage | null) => void;
  /** The stages the stage filter offers, in order. All eight by default. */
  stages?: readonly Stage[];
  /** The quick filters, in order (Missing documents, Unpaid, Over 7 days in stage). */
  chips: PipelineChip[];
  /** Turns every filter off (search included). */
  onClear: () => void;
  /** Returns this year, and how many of them the filters leave. */
  total: number;
  shown: number;
  /** Rows picked in the table, shown before the count. */
  selected?: number;
};

function Chip({ on, onClick, label, count, className }: { on: boolean; onClick: () => void; label: string; count: number; className?: string }) {
  return (
    <Button
      variant="outline"
      aria-pressed={on}
      onClick={onClick}
      className={cn("group aria-pressed:border-primary aria-pressed:bg-brand-subtle aria-pressed:text-brand-subtle-foreground", className)}
    >
      {label} <span className="tabular-nums text-muted-foreground group-aria-pressed:text-inherit">· {count}</span>
    </Button>
  );
}

function Filters({ stage, onStageChange, stages, chips, touch }: Pick<PipelineToolbarProps, "stage" | "onStageChange" | "chips"> & { stages: readonly Stage[]; touch?: boolean }) {
  const chip = touch ? "h-11 justify-between text-base" : undefined;
  return (
    <>
      <Select value={stage ?? "all"} onValueChange={(v) => onStageChange(v === "all" ? null : (v as Stage))}>
        <SelectTrigger size={touch ? "touch" : "default"} aria-label="Stage" className={touch ? "w-full" : "w-40"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {stages.map((s) => (
            <SelectItem key={s} value={s}>
              {STAGE_META[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chips.map((c) => (
        <Chip key={c.id} className={chip} on={c.on} onClick={c.onToggle} label={c.label} count={c.count} />
      ))}
    </>
  );
}

const VIEWS: { value: PipelineView; label: string }[] = [
  { value: "board", label: "Board" },
  { value: "table", label: "Table" },
];

export function PipelineToolbar({ view, onViewChange, query, onQueryChange, stage, onStageChange, stages = Stage.options, chips, onClear, total, shown, selected = 0 }: PipelineToolbarProps) {
  const chipsOn = (stage ? 1 : 0) + chips.filter((c) => c.on).length;
  const active = (query.trim() ? 1 : 0) + chipsOn;
  const filters = { stage, onStageChange, stages, chips };

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      {/* A two-way switch, not tabs: there are no tab panels, the whole page changes (axe: aria-valid-attr-value). */}
      <div role="group" aria-label="View" className="inline-flex h-11 w-fit items-center rounded-lg bg-muted p-1 text-muted-foreground md:h-9">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={view === v.value}
            data-state={view === v.value ? "active" : "inactive"}
            onClick={() => onViewChange(v.value)}
            className="inline-flex h-full items-center rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-card"
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1 md:max-w-64 md:flex-none">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search by name"
          placeholder="Search by name"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="h-11 pl-9 md:h-9 md:w-64"
        />
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <Filters {...filters} />
        {active ? (
          <Button variant="ghost" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon-touch" className="relative md:hidden" aria-label={chipsOn ? `Filters, ${chipsOn} on` : "Filters"}>
            <Filter />
            {chipsOn ? (
              <span aria-hidden="true" className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {chipsOn}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-72 gap-2">
          <Filters {...filters} touch />
          {active ? (
            <Button variant="ghost" size="touch" onClick={onClear}>
              Clear filters
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>

      <p className="w-full text-sm text-muted-foreground tabular-nums md:ml-auto md:w-auto" aria-live="polite">
        {selected ? `${selected} selected · ` : ""}
        {shown === total ? `${total} return${total === 1 ? "" : "s"}` : `${shown} of ${total} returns`}
      </p>
    </div>
  );
}

// ---------- Table ----------

/** One return as a table row, already in words where it shows words. */
export type PipelineTableRow = {
  /** Stable id, passed back to onOpen and onSelectionChange. */
  id: string;
  /** "Dana & Sam Marigold". */
  household: string;
  /** How many people file. */
  filers: number;
  /** Short filing status ("MFJ"), null when not chosen yet. */
  filing: string | null;
  stage: Stage;
  daysInStage: number;
  /** Requested documents not in yet. */
  openRequests: number;
  balanceCents: number;
  efile: { federal: EfileStatus | null; state: EfileStatus | null };
};

const EFILE_WORD: Record<EfileStatus, string> = { submitted: "waiting", accepted: "accepted", rejected: "rejected" };

function EfileCell({ efile }: { efile: PipelineTableRow["efile"] }) {
  const parts = ([["Federal", efile.federal], ["State", efile.state]] as const).filter(([, s]) => s);
  if (!parts.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-sm">
      {parts.map(([who, s], i) => (
        <React.Fragment key={who}>
          {i ? <span className="text-muted-foreground"> · </span> : null}
          <span className={cn(s === "rejected" && "font-medium text-danger-foreground")}>
            {who} {EFILE_WORD[s!]}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

/** The table's columns. Days in stage over `staleAfterDays` turn amber. */
export const pipelineColumns = (staleAfterDays = 7): ColumnDef<PipelineTableRow>[] => [
  {
    id: "household",
    header: "Household",
    accessorFn: (r) => r.household,
    cell: ({ row }) => <span className="font-medium">{row.original.household}</span>,
  },
  {
    id: "filers",
    header: "Filers",
    accessorFn: (r) => r.filers,
    cell: ({ getValue }) => {
      const n = getValue<number>();
      return <span className="text-muted-foreground tabular-nums">{n === 1 ? "1 filer" : `${n} filers`}</span>;
    },
  },
  {
    id: "filing",
    header: "Filing",
    accessorFn: (r) => r.filing ?? "",
    cell: ({ getValue }) => getValue<string>() || <span className="text-muted-foreground">—</span>,
  },
  {
    id: "stage",
    header: "Stage",
    accessorFn: (r) => Stage.options.indexOf(r.stage),
    cell: ({ row }) => <StagePill stage={row.original.stage} />,
  },
  {
    id: "daysInStage",
    header: "In stage",
    accessorKey: "daysInStage",
    cell: ({ row }) => {
      const d = row.original.daysInStage;
      return <span className={cn("tabular-nums", d > staleAfterDays ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>{d}d</span>;
    },
  },
  {
    id: "openRequests",
    header: "Documents",
    accessorKey: "openRequests",
    cell: ({ row }) => {
      const n = row.original.openRequests;
      return n ? <span className="tabular-nums">{n} missing</span> : <span className="text-muted-foreground">None</span>;
    },
  },
  {
    id: "balance",
    header: "Balance",
    accessorKey: "balanceCents",
    cell: ({ row }) => (row.original.balanceCents > 0 ? <Money cents={row.original.balanceCents} /> : <span className="text-muted-foreground">—</span>),
  },
  {
    id: "efile",
    header: "E-file",
    enableSorting: false,
    cell: ({ row }) => <EfileCell efile={row.original.efile} />,
  },
];

export type PipelineTableProps = {
  rows: PipelineTableRow[];
  /** A row was clicked: open its return. */
  onOpen: (id: string) => void;
  onSelectionChange?: (ids: string[]) => void;
  /** Shown in place of the rows when the filters leave none. */
  empty?: React.ReactNode;
  staleAfterDays?: number;
  label?: string;
};

export function PipelineTable({ rows, onOpen, onSelectionChange, empty, staleAfterDays = 7, label = "Returns in the pipeline" }: PipelineTableProps) {
  const columns = React.useMemo(() => pipelineColumns(staleAfterDays), [staleAfterDays]);
  return (
    <DataTable
      label={label}
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      selectable
      onSelectionChange={onSelectionChange}
      onRowClick={(r) => onOpen(r.id)}
      initialSorting={[{ id: "stage", desc: false }]}
      empty={empty}
    />
  );
}

// ---------- Loading and empty ----------

/** The page's shape while the year's returns load. */
export function PipelineLoading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading the pipeline">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="hidden h-9 w-96 md:block" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** No returns at all this year: the first-run state, with the invite as its action. */
export function PipelineEmpty({
  taxYear,
  onInvite,
  description = "Invite your first client to start the season. They get a link to set up their portal, answer intake questions and upload documents. Their return shows up here in Invited.",
  actionLabel = "Invite your first client",
}: {
  taxYear?: number | null;
  onInvite: () => void;
  description?: React.ReactNode;
  actionLabel?: React.ReactNode;
}) {
  return (
    <EmptyState
      icon={Workflow}
      className="animate-page border-none"
      title={taxYear ? `No returns for TY ${taxYear} yet` : "No returns yet"}
      description={description}
      action={
        <Button onClick={onInvite} className="h-11 md:h-9">
          <UserPlus /> {actionLabel}
        </Button>
      }
    />
  );
}

/** There are returns, but the filters leave none. */
export function PipelineNoMatch({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={SearchX}
      className="border-none"
      title="No returns match these filters"
      description="Try a different name or turn a filter off."
      action={
        <Button variant="outline" onClick={onClear} className="h-11 md:h-9">
          Clear filters
        </Button>
      }
    />
  );
}
