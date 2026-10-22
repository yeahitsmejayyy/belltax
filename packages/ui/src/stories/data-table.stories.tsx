import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { DataTable } from "../components/data-table";
import { EmptyState } from "../components/empty-state";
import { columns, rows, type Row } from "./data-table.fixtures";
import fixtures from "./data-table.fixtures?raw";

// Admin 06-pipeline-pipeline-table: sortable columns, bulk select. The rows and the columns are both data, passed in
// (./data-table.fixtures.tsx); the Docs page shows them as their own blocks, then how they reach the table.

// The fixtures file, split at its "// --- " headings into the Docs page's code blocks.
const section = (name: string) => fixtures.split(`// --- ${name}\n`)[1]!.split("\n// --- ")[0]!.trim();

const onSelection = fn();
const onOpen = fn();

const meta: Meta<typeof DataTable<Row>> = {
  title: "Primitives/DataTable",
  component: DataTable,
  parameters: {
    fill: true,
    usage: 'import { DataTable, type ColumnDef } from "@app/ui/components/data-table";',
    snippets: [
      { title: "Sample data", description: "Rows in your page's own shape, each with a stable id.", code: section("Sample data") },
      { title: "Columns", description: "What each column reads, its header, and how its cells draw. Data too: build them from config.", code: section("Columns") },
      {
        title: "Pass them in",
        code: `<DataTable
  label="Returns"
  columns={columns}
  data={rows}
  getRowId={(row) => row.id}
  selectable
  onSelectionChange={setSelected}
  onRowClick={(row) => openReturn(row.id)}
  empty={<EmptyState icon={Inbox} title="No returns yet" />}
/>`,
      },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof DataTable<Row>>;

export const Pipeline: Story = {
  render: () => <DataTable label="Returns" columns={columns} data={rows} getRowId={(r) => r.id} selectable onSelectionChange={onSelection} onRowClick={(r) => onOpen(r.id)} />,
  parameters: {
    docs: {
      source: {
        code: `<DataTable label="Returns" columns={columns} data={rows} getRowId={(row) => row.id} selectable onSelectionChange={setSelected} onRowClick={(row) => openReturn(row.id)} />`,
      },
    },
  },
};
export const PipelineTest: Story = {
  ...Pipeline,
  name: "Pipeline · test",
  tags: ["!dev", "!autodocs"],
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
  parameters: {
    docs: {
      source: {
        code: `<DataTable
  label="Returns"
  columns={columns}
  data={[]}
  getRowId={(row) => row.id}
  empty={<EmptyState icon={Inbox} title="No returns yet" description="Invite your first client to start the season." />}
/>`,
      },
    },
  },
};
