import type { Stage } from "@app/schema";

import type { ColumnDef } from "../components/data-table";
import { Money } from "../components/money";
import { StagePill } from "../components/stage-pill";

// The data and columns the DataTable stories use. The Docs page shows this file's source as "Sample data" and
// "Columns" (ticket 56), so what you read there is exactly what the stories pass in. Invented households.

// --- Sample data
// One object per row, in whatever shape your page has.
// The table needs a stable id for each (getRowId).
export type Row = { id: string; household: string; filers: string; stage: Stage; days: number; balance: number };

export const rows: Row[] = [
  { id: "1", household: "Marigold", filers: "Dana & Sam", stage: "preparing", days: 4, balance: 34000 },
  { id: "2", household: "Kestrel", filers: "Sidney", stage: "review", days: 9, balance: 22500 },
  { id: "3", household: "Wren", filers: "Toni", stage: "documents", days: 12, balance: 0 },
  { id: "4", household: "Birchwood", filers: "Chris & Taylor", stage: "invited", days: 2, balance: 0 },
];

// --- Columns
// One entry per column: which field it reads (accessorKey), its header, and optionally
// how a cell draws (cell) and whether it sorts (enableSorting, on by default).
// Columns are data too: build them from config, reorder or hide them.
export const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "household",
    header: "Household",
    cell: ({ row }) => <span className="font-medium">{row.original.household}</span>,
  },
  { accessorKey: "filers", header: "Filers" },
  {
    accessorKey: "stage",
    header: "Stage",
    cell: ({ row }) => <StagePill stage={row.original.stage} />,
    enableSorting: false,
  },
  {
    accessorKey: "days",
    header: "Days in stage",
    cell: ({ row }) => <span className="tabular-nums">{row.original.days}</span>,
  },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => <Money cents={row.original.balance} />,
  },
];
