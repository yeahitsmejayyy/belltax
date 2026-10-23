import { ReturnActivity } from "@app/ui/components/return-activity";

import { trpc } from "@/lib/trpc";

// Activity (admin 18-return-detail-return-activity): this return's audit trail, newest first, without the "viewed"
// reads. The tab is ReturnActivity from the design system (it words the event types); this does the paging.

export function ActivityTab({ engagementId }: { engagementId: string }) {
  const q = trpc.activity.list.useInfiniteQuery(
    { engagementId, views: "hide", limit: 50 },
    { getNextPageParam: (last) => last.next ?? undefined },
  );
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <ReturnActivity
      events={items.map((e) => ({ id: e.id, type: e.type, actor: e.actorName, at: e.occurredAt, reason: e.reason }))}
      loading={q.isLoading}
      hasMore={q.hasNextPage}
      loadingMore={q.isFetchingNextPage}
      onLoadMore={() => void q.fetchNextPage()}
    />
  );
}
