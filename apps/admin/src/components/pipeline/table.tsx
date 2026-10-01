import { Stage } from "@app/schema";
import * as React from "react";

import { DataTable, type ColumnDef } from "@app/ui/components/data-table";
import { Money } from "@app/ui/components/money";
import { StagePill } from "@app/ui/components/stage-pill";
import { cn } from "@app/ui/utils";

import { FILING_SHORT } from "@/lib/labels";
import { householdTitle, STALE_DAYS, type PipelineRow } from "./filters";

// The pipeline as a table (admin 06-pipeline-table, 07-pipeline-stale): sortable, bulk select, a row opens the return.

type Efile = PipelineRow["efile"]["federal"];
const EFILE_WORD: Record<NonNullable<Efile>, string> = { submitted: "waiting", accepted: "accepted", rejected: "rejected" };

function EfileCell({ efile }: { efile: PipelineRow["efile"] }) {
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

const columns: ColumnDef<PipelineRow>[] = [
  {
    id: "household",
    header: "Household",
    accessorFn: householdTitle,
    cell: ({ row }) => <span className="font-medium">{householdTitle(row.original)}</span>,
  },
  {
    id: "filers",
    header: "Filers",
    accessorFn: (r) => r.filers.length,
    cell: ({ getValue }) => {
      const n = getValue<number>();
      return <span className="text-muted-foreground tabular-nums">{n === 1 ? "1 filer" : `${n} filers`}</span>;
    },
  },
  {
    id: "filing",
    header: "Filing",
    accessorFn: (r) => (r.filingStatus ? FILING_SHORT[r.filingStatus] : ""),
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
      return <span className={cn("tabular-nums", d > STALE_DAYS ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>{d}d</span>;
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

export function PipelineTable({ rows, onOpen, onSelectionChange, empty }: { rows: PipelineRow[]; onOpen: (id: string) => void; onSelectionChange: (ids: string[]) => void; empty: React.ReactNode }) {
  return (
    <DataTable
      label="Returns in the pipeline"
      columns={columns}
      data={rows}
      getRowId={(r) => r.engagementId}
      selectable
      onSelectionChange={onSelectionChange}
      onRowClick={(r) => onOpen(r.engagementId)}
      initialSorting={[{ id: "stage", desc: false }]}
      empty={empty}
    />
  );
}
