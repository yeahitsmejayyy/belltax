import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchX } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { EmptyState } from "../components/empty-state";
import { PipelineTable } from "../components/pipeline";
import { ROWS } from "./admin-pipeline.fixtures";

// The pipeline as a table (admin 06-pipeline-table, 07-pipeline-stale): sortable, bulk select, a row opens the return.
// Rows come in already filtered and in words (./admin-pipeline.fixtures.ts). Invented households.
const meta: Meta<typeof PipelineTable> = {
  title: "Admin/Pipeline/PipelineTable",
  component: PipelineTable,
  parameters: { fill: true, usage: 'import { PipelineTable, pipelineColumns, type PipelineTableRow } from "@app/ui/components/pipeline";' },
  args: { rows: ROWS, onOpen: fn(), onSelectionChange: fn() },
};
export default meta;
type Story = StoryObj<typeof PipelineTable>;

export const Default: Story = {};
export const NoMatch: Story = {
  name: "Nothing matches",
  args: { rows: [], empty: <EmptyState icon={SearchX} className="border-none" title="No returns match these filters" /> },
};

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args, step }) => {
    const c = within(canvasElement);
    await step("sorted by stage; over 7 days in stage turns amber", async () => {
      const rows = c.getAllByRole("row").slice(1);
      await expect(rows[0]).toHaveTextContent("Remy Dovetail");
      await expect(c.getByText("12d")).toHaveClass("text-warning-foreground");
      await expect(c.getByText("3d")).toHaveClass("text-muted-foreground");
    });
    await step("e-file in words; a rejection stands out", async () => {
      await expect(c.getByText("Federal rejected")).toHaveClass("text-danger-foreground");
      await expect(c.getByText("State waiting")).toBeInTheDocument();
    });
    await step("a row opens its return", async () => {
      await userEvent.click(c.getByText("Sidney Kestrel"));
      await expect(args.onOpen).toHaveBeenCalledWith("kestrel");
    });
  },
};
