import type { ActorKind } from "@app/schema";
import type { LucideIcon } from "lucide-react";
import { Activity as ActivityIcon, CreditCard, PenLine, Settings2, User } from "lucide-react";
import * as React from "react";

import { formatDateTime } from "../format";
import type { RenderLink } from "./client-home";
import { EmptyState } from "./empty-state";
import { Segmented } from "./segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Skeleton } from "./skeleton";

// The practice-wide audit trail (admin 30-clients-invoices-and-activity-activity), the pieces apps/admin renders and
// Storybook shows: newest first, grouped by day, filtered by client, actor and event, views of client data hidden
// unless asked for. Data in (the events, the filter values, the words), changes out through callbacks; the app owns
// the query, the paging and the URL.

// ---------- Words ----------

export type ActorStyle = { label: string; icon: LucideIcon };

/** Who did it: the label beside each event and its icon. */
export const ACTIVITY_ACTORS: Record<ActorKind, ActorStyle> = {
  client: { label: "Client", icon: User },
  preparer: { label: "You", icon: PenLine },
  system: { label: "System", icon: Settings2 },
  stripe: { label: "Stripe", icon: CreditCard },
};

/** The "Who did it" filter's options, in order. */
export const ACTIVITY_ACTOR_FILTERS = ["anyone", "client", "preparer", "system", "stripe"] as const;
export type ActivityActorFilter = (typeof ACTIVITY_ACTOR_FILTERS)[number];
export const ACTIVITY_ACTOR_FILTER_LABELS: Record<ActivityActorFilter, string> = { anyone: "Everyone", client: "Client", preparer: "Preparer", system: "System", stripe: "Stripe" };

