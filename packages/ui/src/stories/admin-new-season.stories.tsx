import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { NewSeasonPage, RolloverReportCard, type RolloverReport, type SeasonPreview } from "../components/new-season";
import { EMPTY_PREVIEW, PREVIEW, REPORT } from "./admin-clients.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-new-season.stories?raw";

// New season in the preparer admin, the same component apps/admin/src/pages/season.tsx renders: pick the year, see
// what rolls over, confirm once, read what happened. The rollover is simulated here; the app runs season.rollover.
// Invented data.
const meta: Meta = { title: "Admin/Season/NewSeasonPage" };
meta.parameters = { ...meta.parameters, usage: 'import { NewSeasonPage } from "@app/ui/components/new-season";' };
export default meta;
type Story = StoryObj;

const rolledOver = fn();
const PREVIEWS: Record<number, SeasonPreview> = { 2026: PREVIEW, 2023: EMPTY_PREVIEW };

function SeasonScreen() {
  const [fromYear, setFromYear] = useState(2026);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<RolloverReport | null>(null);
  const run = () => {
    setPending(true);
    rolledOver(fromYear);
    setTimeout(() => {
      setReport(REPORT);
      setPending(false);
      setConfirm(false);
    }, 400);
  };
  return (
    <NewSeasonPage
      years={[2026, 2025, 2024, 2023]}
      fromYear={fromYear}
      onFromYearChange={(y) => {
        setFromYear(y);
        setReport(null);
      }}
      preview={PREVIEWS[fromYear] ?? { fromYear, toYear: fromYear + 1, items: PREVIEW.items }}
      report={report}
      confirmOpen={confirm}
      onConfirmOpenChange={setConfirm}
      onRollover={run}
      pending={pending}
    />
  );
}

const noop = () => {};

export const Screen: Story = { render: () => <SeasonScreen />, parameters: { docs: { source: { code: fnSource(raw, "SeasonScreen") } } } };
export const NothingToRoll: Story = {
  name: "Nothing to roll over",
  render: () => <NewSeasonPage years={[2023]} fromYear={2023} onFromYearChange={noop} preview={EMPTY_PREVIEW} confirmOpen={false} onConfirmOpenChange={noop} onRollover={noop} />,
};
export const Loading: Story = { render: () => <NewSeasonPage years={[2026]} fromYear={2026} onFromYearChange={noop} confirmOpen={false} onConfirmOpenChange={noop} onRollover={noop} /> };
export const Failed: Story = {
  name: "Rollover didn't run",
  render: () => (
    <NewSeasonPage years={[2026]} fromYear={2026} onFromYearChange={noop} preview={PREVIEW} error="The database is read-only right now." confirmOpen={false} onConfirmOpenChange={noop} onRollover={noop} />
  ),
};
export const Report: Story = { name: "Rollover report", render: () => <RolloverReportCard report={REPORT} /> };

export const ScreenTest: Story = {
  ...Screen,
  name: "Screen · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByText("2 returns will roll into TY 2027 · 1 skipped")).toBeInTheDocument();
    await step("the confirm says what will happen and runs it once", async () => {
      await userEvent.click(c.getByRole("button", { name: "Open TY 2027 for 2 returns" }));
      const dialog = within(await screen.findByRole("alertdialog", { name: "Open TY 2027 for 2 returns?" }));
      await expect(dialog.getByText(/1 will be skipped\./)).toBeInTheDocument();
      await userEvent.click(dialog.getByRole("button", { name: "Open TY 2027" }));
      await expect(dialog.getByRole("button", { name: "Opening…" })).toBeDisabled();
      await expect(rolledOver).toHaveBeenCalledWith(2026);
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    });
    await step("the report lists what was created, skipped and failed", async () => {
      await expect(c.getByText("TY 2027 is open")).toBeInTheDocument();
      await expect(c.getByText("2 returns created · 1 skipped · 1 failed")).toBeInTheDocument();
      await expect(c.getAllByRole("link", { name: "Kestrel household" }).map((a) => a.getAttribute("href"))).toEqual(["/returns/e-kestrel-2027", "/clients/hh-kestrel"]);
      await expect(c.getByText("1 return didn't roll over")).toBeInTheDocument();
    });
  },
};
