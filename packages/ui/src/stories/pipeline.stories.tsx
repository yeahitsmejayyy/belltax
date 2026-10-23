import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Stage } from "@app/schema";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { BoardCard, PipelineBoard } from "../components/board";
import { canMove, cards, stages } from "./pipeline.fixtures";
import fixtures from "./pipeline.fixtures?raw";

// Admin 05-pipeline-pipeline-board. Grab a card anywhere and drop it on another column, or use its ⋯ menu.
// Here a card may go forward one stage or back to any earlier one, as in the admin. The cards, the columns and the
// move rule are all data (./pipeline.fixtures.ts); the Docs page shows each, then how they reach the board.

// The fixtures file, split at its "// --- " headings into the Docs page's code blocks.
const section = (name: string) => fixtures.split(`// --- ${name}\n`)[1]!.split("\n// --- ")[0]!.trim();

const USAGE = `const [cards, setCards] = useState(initialCards);

<PipelineBoard
  cards={cards}
  stages={stages}
  canMove={canMove}
  onOpen={(id) => navigate(\`/returns/\${id}\`)}
  onMove={(id, from, to) => {
    // Update your data; return a promise to hold the card until the server answers.
    setCards((all) => all.map((c) => (c.id === id ? { ...c, stage: to } : c)));
  }}
/>`;

const meta: Meta<typeof PipelineBoard> = {
  title: "Admin/Pipeline/PipelineBoard",
  component: PipelineBoard,
  parameters: {
    fill: true,
    usage: 'import { BoardCard, PipelineBoard, type BoardCardData } from "@app/ui/components/board";',
    snippets: [
      { title: "Cards", description: "One per return: the column it's in and what its card shows.", code: section("Cards") },
      { title: "Columns", description: "Which stages to show, in order. Optional: all eight by default.", code: section("Columns") },
      { title: "Move rule", description: "Where a held card may land. Optional: any other column by default.", code: section("Move rule") },
      { title: "Pass them in", description: "The board is controlled: keep the cards in state and update a card's stage when it moves.", code: USAGE },
    ],
  },
};
export default meta;
type Story = StoryObj;

const onMove = fn();
const onOpen = fn();

// State for the story (the board is controlled); everything drawn is PipelineBoard.
function Board() {
  const [items, setItems] = useState(cards);
  return (
    <PipelineBoard
      cards={items}
      stages={stages}
      onOpen={onOpen}
      canMove={canMove}
      onMove={(id, from, to) => {
        onMove(id, from, to);
        // The admin asks first: forward moves check the stage gates, backward ones ask for a reason.
        setItems((cs) => cs.map((c) => (c.id === id ? { ...c, stage: to, daysInStage: 0 } : c)));
      }}
    />
  );
}

const column = (el: HTMLElement, stage: Stage) => el.querySelector(`[data-slot="board-column"][data-stage="${stage}"]`) as HTMLElement;

export const Draggable: Story = {
  render: () => <Board />,
  parameters: { docs: { source: { code: USAGE } } },
};
export const DraggableTest: Story = {
  ...Draggable,
  name: "Draggable · test",
  tags: ["!dev", "!autodocs"],
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
      c.getByRole("group", { name: "Wren, Documents" }).focus();
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
