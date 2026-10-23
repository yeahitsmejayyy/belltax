import { Activity } from "lucide-react";

import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";
import { ActivityTimeline } from "./timeline";

// A return's Activity tab (admin 18-return-detail-return-activity), the piece apps/admin renders and Storybook shows
// (ticket 59): its audit trail, newest first. Event types become sentences through `sentences` (RETURN_EVENT_SENTENCES
// by default); an unknown type shows as itself. The app does the paging and leaves out the "viewed" reads.

export const RETURN_EVENT_SENTENCES: Record<string, string> = {
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

/** One event: who, what (its type), when, and the reason given, if any. */
export type ReturnEvent = { id: string; type: string; actor: string; at: string; reason?: string | null };

export type ReturnActivityProps = {
  events: readonly ReturnEvent[];
  /** The first page is still loading. */
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  sentences?: Record<string, string>;
};

/** The Activity tab. */
export function ReturnActivity({ events, loading = false, hasMore = false, loadingMore = false, onLoadMore, sentences = RETURN_EVENT_SENTENCES }: ReturnActivityProps) {
  if (loading) return <Skeleton className="h-80 max-w-3xl rounded-xl" />;
  if (!events.length) return <EmptyState icon={Activity} title="Nothing yet" description="Everything that happens on this return is recorded here." />;

  return (
    <div className="grid max-w-3xl gap-4">
      <ActivityTimeline items={events.map((e) => ({ id: e.id, at: e.at, actor: e.actor, text: sentences[e.type] ?? e.type, reason: e.reason }))} />
      {hasMore ? (
        <Button variant="outline" className="w-fit max-md:h-11" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