/** The event filter: a type prefix, or all. */
export const ACTIVITY_EVENTS = ["all", "document.", "request.", "letter.", "invoice.", "payment.", "engagement.", "efile.", "settings."] as const;
export type ActivityEventFilter = (typeof ACTIVITY_EVENTS)[number];
export const ACTIVITY_EVENT_LABELS: Record<ActivityEventFilter, string> = {
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

/** Views of client data: hidden (the default), shown with everything else, or only those. */
export const ACTIVITY_VIEWS = ["hide", "show", "only"] as const;
export type ActivityViewsFilter = (typeof ACTIVITY_VIEWS)[number];
export const ACTIVITY_VIEW_LABELS: Record<ActivityViewsFilter, string> = { hide: "Hide views", show: "With views", only: "Only views" };

/** What each event type says after the actor's name. */
export const ACTIVITY_WORDS: Record<string, string> = {
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

/** An event type in words; one with no words yet says what it recorded. */
export const activityWords = (type: string, words: Record<string, string> = ACTIVITY_WORDS) => words[type] ?? `recorded ${type}`;

// ---------- Filters ----------

export type ActivityFiltersProps = {
  clients: { id: string; name: string }[];
  /** The client shown, or null for all. */
  client: string | null;
  onClientChange: (id: string | null) => void;
  actor: ActivityActorFilter;
  onActorChange: (actor: ActivityActorFilter) => void;
  event: ActivityEventFilter;
  onEventChange: (event: ActivityEventFilter) => void;
  views: ActivityViewsFilter;
  onViewsChange: (views: ActivityViewsFilter) => void;
  allClientsLabel?: string;
  actorLabels?: Record<ActivityActorFilter, string>;
  eventLabels?: Record<ActivityEventFilter, string>;
  viewLabels?: Record<ActivityViewsFilter, string>;
  events?: readonly ActivityEventFilter[];
};

/** Client, who did it, which events, and whether views of client data are in. */
export function ActivityFilters({
  clients,
  client,
  onClientChange,
  actor,
  onActorChange,
  event,
  onEventChange,
  views,
  onViewsChange,
  allClientsLabel = "All clients",
  actorLabels = ACTIVITY_ACTOR_FILTER_LABELS,
  eventLabels = ACTIVITY_EVENT_LABELS,
  viewLabels = ACTIVITY_VIEW_LABELS,
  events = ACTIVITY_EVENTS,
}: ActivityFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={client ?? "all"} onValueChange={(v) => onClientChange(v === "all" ? null : v)}>
        <SelectTrigger className="h-11 w-full sm:w-56 md:h-9" aria-label="Client">
          <SelectValue placeholder={allClientsLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allClientsLabel}</SelectItem>
          {clients.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Segmented label="Who did it" value={actor} onChange={onActorChange} options={ACTIVITY_ACTOR_FILTERS.map((a) => ({ value: a, label: actorLabels[a] }))} />
      <Select value={event} onValueChange={(v) => onEventChange(v as ActivityEventFilter)}>
        <SelectTrigger className="h-11 w-full sm:w-44 md:h-9" aria-label="Event">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {events.map((e) => (
            <SelectItem key={e} value={e}>
              {eventLabels[e]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Segmented label="Views of client data" value={views} onChange={onViewsChange} options={ACTIVITY_VIEWS.map((v) => ({ value: v, label: viewLabels[v] }))} />
    </div>
  );
}

// ---------- States ----------

export function ActivityLoading({ label = "Loading activity" }: { label?: string }) {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label={label}>
      <Skeleton className="h-5 w-24" />
      {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
    </div>
  );
}

export function ActivityEmpty({ title = "No activity", description = "Nothing matches these filters. Try Everyone and All events." }: { title?: string; description?: string }) {
  return <EmptyState icon={ActivityIcon} title={title} description={description} />;
}

// ---------- The feed ----------

/** One event, plus `day`: the heading it goes under ("Today", "Monday, Mar 3"). Consecutive events with the same day share a heading. */
export type ActivityFeedItem = {
  id: string;
  occurredAt: string;
  type: string;
  actorKind: ActorKind;
  actorName: string;
  reason?: string | null;
  householdId?: string | null;
  householdName?: string | null;
  day: string;
};

const anchor: RenderLink = (to, children, className) => (
  <a href={to} className={className}>
    {children}
  </a>
);

export type ActivityFeedProps<T extends ActivityFeedItem> = {
  items: T[];
  /** Where a household's name links to. */
  householdHref?: (householdId: string) => string;
  renderLink?: RenderLink;
  words?: Record<string, string>;
  actors?: Record<ActorKind, ActorStyle>;
  /** What stands in for the household on practice-wide events. */
  practiceLabel?: string;
};

/** The events, a card of rows under each day's heading. */
export function ActivityFeed<T extends ActivityFeedItem>({ items, householdHref = (id) => `/clients/${id}`, renderLink = anchor, words = ACTIVITY_WORDS, actors = ACTIVITY_ACTORS, practiceLabel = "Practice" }: ActivityFeedProps<T>) {
  const days = React.useMemo(() => {
    const out: { heading: string; items: T[] }[] = [];
    for (const i of items) {
      if (out.at(-1)?.heading !== i.day) out.push({ heading: i.day, items: [] });
      out.at(-1)!.items.push(i);
    }
    return out;
  }, [items]);

  return (
    <>
      {days.map((d) => (
        <section key={d.heading} className="grid gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{d.heading}</h2>
          <ol className="divide-y overflow-hidden rounded-xl border bg-card">
            {d.items.map((i) => {
              const a = actors[i.actorKind];
              return (
                <li key={i.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground" title={a.label}>
                    <a.icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="text-sm">
                      <span className="font-medium">{i.actorName}</span> {activityWords(i.type, words)}
                    </p>
                    {i.reason ? <p className="text-sm text-muted-foreground">“{i.reason}”</p> : null}
                    <p className="truncate text-sm text-muted-foreground">
                      {i.householdId && i.householdName
                        ? renderLink(householdHref(i.householdId), i.householdName, "rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50")
                        : practiceLabel}{" "}
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
    </>
  );
}
