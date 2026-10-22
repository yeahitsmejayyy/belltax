import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { expect, within, waitFor } from "storybook/test";

import { Button } from "../components/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../components/chart";
import { Money } from "../components/money";
import { HealthCheckRow, StatCard } from "../components/stat-card";

// Admin 03-dashboard-dashboard. Invented numbers.
const meta: Meta = { parameters: { fill: true }, title: "Admin/Dashboard" };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { Button } from \"@app/ui/components/button\";\nimport { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from \"@app/ui/components/chart\";\nimport { Money } from \"@app/ui/components/money\";\nimport { HealthCheckRow, StatCard } from \"@app/ui/components/stat-card\";" };
export default meta;
type Story = StoryObj;

export const Kpis: Story = {
  name: "KPI cards",
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Returns filed" value="6 of 27" progress={22} detail="4 complete · 2 waiting on IRS and FTB" />
      <StatCard label="Collected" value={<Money cents={277000} />} progress={50} detail="of $5,490.00 billed · $2,720.00 outstanding" />
      <StatCard label="Waiting on you" value="18" detail="7 returns to prepare · 11 in Inbox" />
      <StatCard label="Avg. days in stage" value="4.4" detail="6 returns over 7 days" detailTone="warning" />
    </div>
  ),
};

export const HealthChecks: Story = {
  name: "Health checks",
  render: () => (
    <div className="w-full max-w-xl rounded-xl border bg-card px-5">
      <HealthCheckRow tone="danger" title="2 failed payments · $565.00" detail="Dana & Sam Marigold, Remy Dovetail" action={<Button variant="outline" size="sm">Review</Button>} />
      <HealthCheckRow tone="warning" title="6 returns stuck over 7 days" detail="Longest: Toni Wren · 12 days in Documents" action={<Button variant="outline" size="sm">Review</Button>} />
      <HealthCheckRow tone="info" title="11 items waiting in Inbox" detail="Uploads, replies and payment updates to review." action={<Button variant="outline" size="sm">Open</Button>} />
      <HealthCheckRow tone="ok" title="No e-file rejections" detail="All 6 filed returns were accepted or are pending." />
    </div>
  )
};
export const HealthChecksTest: Story = {
  ...HealthChecks,
  name: "Health checks · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll("[data-slot='health-check']");
    await expect(rows).toHaveLength(4);
    for (const r of rows) await expect(r.querySelector("svg[aria-hidden='true']")).not.toBeNull(); // never colour alone
  },
};


const weekly = [
  { week: "Feb 2", thisYear: 0, lastYear: 1 },
  { week: "Feb 9", thisYear: 1, lastYear: 2 },
  { week: "Feb 16", thisYear: 2, lastYear: 3 },
  { week: "Feb 23", thisYear: 1, lastYear: 2 },
  { week: "Mar 2", thisYear: 2, lastYear: 2 },
];
const config: ChartConfig = {
  thisYear: { label: "This season", color: "var(--chart-1)" },
  lastYear: { label: "Last season", color: "var(--chart-5)" },
};

export const FilingsPerWeek: Story = {
  name: "Chart: filings per week",
  render: () => (
    <div className="w-full max-w-xl rounded-xl border bg-card p-5">
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={weekly} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="lastYear" fill="var(--color-lastYear)" radius={4} />
          <Bar dataKey="thisYear" fill="var(--color-thisYear)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
};
export const FilingsPerWeekTest: Story = {
  ...FilingsPerWeek,
  name: "Chart: filings per week · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    // Recharts draws after it measures its box, which can take a frame or two on a slower runner (Chromatic): wait.
    await expect(await within(canvasElement).findByText("This season", {}, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => expect(canvasElement.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThan(0), { timeout: 5000 });
  },
};

