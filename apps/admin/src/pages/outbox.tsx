import { OutboxEmpty, OutboxLoading, OutboxNotice, OutboxView } from "@app/ui/components/outbox";

import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// The outbox (ticket 51): what the practice would have emailed. In dev and the demos nothing is sent; this is where the
// messages land instead, newest first, shown exactly as a client would see them. Live mode with Resend has no outbox.
// The screen is packages/ui outbox; this page fetches.
export default function Outbox() {
  usePageTitle("Outbox");
  const q = trpc.email.outbox.useQuery(undefined, { refetchInterval: 5000 });
  const messages = q.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-6">
      <OutboxNotice />
      {q.isLoading ? <OutboxLoading /> : !messages.length ? <OutboxEmpty /> : <OutboxView messages={messages} />}
    </div>
  );
}
