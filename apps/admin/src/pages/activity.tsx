import { parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import { Link } from "react-router-dom";

import { ACTIVITY_ACTOR_FILTERS, ACTIVITY_EVENTS, ACTIVITY_VIEWS, ActivityEmpty, ActivityFeed, ActivityFilters, ActivityLoading } from "@app/ui/components/activity-feed";
import { LoadMore } from "@app/ui/components/load-more";

import { dayHeading } from "@/components/lists/when";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// Activity (admin 30-clients-invoices-and-activity-activity): the practice-wide audit trail, newest
// first, filtered by client, actor and event. Views of client data are hidden unless asked for. The screen is
// packages/ui activity-feed; this page fetches, pages and keeps the filters in the URL.

export default function Activity() {
  usePageTitle("Activity");
  const [householdId, setHousehold] = useQueryState("client");
  const [actor, setActor] = useQueryState("actor", parseAsStringLiteral(ACTIVITY_ACTOR_FILTERS).withDefault("anyone"));
  const [event, setEvent] = useQueryState("event", parseAsStringLiteral(ACTIVITY_EVENTS).withDefault("all"));
  const [views, setViews] = useQueryState("views", parseAsStringLiteral(ACTIVITY_VIEWS).withDefault("hide"));

  const households = trpc.household.list.useQuery(undefined, { staleTime: 60_000 });
  const q = trpc.activity.list.useInfiniteQuery(
    {
      householdId: householdId ?? undefined,
      actorKind: actor === "anyone" ? undefined : actor,
      typePrefix: event === "all" ? undefined : event,
      views,
      limit: 50,
    },
    { getNextPageParam: (p) => p.next ?? undefined },
  );
  const items = React.useMemo(() => q.data?.pages.flatMap((p) => p.items).map((i) => ({ ...i, day: dayHeading(i.occurredAt) })) ?? [], [q.data]);
  const clients = React.useMemo(() => households.data?.map((h) => ({ id: h.id, name: h.displayName })) ?? [], [households.data]);

  return (
    <div className="grid grid-cols-1 animate-page gap-4">
      <ActivityFilters
        clients={clients}
        client={householdId}
        onClientChange={(v) => void setHousehold(v)}
        actor={actor}
        onActorChange={(v) => void setActor(v === "anyone" ? null : v)}
        event={event}
        onEventChange={(v) => void setEvent(v === "all" ? null : v)}
        views={views}
        onViewsChange={(v) => void setViews(v === "hide" ? null : v)}
      />

      {!q.data ? (
        <ActivityLoading />
      ) : items.length === 0 ? (
        <ActivityEmpty />
      ) : (
        <>
          <ActivityFeed
            items={items}
            renderLink={(to, children, className) => (
              <Link to={to} className={className}>
                {children}
              </Link>
            )}
          />
          <LoadMore hasMore={!!q.hasNextPage} loading={q.isFetchingNextPage} onLoadMore={() => void q.fetchNextPage()} />
        </>
      )}
    </div>
  );
}
