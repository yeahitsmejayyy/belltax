import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox, UserPlus } from "lucide-react";
import { expect, within } from "storybook/test";

import { Banner } from "../components/banner";
import { Button } from "../components/button";
import { EmptyState } from "../components/empty-state";
import { PageHeader, SectionHeader } from "../components/page-header";
import { SplitButton } from "../components/split-button";

const meta: Meta = { title: "Product/Layout", parameters: { layout: "padded" } };
export default meta;
type Story = StoryObj;

export const Headers: Story = {
  render: () => (
    <div className="grid gap-8">
      <PageHeader
        title="Pipeline"
        description="Every return for tax year 2026, by stage."
        action={<SplitButton label={<><UserPlus /> Invite client</>} onClick={() => {}} items={[{ label: "Add client without invite", onSelect: () => {} }]} />}
      />
      <SectionHeader title="Returns by stage" description="Click a stage to open it in the pipeline." action={<Button variant="outline" size="sm">View all</Button>} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading", { level: 1 })).toHaveTextContent("Pipeline");
  },
};

// Admin 08-pipeline-empty and 11-inbox-empty.
export const Empty: Story = {
  name: "Empty states",
  render: () => (
    <div className="grid gap-6 md:grid-cols-2">
      <EmptyState icon={UserPlus} title="Start the season" description="No returns for 2026 yet. Invite your first client and they'll show up here." action={<Button>Invite your first client</Button>} />
      <EmptyState icon={Inbox} title="All caught up" description="Nothing waiting on you. New uploads and replies land here." />
    </div>
  ),
};

// Portal 07 (offline), portal 18 and admin 17 (payment failed).
export const Banners: Story = {
  render: () => (
    <div className="grid max-w-xl gap-3">
      <Banner tone="offline" title="You're offline">Your answers are saved on this phone and will send when you're back.</Banner>
      <Banner tone="danger" title="Your payment didn't go through" action={<Button size="sm">Try again</Button>}>The card was declined. Nothing was charged.</Banner>
      <Banner tone="warning" title="One document needs a better copy">The W-2 from Harbor Freight Logistics is cut off at the bottom.</Banner>
      <Banner tone="info" title="Filed, waiting on the IRS and FTB">They usually accept within 48 hours.</Banner>
      <Banner tone="success" title="Letter signed">Thanks, Dana. A copy is in your documents.</Banner>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("alert")).toHaveTextContent("Your payment didn't go through"); // only the failure interrupts
    await expect(c.getAllByRole("status")).toHaveLength(4);
  },
};
