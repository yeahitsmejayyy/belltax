import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Stage } from "@app/schema";
import { Inbox } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { DataTable, type ColumnDef } from "../components/data-table";
import { EmptyState } from "../components/empty-state";
import { Money } from "../components/money";
import { StagePill } from "../components/stage-pill";

// Admin 06-pipeline-pipeline-table: sortable columns, bulk select. Invented households.

type Row = { id: string; household: string; filers: string; stage: Stage; days: number; balance: number };
const rows: Row[] = [
  { id: "1", household: "Marigold", filers: "Dana & Sam", stage: "preparing", days: 4, balance: 34000 },
  { id: "2", household: "Kestrel", filers: "Sidney", stage: "review", days: 9, balance: 22500 },
  { id: "3", household: "Wren", filers: "Toni", stage: "documents", days: 12, balance: 0 },
  { id: "4", household: "Birchwood", filers: "Chris & Taylor", stage: "invited", days: 2, balance: 0 },
];
const columns: ColumnDef<Row>[] = [
  { accessorKey: "household", header: "Household", cell: ({ row }) => <span className="font-medium">{row.original.household}</span> },
  { accessorKey: "filers", header: "Filers" },
  { accessorKey: "stage", header: "Stage", cell: ({ row }) => <StagePill stage={row.original.stage} />, enableSorting: false },
  { accessorKey: "days", header: "Days in stage", cell: ({ row }) => <span className="tabular-nums">{row.original.days}</span> },
  { accessorKey: "balance", header: "Balance", cell: ({ row }) => <Money cents={row.original.balance} /> },
];

const onSelection = fn();
const onOpen = fn();

const meta: Meta<typeof DataTable<Row>> = { parameters: { fill: true }, title: "Primitives/DataTable" };
export default meta;
type Story = StoryObj<typeof DataTable<Row>>;

export const Pipeline: Story = {
  render: () => <DataTable label="Returns" columns={columns} data={rows} getRowId={(r) => r.id} selectable onSelectionChange={onSelection} onRowClick={(r) => onOpen(r.id)} />
};
export const PipelineTest: Story = {
  ...Pipeline,
  name: "Pipeline · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const households = () => c.getAllByRole("row").slice(1).map((r) => r.querySelector("td:nth-child(2)")?.textContent);
    await step("sorting by a column header (numbers sort largest first)", async () => {
      await userEvent.click(c.getByRole("button", { name: /Days in stage/ }));
      await expect(households()).toEqual(["Wren", "Kestrel", "Marigold", "Birchwood"]);
      await userEvent.click(c.getByRole("button", { name: /Days in stage/ }));
      await expect(households()).toEqual(["Birchwood", "Marigold", "Kestrel", "Wren"]);
      await expect(c.getByRole("columnheader", { name: /Days in stage/ })).toHaveAttribute("aria-sort", "ascending");
    });
    await step("bulk select", async () => {
      await userEvent.click(c.getByRole("checkbox", { name: "Select all" }));
      await expect(onSelection).toHaveBeenLastCalledWith(["1", "2", "3", "4"]);
      await userEvent.click(c.getAllByRole("checkbox", { name: "Select row" })[0]!);
      await expect(onSelection.mock.lastCall?.[0]).toHaveLength(3);
    });
    await step("a row opens the return; its checkbox doesn't", async () => {
      await userEvent.click(c.getByText("Kestrel"));
      await expect(onOpen).toHaveBeenCalledWith("2");
    });
  },
};


export const Empty: Story = {
  render: () => (
    <DataTable
      label="Returns"
      columns={columns}
      data={[]}
      getRowId={(r) => r.id}
      empty={<EmptyState icon={Inbox} title="No returns yet" description="Invite your first client to start the season." className="border-0" />}
    />
  ),
};
