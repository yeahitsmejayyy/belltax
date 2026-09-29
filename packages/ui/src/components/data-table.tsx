import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type RowSelectionState, type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import * as React from "react"

import { cn } from "../utils"
import { Checkbox } from "./checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"

// Sortable columns, bulk select, sticky header: the pipeline table, clients and invoices
// (admin 06-pipeline-table, 27-clients, 29-invoices). Data comes in already filtered; this only shows it.

export type { ColumnDef }

type DataTableProps<T> = {
  columns: ColumnDef<T, any>[]
  data: T[]
  getRowId: (row: T) => string
  selectable?: boolean
  onSelectionChange?: (ids: string[]) => void
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  initialSorting?: SortingState
  className?: string
  label: string // what the table is, for screen readers
}

export function DataTable<T>({ columns, data, getRowId, selectable, onSelectionChange, onRowClick, empty, initialSorting = [], className, label }: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const allColumns = React.useMemo<ColumnDef<T, any>[]>(
    () =>
      selectable
        ? [
            {
              id: "select",
              enableSorting: false,
              header: ({ table }) => (
                <Checkbox
                  aria-label="Select all"
                  checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
                  onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
                />
              ),
              cell: ({ row }) => (
                <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} onClick={(e) => e.stopPropagation()} />
              ),
            },
            ...columns,
          ]
        : columns,
    [columns, selectable],
  )

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: (u) => {
      setRowSelection((prev) => {
        const next = typeof u === "function" ? u(prev) : u
        onSelectionChange?.(Object.keys(next).filter((k) => next[k]))
        return next
      })
    },
    enableRowSelection: !!selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    // overflow-hidden keeps every corner round: the sticky header, hovered and selected rows all clip to the radius.
    <div data-slot="data-table" className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <Table aria-label={label}>
        <TableHeader className="sticky top-0 z-10 bg-card">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const sort = header.column.getIsSorted()
                return (
                  <TableHead key={header.id} aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button type="button" className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sort === "asc" ? <ArrowUp className="size-3" /> : sort === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={allColumns.length} className="h-32 text-center whitespace-normal">
                {empty ?? <span className="text-muted-foreground">Nothing here yet.</span>}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
