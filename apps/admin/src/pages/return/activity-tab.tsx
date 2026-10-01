import { Activity } from "lucide-react";

import { Button } from "@app/ui/components/button";
import { EmptyState } from "@app/ui/components/empty-state";
import { Skeleton } from "@app/ui/components/skeleton";
import { ActivityTimeline } from "@app/ui/components/timeline";

import { trpc } from "@/lib/trpc";

// Activity (admin 18-return-detail-return-activity): this return's audit trail, newest first, without the
// "viewed" reads. Event types become sentences here; an unknown type shows as itself.

const SENTENCE: Record<string, string> = {
  "engagement.created": "started this return",
  "engagement.stage_changed": "moved the return to a new stage",
  "engagement.filing_status_set": "set the filing status",
  "engagement.people_set": "set who's on the return",
  "intake.saved": "saved intake answers",
  "intake.submitted": "submitted the intake questionnaire",
  "request.created": "asked the client for something",
  "request.answered": "answered a question",
  "request.acknowledged": "marked an answer as read",
  "request.cancelled": "cancelled a request",
  "document.uploaded": "uploaded a document",
  "document.accepted": "accepted a document",
  "document.rejected": "rejected a document",
  "document.deleted": "deleted a document",
  "letter.drafted": "drafted the engagement letter",
  "letter.sent": "sent the engagement letter for signature",
  "letter.signed": "signed the engagement letter",
  "letter.voided": "voided the engagement letter",
  "invoice.created": "created an invoice",
  "invoice.updated": "changed an invoice",
  "invoice.issued": "sent an invoice",
  "invoice.voided": "voided an invoice",
  "payment.recorded": "recorded a payment",
  "payment.succeeded": "took a payment",
  "payment.failed": "reported a failed payment",
  "efile.submitted": "recorded an e-file submission",
  "efile.accepted": "recorded an e-file acceptance",
  "efile.rejected": "recorded an e-file rejection",
  "source.attached": "added an income source",
};

export function ActivityTab({ engagementId }: { engagementId: string }) {
  const q = trpc.activity.list.useInfiniteQuery(
    { engagementId, views: "hide", limit: 50 },
    { getNextPageParam: (last) => last.next ?? undefined },
  );

  if (q.isLoading) return <Skeleton className="h-80 max-w-3xl rounded-xl" />;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (!items.length) return <EmptyState icon={Activity} title="Nothing yet" description="Everything that happens on this return is recorded here." />;

  return (
    <div className="grid max-w-3xl gap-4">
      <ActivityTimeline
        items={items.map((e) => ({ id: e.id, at: e.occurredAt, actor: e.actorName, text: SENTENCE[e.type] ?? e.type, reason: e.reason }))}
      />
      {q.hasNextPage ? (
        <Button variant="outline" className="w-fit max-md:h-11" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          {q.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
