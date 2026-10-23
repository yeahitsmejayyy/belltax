import { Mail } from "lucide-react";
import * as React from "react";

import { formatDateTime } from "../format";
import { cn } from "../utils";
import { Banner } from "./banner";
import { Card, CardContent } from "./card";
import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";

// The admin's Outbox (ticket 51), the pieces apps/admin renders and Storybook shows: what the practice would have
// emailed in dev and the demos, newest first, each shown exactly as a client would see it. Data in (the messages),
// the choice of message kept here unless the app controls it; the app owns the query.

export type OutboxMessage = { id: string; at: string; to: string; from: string; subject: string; html: string };

/** The note above the list: none of this went out. */
export function OutboxNotice({ title = "Nothing here was sent", children = "In the demo, the practice's emails stop here instead of going out. In live mode they're sent with Resend." }: { title?: string; children?: React.ReactNode }) {
  return (
    <Banner tone="info" title={title}>
      {children}
    </Banner>
  );
}

export function OutboxLoading({ label = "Loading the outbox" }: { label?: string }) {
  return <Skeleton className="h-96 rounded-xl" aria-label={label} />;
}

export function OutboxEmpty({ title = "No emails yet", description = "Make an invite or a password reset link and its email shows up here." }: { title?: string; description?: string }) {
  return <EmptyState icon={Mail} title={title} description={description} />;
}

/** The messages, one button each; the chosen one is marked by fill and aria-current. */
export function OutboxList({ messages, selectedId, onSelect, label = "Emails" }: { messages: OutboxMessage[]; selectedId: string; onSelect: (id: string) => void; label?: string }) {
  return (
    <ul className="grid content-start divide-y rounded-xl border bg-card" aria-label={label}>
      {messages.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            aria-current={m.id === selectedId}
            onClick={() => onSelect(m.id)}
            className={cn("grid w-full gap-0.5 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", m.id === selectedId && "bg-muted")}
          >
            <span className="truncate text-sm font-medium">{m.subject}</span>
            <span className="truncate text-xs text-muted-foreground">
              {m.to} · {formatDateTime(m.at)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One message: To, From and Subject, then the email itself in a sandboxed frame (scripts and forms off). */
export function OutboxPreview({ message }: { message: OutboxMessage }) {
  return (
    <Card className="min-w-0">
      <CardContent className="grid gap-3">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">To</dt>
          <dd className="break-all">{message.to}</dd>
          <dt className="text-muted-foreground">From</dt>
          <dd className="break-all">{message.from}</dd>
          <dt className="text-muted-foreground">Subject</dt>
          <dd>{message.subject}</dd>
        </dl>
        <iframe title={`Email: ${message.subject}`} srcDoc={message.html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[34rem] w-full rounded-lg border bg-white" />
      </CardContent>
    </Card>
  );
}

export type OutboxViewProps = {
  messages: OutboxMessage[];
  /** The message shown. Left out, the view keeps its own choice, starting with the newest. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

/** The list beside the chosen message (stacked below lg). With no messages it says so. */
export function OutboxView({ messages, selectedId, onSelect }: OutboxViewProps) {
  const [own, setOwn] = React.useState<string | null>(null);
  const chosen = selectedId === undefined ? own : selectedId;
  const shown = messages.find((m) => m.id === chosen) ?? messages[0];
  if (!shown) return <OutboxEmpty />;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <OutboxList
        messages={messages}
        selectedId={shown.id}
        onSelect={(id) => {
          setOwn(id);
          onSelect?.(id);
        }}
      />
      <OutboxPreview message={shown} />
    </div>
  );
}
