import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { BoardCard, BoardColumn } from "../components/board";

// Admin 05-pipeline-pipeline-board. Invented households.
const meta: Meta = { title: "Product/Pipeline board", parameters: { layout: "padded" } };
export default meta;

const onOpen = fn();

export const Board: StoryObj = {
  render: () => (
    <div className="flex gap-3 overflow-x-auto pb-2">
      <BoardColumn stage="documents" count={2}>
        <BoardCard household="Wren" filers="Toni" filingStatus="Single" missingDocuments={3} daysInStage={12} onOpen={() => onOpen("wren")} />
        <BoardCard household="Birchwood" filers="Chris & Taylor" filingStatus="Married filing jointly" missingDocuments={1} daysInStage={3} />
      </BoardColumn>
      <BoardColumn stage="preparing" count={1}>
        <BoardCard household="Marigold" filers="Dana & Sam" filingStatus="Married filing jointly" unpaid daysInStage={4} />
      </BoardColumn>
      <BoardColumn stage="filed" count={1}>
        <BoardCard household="Kestrel" filers="Sidney" filingStatus="Head of household" daysInStage={1} />
      </BoardColumn>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("12 days")).toHaveClass("text-warning-foreground"); // over 7 days: stale
    await expect(c.getByText("4 days")).toHaveClass("text-muted-foreground");
    await userEvent.click(c.getByRole("button", { name: /Wren/ }));
    await expect(onOpen).toHaveBeenCalledWith("wren");
  },
};
