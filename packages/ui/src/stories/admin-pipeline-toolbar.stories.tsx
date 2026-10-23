import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Stage } from "@app/schema";
import { useState } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { PipelineToolbar, type PipelineView } from "../components/pipeline";
import { ROWS } from "./admin-pipeline.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-pipeline-toolbar.stories?raw";

// The pipeline's toolbar (admin 05-pipeline-board, 07-pipeline-stale, 35-phone-m-pipeline): view switch, name search,
// stage and three quick filters with counts, and how many returns are shown. On phones the stage and the filters fold
// into a Filters popover. Controlled: the admin keeps the filters in the URL; here they're state. Invented households.
const meta: Meta<typeof PipelineToolbar> = {
  title: "Admin/Pipeline/PipelineToolbar",
  component: PipelineToolbar,
  parameters: { fill: true, usage: 'import { PipelineToolbar, type PipelineChip } from "@app/ui/components/pipeline";' },
};
export default meta;
type Story = StoryObj<typeof PipelineToolbar>;

const changed = fn();

function Toolbar() {
  const [view, setView] = useState<PipelineView>("board");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [missing, setMissing] = useState(false);
  const [unpaid, setUnpaid] = useState(false);
  const [stale, setStale] = useState(false);
  const shown = ROWS.filter(
    (r) =>
      r.household.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!stage || r.stage === stage) &&
      (!missing || r.openRequests > 0) &&
      (!unpaid || r.balanceCents > 0) &&
      (!stale || r.daysInStage > 7),
  );
  return (
    <PipelineToolbar
      view={view}
      onViewChange={(v) => (changed("view", v), setView(v))}
      query={query}
      onQueryChange={setQuery}
      stage={stage}
      onStageChange={(s) => (changed("stage", s), setStage(s))}
      chips={[
        { id: "missing", label: "Missing documents", on: missing, count: ROWS.filter((r) => r.openRequests > 0).length, onToggle: () => setMissing(!missing) },
        { id: "unpaid", label: "Unpaid", on: unpaid, count: ROWS.filter((r) => r.balanceCents > 0).length, onToggle: () => setUnpaid(!unpaid) },
        { id: "stale", label: "Over 7 days in stage", on: stale, count: ROWS.filter((r) => r.daysInStage > 7).length, onToggle: () => setStale(!stale) },
      ]}
      onClear={() => {
        setQuery("");
        setStage(null);
        setMissing(false);
        setUnpaid(false);
        setStale(false);
      }}
      total={ROWS.length}
      shown={shown.length}
    />
  );
}

export const Default: Story = { render: () => <Toolbar />, parameters: { docs: { source: { code: fnSource(raw, "Toolbar") } } } };
export const Phone: Story = { ...Default, name: "Phone (402)", globals: { viewport: { value: "phone", isRotated: false } } };

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const status = () => canvasElement.querySelector("[aria-live='polite']")!;
    await expect(status()).toHaveTextContent("6 returns");

    await step("the view switch: one pressed at a time", async () => {
      await userEvent.click(c.getByRole("button", { name: "Table" }));
      await expect(changed).toHaveBeenLastCalledWith("view", "table");
      await expect(c.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
      await expect(c.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "false");
    });

    await step("a quick filter presses and narrows the count", async () => {
      const unpaid = c.getAllByRole("button", { name: "Unpaid · 2" })[0]!;
      await userEvent.click(unpaid);
      await expect(unpaid).toHaveAttribute("aria-pressed", "true");
      await expect(status()).toHaveTextContent("2 of 6 returns");
    });

    await step("search by name, then Clear turns everything off", async () => {
      await userEvent.type(c.getByRole("searchbox", { name: "Search by name" }), "dove");
      await expect(status()).toHaveTextContent("1 of 6 returns");
      await userEvent.click(c.getByRole("button", { name: "Clear" }));
      await expect(status()).toHaveTextContent("6 returns");
      await expect(c.getByRole("searchbox", { name: "Search by name" })).toHaveValue("");
    });

    await step("the stage filter", async () => {
      await userEvent.click(c.getAllByRole("combobox", { name: "Stage" })[0]!);
      await userEvent.click(await screen.findByRole("option", { name: "Filed" }));
      await expect(changed).toHaveBeenLastCalledWith("stage", "filed");
      await expect(status()).toHaveTextContent("2 of 6 returns");
    });
  },
};
