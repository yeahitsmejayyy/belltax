import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Stage } from "@app/schema";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { BoardCard, PipelineBoard, type BoardCardData } from "../components/board";

// Admin 05-pipeline-pipeline-board. Grab a card anywhere and drop it on another column, or use its ⋯ menu.
// Here a card may go forward one stage or back to any earlier one, as in the admin. Invented households.
const meta: Meta = { parameters: { fill: true }, title: "Product/Pipeline board" };
export default meta;
type Story = StoryObj;

const START: BoardCardData[] = [
  { id: "wren", stage: "documents", household: "Wren", filers: "Toni", filingStatus: "Single", missingDocuments: 3, daysInStage: 12 },
  { id: "birchwood", stage: "documents", household: "Birchwood", filers: "Chris & Taylor", filingStatus: "Married filing jointly", missingDocuments: 1, daysInStage: 3 },
  { id: "marigold", stage: "preparing", household: "Marigold", filers: "Dana & Sam", filingStatus: "Married filing jointly", unpaid: true, daysInStage: 4 },
  { id: "kestrel", stage: "filed", household: "Kestrel", filers: "Sidney", filingStatus: "Head of household", daysInStage: 1 },
];
const STAGES: Stage[] = ["documents", "ready", "preparing", "review", "filed"];

const onMove = fn();
const onOpen = fn();

function Board() {
  const [cards, setCards] = useState(START);
  return (
    <PipelineBoard
      cards={cards}
      stages={STAGES}
      onOpen={onOpen}
      canMove={(card, to) => {
        const d = STAGES.indexOf(to) - STAGES.indexOf(card.stage);
        return d === 1 || d < 0;
      }}
      onMove={(id, from, to) => {
        onMove(id, from, to);
        // The admin asks first: forward moves check the stage gates, backward ones ask for a reason.
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: to, daysInStage: 0 } : c)));
      }}
    />
  );
}

const column = (el: HTMLElement, stage: Stage) => el.querySelector(`[data-slot="board-column"][data-stage="${stage}"]`) as HTMLElement;

export const Draggable: Story = {
  render: () => <Board />
};
export const DraggableTest: Story = {
  ...Draggable,
  name: "Draggable · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);

    await step("stale cards stand out: over 7 days turns amber", async () => {
      await expect(c.getByText("12 days")).toHaveClass("text-warning-foreground");
      await expect(c.getByText("4 days")).toHaveClass("text-muted-foreground");
    });

    await step("clicking a card opens it", async () => {
      await userEvent.click(c.getByText("Marigold"));
      await expect(onOpen).toHaveBeenCalledWith("marigold");
    });

    await step("keyboard drag: focus the card, Space, → one column, Space", async () => {
      c.getByRole("button", { name: "Wren, Documents" }).focus();
      await userEvent.keyboard(" ");
      await userEvent.keyboard("{ArrowRight}");
      await userEvent.keyboard(" ");
      await expect(onMove).toHaveBeenLastCalledWith("wren", "documents", "ready");
      await waitFor(() => expect(within(column(canvasElement, "ready")).getByText("Wren")).toBeInTheDocument());
    });

    await step("the ⋯ menu moves without dragging (WCAG 2.5.7)", async () => {
      await userEvent.click(c.getByRole("button", { name: "Move Kestrel to…" }));
      // Only where it may go: forward one stage, or back.
      await expect(screen.queryByRole("menuitem", { name: "Filed" })).toBeNull();
      await userEvent.click(await screen.findByRole("menuitem", { name: "Client review" }));
      await expect(onMove).toHaveBeenLastCalledWith("kestrel", "filed", "review");
      await waitFor(() => expect(within(column(canvasElement, "review")).getByText("Kestrel")).toBeInTheDocument());
      await expect(column(canvasElement, "filed")).toHaveAttribute("aria-label", "Filed: 0");
    });
  },
};


// The same card face without drag, for lists and search results.
export const SingleCard: Story = {
  name: "Card",
  render: () => (
    <div className="w-72">
      <BoardCard household="Wren" filers="Toni" filingStatus="Single" missingDocuments={3} unpaid daysInStage={12} />
    </div>
  ),
};
