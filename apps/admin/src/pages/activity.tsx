import type { ActorKind } from "@app/schema";
import type { LucideIcon } from "lucide-react";
import { Activity as ActivityIcon, CreditCard, PenLine, Settings2, User } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import { Link } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { EmptyState } from "@app/ui/components/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { Skeleton } from "@app/ui/components/skeleton";
import { formatDateTime } from "@app/ui/format";

import { Segmented } from "@/components/lists/segmented";
import { dayHeading } from "@/components/lists/when";
import { type RouterOutputs, trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// Activity (admin 30-clients-invoices-and-activity-activity): the practice-wide audit trail, newest
// first, filtered by client, actor and event. Views of client data are hidden unless asked for.

type Item = RouterOutputs["activity"]["list"]["items"][number];
const ACTORS = ["anyone", "client", "preparer", "system", "stripe"] as const;
const ACTOR: Record<ActorKind, { label: string; icon: LucideIcon }> = {
  client: { label: "Client", icon: User },
  preparer: { label: "You", icon: PenLine },
  system: { label: "System", icon: Settings2 },
  stripe: { label: "Stripe", icon: CreditCard },
};
const EVENTS = ["all", "document.", "request.", "letter.", "invoice.", "payment.", "engagement.", "efile.", "settings."] as const;
const EVENT_LABEL: Record<(typeof EVENTS)[number], string> = {
  all: "All events",
  "document.": "Documents",
  "request.": "Requests",
  "letter.": "Letters",
  "invoice.": "Invoices",
  "payment.": "Payments",
  "engagement.": "Returns",
  "efile.": "E-file",
  "settings.": "Settings",
};
const VIEWS = ["hide", "show", "only"] as const;

const WORDS: Record<string, string> = {
  "document.uploaded": "uploaded a document",
  "document.accepted": "accepted a document",
  "document.rejected": "asked for a better copy of a document",
  "document.deleted": "deleted a document",
  "document.purged": "purged a document",
  "document.viewed": "viewed a document",
  "request.created": "asked the client for something",
  "request.answered": "answered a question",
  "request.acknowledged": "marked an answer as read",
  "request.cancelled": "cancelled a request",
  "letter.drafted": "drafted the engagement letter",
  "letter.sent": "sent the engagement letter",
  "letter.viewed": "opened the engagement letter",
  "letter.signed": "signed the engagement letter",
  "letter.voided": "voided the engagement letter",
  "letter.archived": "moved the signed letter's text to the offline record",
  "invoice.created": "created an invoice",
  "invoice.issued": "issued an invoice",
  "invoice.updated": "updated an invoice",
  "invoice.voided": "voided an invoice",
  "payment.recorded": "recorded a payment",
  "payment.pending": "started a payment",
  "payment.succeeded": "received a payment",
  "payment.failed": "reported a failed payment",
  "payment.refunded": "refunded a payment",
  "engagement.created": "started a return",
  "engagement.stage_changed": "moved a return to a new stage",
  "engagement.viewed": "opened a return",
  "engagement.filing_status_set": "set the filing status",
  "engagement.people_set": "set who is on the return",
  "efile.submitted": "submitted the e-file",
  "efile.accepted": "recorded an accepted e-file",
  "efile.rejected": "recorded a rejected e-file",
  "intake.saved": "saved the questionnaire",
  "intake.submitted": "sent in the questionnaire",
  "household.created": "added a client",
  "person.added": "added a person",
  "person.moved": "moved a person to another household",
  "person.contact_updated": "updated their email or phone",
  "person.reminders_updated": "changed their reminder settings",
  "receipt.viewed": "opened a receipt",
  "login.created": "invited someone to the portal",
  "access.granted": "gave portal access",
  "access.revoked": "removed portal access",
  "source.attached": "attached an income source",
  "settings.practice_updated": "updated the practice details",
  "settings.template_published": "published a new letter template",
  "settings.price_created": "added a price",
  "settings.price_updated": "changed a price",
};
const words = (type: string) => WORDS[type] ?? `recorded ${type}`;

export default function Activity() {
  usePageTitle("Activity");
  const [householdId, setHousehold] = useQueryState("client");
  const [actor, setActor] = useQueryState("actor", parseAsStringLiteral(ACTORS).withDefault("anyone"));
  const [event, setEvent] = useQueryState("event", parseAsStringLiteral(EVENTS).withDefault("all"));
  const [views, setViews] = useQueryState("views", parseAsStringLiteral(VIEWS).withDefault("hide"));

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
  const items = React.useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const days = React.useMemo(() => {
    const out: { heading: string; items: Item[] }[] = [];
    for (const i of items) {
      const h = dayHeading(i.occurredAt);
      if (out.at(-1)?.heading !== h) out.push({ heading: h, items: [] });
      out.at(-1)!.items.push(i);
    }
    return out;
  }, [items]);

  return (
    <div className="grid grid-cols-1 animate-page gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={householdId ?? "all"} onValueChange={(v) => void setHousehold(v === "all" ? null : v)}>
          <SelectTrigger className="h-11 w-full sm:w-56 md:h-9" aria-label="Client">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {households.data?.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Segmented
          label="Who did it"
          value={actor}
          onChange={(v) => void setActor(v === "anyone" ? null : v)}
          options={ACTORS.map((a) => ({ value: a, label: a === "anyone" ? "Everyone" : a === "preparer" ? "Preparer" : ACTOR[a].label }))}
        />
        <Select value={event} onValueChange={(v) => void setEvent(v === "all" ? null : (v as (typeof EVENTS)[number]))}>
          <SelectTrigger className="h-11 w-full sm:w-44 md:h-9" aria-label="Event">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENTS.map((e) => (
              <SelectItem key={e} value={e}>
                {EVENT_LABEL[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Segmented
          label="Views of client data"
          value={views}
          onChange={(v) => void setViews(v === "hide" ? null : v)}
          options={[
            { value: "hide", label: "Hide views" },
            { value: "show", label: "With views" },
            { value: "only", label: "Only views" },
          ]}
        />
      </div>

      {!q.data ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading activity">
          <Skeleton className="h-5 w-24" />
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activity" description="Nothing matches these filters. Try Everyone and All events." />
      ) : (
        <>
          {days.map((d) => (
            <section key={d.heading} className="grid gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{d.heading}</h2>
              <ol className="divide-y overflow-hidden rounded-xl border bg-card">
                {d.items.map((i) => {
                  const a = ACTOR[i.actorKind];
                  return (
                    <li key={i.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground" title={a.label}>
                        <a.icon aria-hidden="true" className="size-4" />
                      </span>
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <p className="text-sm">
                          <span className="font-medium">{i.actorName}</span> {words(i.type)}
                        </p>
                        {i.reason ? <p className="text-sm text-muted-foreground">“{i.reason}”</p> : null}
                        <p className="truncate text-sm text-muted-foreground">
                          {i.householdId && i.householdName ? (
                            <Link to={`/clients/${i.householdId}`} className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                              {i.householdName}
                            </Link>
                          ) : (
                            "Practice"
                          )}{" "}
                          · {a.label}
                        </p>
                      </div>
                      <time dateTime={i.occurredAt} className="shrink-0 text-sm whitespace-nowrap text-muted-foreground">
                        {formatDateTime(i.occurredAt)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {q.hasNextPage ? (
            <div className="flex justify-center">
              <Button variant="outline" className="h-11 md:h-9" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
