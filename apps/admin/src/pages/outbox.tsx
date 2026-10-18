import { Mail } from "lucide-react";
import * as React from "react";

import { Banner } from "@app/ui/components/banner";
import { Card, CardContent } from "@app/ui/components/card";
import { EmptyState } from "@app/ui/components/empty-state";
import { Skeleton } from "@app/ui/components/skeleton";
import { formatDateTime } from "@app/ui/format";
import { cn } from "@app/ui/utils";

import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// The outbox (ticket 51): what the practice would have emailed. In dev and the demos nothing is sent; this is where the
// messages land instead, newest first, shown exactly as a client would see them. Live mode with Resend has no outbox.
export default function Outbox() {
  usePageTitle("Outbox");
  const q = trpc.email.outbox.useQuery(undefined, { refetchInterval: 5000 });
  const [chosen, setChosen] = React.useState<string | null>(null);
  const messages = q.data ?? [];
  const shown = messages.find((m) => m.id === chosen) ?? messages[0];

  return (
    <div className="grid grid-cols-1 gap-6">
      <Banner tone="info" title="Nothing here was sent">
        In the demo, the practice's emails stop here instead of going out. In live mode they're sent with Resend.
      </Banner>
      {q.isLoading ? (
        <Skeleton className="h-96 rounded-xl" aria-label="Loading the outbox" />
      ) : !shown ? (
        <EmptyState icon={Mail} title="No emails yet" description="Make an invite or a password reset link and its email shows up here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <ul className="grid content-start divide-y rounded-xl border bg-card" aria-label="Emails">
            {messages.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-current={m.id === shown.id}
                  onClick={() => setChosen(m.id)}
                  className={cn("grid w-full gap-0.5 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", m.id === shown.id && "bg-muted")}
                >
                  <span className="truncate text-sm font-medium">{m.subject}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.to} · {formatDateTime(m.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Card className="min-w-0">
            <CardContent className="grid gap-3">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">To</dt>
                <dd className="break-all">{shown.to}</dd>
                <dt className="text-muted-foreground">From</dt>
                <dd className="break-all">{shown.from}</dd>
                <dt className="text-muted-foreground">Subject</dt>
                <dd>{shown.subject}</dd>
              </dl>
              {/* The email as the client would see it, with scripts and forms off. */}
              <iframe title={`Email: ${shown.subject}`} srcDoc={shown.html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[34rem] w-full rounded-lg border bg-white" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
