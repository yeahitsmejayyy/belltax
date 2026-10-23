import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { HealthChecksCard, type HealthCheck } from "../components/dashboard";

// Things that need a look before they turn into problems (admin 03-dashboard-dashboard). Each check is data: its tone,
// what it found, and a button when there's something to look at (`action`). Invented households.
const review = fn();
const CHECKS: HealthCheck[] = [
  { key: "failed_payments", tone: "danger", title: "2 failed payments · $565.00", detail: "Dana & Sam Marigold, Remy Dovetail", action: { label: "Review", onClick: () => review("failed_payments") } },
  { key: "stale_returns", tone: "warning", title: "6 returns stuck over 7 days", detail: "Longest: Toni Wren · 12 days in Documents", action: { label: "Review", onClick: () => review("stale_returns") } },
  { key: "inbox", tone: "info", title: "11 items waiting in Inbox", detail: "Uploads, replies and payment updates to review.", action: { label: "Open", onClick: () => review("inbox") } },
  { key: "efile_rejections", tone: "ok", title: "No e-file rejections", detail: "All 6 filed returns were accepted or are pending." },
];

const meta: Meta<typeof HealthChecksCard> = {
  title: "Admin/Dashboard/HealthChecksCard",
  component: HealthChecksCard,
  parameters: { usage: 'import { HealthChecksCard, type HealthCheck } from "@app/ui/components/dashboard";' },
  decorators: [(Story) => <div className="w-[36rem] max-w-full">{Story()}</div>],
  args: { checks: CHECKS, needAttention: 2 },
};
export default meta;
type Story = StoryObj<typeof HealthChecksCard>;

export const Default: Story = {};
export const AllClear: Story = { name: "All clear", args: { needAttention: 0, checks: [CHECKS[3]!] } };

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll("[data-slot='health-check']");
    await expect(rows).toHaveLength(4);
    for (const r of rows) await expect(r.querySelector("svg[aria-hidden='true']")).not.toBeNull(); // never colour alone
    await expect(within(canvasElement).getByText("2 need attention")).toBeInTheDocument();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open" }));
    await expect(review).toHaveBeenCalledWith("inbox");
  },
};
