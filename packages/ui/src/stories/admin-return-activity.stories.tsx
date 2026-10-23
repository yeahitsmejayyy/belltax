import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { ReturnActivity, type ReturnEvent } from "../components/return-activity";
import { EVENTS, OLDER_EVENTS } from "./admin-return.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-activity.stories?raw";

// A return's Activity tab (admin 18-return-detail-return-activity), the same component
// apps/admin/src/pages/return/activity-tab.tsx renders: the audit trail, newest first, each event type in words (an
// unknown one shows as itself). The admin pages through activity.list; here a second page arrives after a moment.
const meta: Meta<typeof ReturnActivity> = {
  title: "Admin/Return/ReturnActivity",
  component: ReturnActivity,
  parameters: { usage: 'import { ReturnActivity, RETURN_EVENT_SENTENCES } from "@app/ui/components/return-activity";' },
};
export default meta;
type Story = StoryObj<typeof ReturnActivity>;

function ActivityScreen({ first, more }: { first: ReturnEvent[]; more: ReturnEvent[] }) {
  const [events, setEvents] = useState(first);
  const [loadingMore, setLoadingMore] = useState(false);
  const load = async () => {
    setLoadingMore(true);
    await new Promise((r) => setTimeout(r, 300)); // the server
    setEvents((e) => [...e, ...more]);
    setLoadingMore(false);
  };
  return <ReturnActivity events={events} hasMore={events.length === first.length && more.length > 0} loadingMore={loadingMore} onLoadMore={() => void load()} />;
}

const source = { docs: { source: { code: fnSource(raw, "ActivityScreen") } } };

export const Trail: Story = { render: () => <ActivityScreen first={EVENTS} more={OLDER_EVENTS} />, parameters: source };
export const Loading: Story = { args: { events: [], loading: true } };
export const Empty: Story = { name: "Nothing yet", args: { events: [] } };

export const TrailTest: Story = {
  ...Trail,
  name: "Trail · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("rejected a document")).toBeInTheDocument();
    await expect(c.getByText("“The second page is cut off.”")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Load more" }));
    await expect(await c.findByText("custom.imported")).toBeInTheDocument();
    await expect(c.queryByRole("button", { name: "Load more" })).toBeNull();
  },
};
