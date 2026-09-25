import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";

import { Avatar, AvatarFallback } from "../components/avatar";
import { Badge } from "../components/badge";
import { ModeToggle } from "../components/mode-toggle";
import { Money } from "../components/money";
import { Progress } from "../components/progress";
import { Separator } from "../components/separator";
import { Skeleton } from "../components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/table";
import { ThemeProvider } from "../components/theme-provider";
import { formatDate, formatDateTime } from "../format";

const meta: Meta = { title: "Primitives/Display", parameters: { layout: "padded" } };
export default meta;
type Story = StoryObj;

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>27</Badge>
      <Badge variant="secondary">Married filing jointly</Badge>
      <Badge variant="outline">TY 2026</Badge>
      <Badge variant="destructive">3</Badge>
    </div>
  ),
};

export const Avatars: Story = {
  render: () => (
    <div className="flex gap-2">
      {["PB", "DM", "SK"].map((i) => (
        <Avatar key={i}><AvatarFallback className="bg-brand-subtle text-brand-subtle-foreground">{i}</AvatarFallback></Avatar>
      ))}
    </div>
  ),
};

// Admin 02-access-loading: skeletons while a page or tax year loads.
export const Loading: Story = {
  name: "Skeleton",
  render: () => (
    <div className="grid max-w-md gap-3" aria-busy="true" aria-label="Loading returns">
      <Skeleton className="h-8 w-1/2" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  ),
};

export const ProgressBar: Story = {
  name: "Progress",
  render: () => (
    <div className="grid max-w-md gap-2">
      <span className="text-sm">TY 2026 season · day 39 of 79</span>
      <Progress value={49} aria-label="Season progress" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("progressbar", { name: "Season progress" })).toHaveAttribute("aria-valuenow", "49");
  },
};

export const Divider: Story = {
  name: "Separator",
  render: () => (
    <div className="max-w-sm text-sm">
      <p>Federal return</p>
      <Separator className="my-3" />
      <p>California return</p>
    </div>
  ),
};

export const PlainTable: Story = {
  name: "Table",
  render: () => (
    <Table aria-label="Invoice lines">
      <TableHeader><TableRow><TableHead>Line</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
      <TableBody>
        <TableRow><TableCell>Married filing jointly package</TableCell><TableCell className="text-right"><Money cents={34000} /></TableCell></TableRow>
        <TableRow><TableCell>Side work or gig income</TableCell><TableCell className="text-right"><Money cents={8500} /></TableCell></TableRow>
        <TableRow><TableCell className="font-medium">Total</TableCell><TableCell className="text-right font-medium"><Money cents={42500} /></TableCell></TableRow>
      </TableBody>
    </Table>
  ),
};

// One way to show money and time everywhere.
export const MoneyAndDates: Story = {
  name: "Money and dates",
  render: () => (
    <dl className="grid max-w-sm grid-cols-2 gap-2 text-sm">
      <dt className="text-muted-foreground">Collected</dt><dd><Money cents={277000} /></dd>
      <dt className="text-muted-foreground">Outstanding</dt><dd><Money cents={272000} /></dd>
      <dt className="text-muted-foreground">Signed</dt><dd>{formatDateTime("2026-09-23T17:04:00.000Z")}</dd>
      <dt className="text-muted-foreground">Due</dt><dd>{formatDate("2026-10-15T12:00:00.000Z")}</dd>
    </dl>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("$2,770.00")).toBeInTheDocument();
  },
};

export const ThemeSwitch: Story = {
  name: "Mode toggle",
  render: () => (
    <ThemeProvider storageKey="btp-storybook-mode-toggle">
      <ModeToggle />
    </ThemeProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(await screen.findByRole("menuitem", { name: /dark/i })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  },
};
