import type { InboxItem } from "@app/schema";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { INBOX_KINDS, InboxEmpty, InboxFilteredEmpty, InboxFilters, InboxHeader, InboxList, InboxLoading } from "@app/ui/components/inbox-list";

import { shortWhen } from "@/components/lists/when";
import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// The Inbox (admin 10-inbox-inbox, 11-inbox-inbox-empty, 36-phone-m-inbox): everything waiting on the
// preparer, newest first, one inline action each. The screens are packages/ui inbox-list; this page fetches, acts
// and routes.

export default function Inbox() {
  usePageTitle("Inbox");
  const navigate = useNavigate();
  const { taxYear } = useTaxYear();
  const [kind, setKind] = useQueryState("kind", parseAsStringLiteral(INBOX_KINDS));
  const q = trpc.inbox.list.useQuery(taxYear ? { taxYear } : undefined, { enabled: !!taxYear });
  const utils = trpc.useUtils();
  const acknowledge = trpc.request.acknowledge.useMutation({
    onSuccess: () => {
      toast.success("Marked as read");
      void utils.invalidate();
    },
  });

  const items = React.useMemo(() => (q.data?.items ?? []).filter((i) => !kind || i.kind === kind).map((i) => ({ ...i, when: shortWhen(i.at) })), [q.data, kind]);

  const run = React.useCallback(
    (i: InboxItem) => {
      const r = `/returns/${i.engagementId}`;
      if (i.action === "review_document") navigate(`${r}/documents`);
      else if (i.action === "acknowledge_answer") acknowledge.mutate({ requestId: i.subjectId });
      else if (i.action === "follow_up_payment") navigate(`${r}/billing`);
      else navigate(r);
    },
    [navigate, acknowledge],
  );

  if (!q.data || !taxYear) return <InboxLoading />;

  const d = q.data;
  if (d.total === 0) return <InboxEmpty />;

  return (
    <div className="grid grid-cols-1 animate-page gap-4">
      <InboxHeader total={d.total} />
      <InboxFilters total={d.total} counts={d.counts} value={kind} onChange={(k) => void setKind(k)} />
      {items.length === 0 ? (
        <InboxFilteredEmpty onShowAll={() => void setKind(null)} />
      ) : (
        <InboxList items={items} onRun={run} pending={(i) => acknowledge.isPending && acknowledge.variables?.requestId === i.subjectId} />
      )}
    </div>
  );
}
