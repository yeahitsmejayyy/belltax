import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { ActivityEmpty, ActivityFeed, ActivityFilters, ActivityLoading, type ActivityActorFilter, type ActivityEventFilter, type ActivityViewsFilter } from "../components/activity-feed";
import { LoadMore } from "../components/load-more";
import { ACTIVITY_CLIENTS, ACTIVITY_ITEMS } from "./admin-lists.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-activity.stories?raw";

// Activity (admin 30-clients-invoices-and-activity-activity), put together from the same components
// apps/admin/src/pages/activity.tsx renders: the filters, then the events grouped by day. Filtering happens here on
// the invented events the way the server does it. Invented data.
const meta: Meta = { title: "Admin/Activity/ActivityFeed" };
meta.parameters = {
  ...meta.parameters,
  usage: 'import { ActivityEmpty, ActivityFeed, ActivityFilters, ActivityLoading } from "@app/ui/components/activity-feed";',
};
export default meta;
type Story = StoryObj;

function ActivityScreen() {
  const [client, setClient] = useState<string | null>(null);
  const [actor, setActor] = useState<ActivityActorFilter>("anyone");
  const [event, setEvent] = useState<ActivityEventFilter>("all");
  const [views, setViews] = useState<ActivityViewsFilter>("hide");
  const items = ACTIVITY_ITEMS.filter(
    (i) =>
      (!client || i.householdId === client) &&
      (actor === "anyone" || i.actorKind === actor) &&
      (event === "all" || i.type.startsWith(event)) &&
      (views === "show" || (views === "only") === i.type.endsWith(".viewed")),
  );
  return (
    <div className="grid w-[56rem] max-w-full grid-cols-1 animate-page gap-4">
      <ActivityFilters clients={ACTIVITY_CLIENTS} client={client} onClientChange={setClient} actor={actor} onActorChange={setActor} event={event} onEventChange={setEvent} views={views} onViewsChange={setViews} />
      {items.length === 0 ? (
        <ActivityEmpty />
      ) : (
        <>
          <ActivityFeed items={items} householdHref={(id) => `#/clients/${id}`} />
          <LoadMore hasMore loading={false} onLoadMore={() => {}} />
        </>
      )}
    </div>
  );
}

export const Screen: Story = { render: () => <ActivityScreen />, parameters: { docs: { source: { code: fnSource(raw, "ActivityScreen") } } } };
export const Empty: Story = { name: "No activity", render: () => <ActivityEmpty /> };
export const Loading: Story = { render: () => <ActivityLoading /> };
export const LoadingMore: Story = { name: "Loading more", render: () => <LoadMore hasMore loading onLoadMore={() => {}} /> };

export const ScreenTest: Story = {
  ...Screen,
  name: "Screen · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    await expect(c.getByText("“The bottom of the page is cut off.”")).toBeInTheDocument();
    await expect(c.queryByText("opened a return", { exact: false })).toBeNull();
    await expect(c.getAllByRole("link", { name: "Okafor" })[0]).toHaveAttribute("href", "#/clients/hh-okafor");
    await step("Who did it narrows the feed", async () => {
      const who = within(c.getByRole("group", { name: "Who did it" }));
      await userEvent.click(who.getByRole("button", { name: "Stripe" }));
      await expect(c.getByText("received a payment", { exact: false })).toBeInTheDocument();
      await expect(c.queryByText("uploaded a document", { exact: false })).toBeNull();
      await userEvent.click(who.getByRole("button", { name: "Everyone" }));
    });
    await step("Only views shows views of client data and nothing else", async () => {
      await userEvent.click(within(c.getByRole("group", { name: "Views of client data" })).getByRole("button", { name: "Only views" }));
      await expect(c.getByText("opened a return", { exact: false })).toBeInTheDocument();
      await expect(c.queryByText("uploaded a document", { exact: false })).toBeNull();
    });
  },
};
