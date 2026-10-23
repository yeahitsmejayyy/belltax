import type { InboxItem, InboxKind } from "@app/schema";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Clock, FileX2, Inbox as InboxIcon, MessageSquare, PenLine, Upload } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";

// The preparer's Inbox (admin 10-inbox-inbox, 11-inbox-inbox-empty, 36-phone-m-inbox), the pieces apps/admin renders
// and Storybook shows: everything waiting on the preparer, newest first, one inline action each. j/k or ↑/↓ move,
// Enter runs the action. Data in (items, counts, the kind filter), actions out through `onRun` and `onKindChange`; the
// app owns the query, the mutation, the toasts, the URL and where each action goes.

/** The kinds in the order the filter chips show them. */
export const INBOX_KINDS = ["document_review", "question_answered", "letter_signed", "payment_failed", "efile_rejected", "stale"] as const satisfies readonly InboxKind[];

export type InboxKindStyle = { label: string; icon: LucideIcon; tint: string };

/** Each kind's chip label, row icon and icon tint. */
export const INBOX_KIND_STYLES: Record<InboxKind, InboxKindStyle> = {
  document_review: { label: "Documents", icon: Upload, tint: "bg-brand-subtle text-brand-subtle-foreground" },
  question_answered: { label: "Answers", icon: MessageSquare, tint: "bg-muted text-foreground" },
  letter_signed: { label: "Signed letters", icon: PenLine, tint: "bg-muted text-foreground" },
  payment_failed: { label: "Failed payments", icon: AlertCircle, tint: "bg-danger-subtle text-danger-foreground" },
  efile_rejected: { label: "E-file rejections", icon: FileX2, tint: "bg-danger-subtle text-danger-foreground" },
  stale: { label: "Stale returns", icon: Clock, tint: "bg-warning-subtle text-warning-foreground" },
};

/** The words on each row's action button. */
export const INBOX_ACTION_LABELS: Record<InboxItem["action"], string> = {
  review_document: "Review",
  acknowledge_answer: "Mark read",
  advance_stage: "Open",
  follow_up_payment: "Open billing",
  resubmit_efile: "Open return",
  open_return: "Open",
};

/** One row: the item as the server sends it, plus `when`, its time already worded for a list ("2:14 PM", "Yesterday"). */
export type InboxRowItem = Pick<InboxItem, "id" | "kind" | "at" | "householdName" | "taxYear" | "summary" | "action"> & { when: string };

// ---------- States ----------

/** While the inbox loads: the heading, the filter row and five rows. */
export function InboxLoading({ label = "Loading the inbox" }: { label?: string }) {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label={label}>
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-9 w-full max-w-2xl" />
      <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
    </div>
  );
}

/** Nothing waiting at all. */
export function InboxEmpty({ title = "All caught up", description = "New uploads, answers, signed letters and failed payments land here.", className = "animate-page" }: { title?: string; description?: string; className?: string }) {
  return <EmptyState icon={InboxIcon} title={title} description={description} className={className} />;
}

/** Items exist, but none of the chosen kind. */
export function InboxFilteredEmpty({ onShowAll, title = "Nothing of this kind", description = "Everything else is still in the Inbox.", showAllLabel = "Show everything" }: { onShowAll: () => void; title?: string; description?: string; showAllLabel?: string }) {
  return <EmptyState icon={InboxIcon} title={title} description={description} action={<Button variant="outline" onClick={onShowAll}>{showAllLabel}</Button>} />;
}

// ---------- Heading and filters ----------

/** "12 waiting for review", with the keyboard hint beside it from md up. */
export function InboxHeader({ total, title = (n) => `${n} waiting for review` }: { total: number; title?: (total: number) => React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-medium">{title(total)}</h2>
      <p className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex" aria-hidden="true">
        <kbd className="rounded border px-1.5 font-mono">j</kbd>
        <kbd className="rounded border px-1.5 font-mono">k</kbd> move
        <kbd className="ml-2 rounded border px-1.5 font-mono">↵</kbd> open
      </p>
    </div>
  );
}

/** A pill-shaped toggle (the Inbox's kind chips). */
export function FilterChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-8",
        pressed && "border-foreground/20 bg-muted font-medium text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export type InboxFiltersProps = {
  total: number;
  /** How many items of each kind; kinds with none get no chip. */
  counts: Partial<Record<InboxKind, number>>;
  /** The kind shown, or null for all. */
  value: InboxKind | null;
  /** Pressing the pressed chip again goes back to all (null). */
  onChange: (kind: InboxKind | null) => void;
  kinds?: readonly InboxKind[];
  styles?: Record<InboxKind, InboxKindStyle>;
  label?: string;
  allLabel?: string;
};

/** "All 12", then a chip per kind that has anything waiting. */
export function InboxFilters({ total, counts, value, onChange, kinds = INBOX_KINDS, styles = INBOX_KIND_STYLES, label = "Show", allLabel = "All" }: InboxFiltersProps) {
  return (
    <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      <FilterChip pressed={!value} onClick={() => onChange(null)}>
        {allLabel} <span className="tabular-nums">{total}</span>
      </FilterChip>
      {kinds.filter((k) => counts[k]).map((k) => {
        const Icon = styles[k].icon;
        return (
          <FilterChip key={k} pressed={value === k} onClick={() => onChange(value === k ? null : k)}>
            <Icon aria-hidden="true" className="size-3.5" />
            {styles[k].label} <span className="tabular-nums">{counts[k]}</span>
          </FilterChip>
        );
      })}
    </div>
  );
}

// ---------- The list ----------

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.getAttribute("role") === "combobox");

export type InboxListProps<T extends InboxRowItem> = {
  items: T[];
  /** The row's button, or Enter on a focused row. */
  onRun: (item: T) => void;
  /** True while this row's action is in flight (its button is disabled). */
  pending?: (item: T) => boolean;
  styles?: Record<InboxKind, InboxKindStyle>;
  actionLabels?: Record<InboxItem["action"], string>;
  /** The line under the summary. */
  context?: (item: T) => React.ReactNode;
};

/** The rows, newest first. j/k or ↑/↓ move between rows anywhere on the page (not while typing); Enter runs the focused row. */
export function InboxList<T extends InboxRowItem>({ items, onRun, pending, styles = INBOX_KIND_STYLES, actionLabels = INBOX_ACTION_LABELS, context = (i) => `${i.householdName} household · TY ${i.taxYear}` }: InboxListProps<T>) {
  const rows = React.useRef<(HTMLLIElement | null)[]>([]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || !items.length) return;
      const at = rows.current.findIndex((el) => el && el === document.activeElement);
      const move = (to: number) => {
        e.preventDefault();
        rows.current[Math.max(0, Math.min(items.length - 1, to))]?.focus();
      };
      if (e.key === "j" || e.key === "ArrowDown") move(at < 0 ? 0 : at + 1);
      else if (e.key === "k" || e.key === "ArrowUp") move(at < 0 ? 0 : at - 1);
      else if (e.key === "Enter" && at >= 0) {
        e.preventDefault();
        onRun(items[at]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, onRun]);

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {items.map((i, n) => {
        const k = styles[i.kind];
        return (
          <li
            key={i.id}
            ref={(el) => {
              rows.current[n] = el;
            }}
            tabIndex={0}
            aria-label={`${i.householdName}: ${i.summary}`}
            className="flex items-center gap-3 px-4 py-3 outline-none focus-visible:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-4"
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", k.tint)} title={k.label}>
              <k.icon aria-hidden="true" className="size-4" />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="text-sm">
                {i.summary.startsWith(i.householdName) ? (
                  <>
                    <span className="font-semibold">{i.householdName}</span>
                    {i.summary.slice(i.householdName.length)}
                  </>
                ) : (
                  i.summary
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">{context(i)}</p>
            </div>
            <time dateTime={i.at} className="shrink-0 text-sm whitespace-nowrap text-muted-foreground">
              {i.when}
            </time>
            <Button variant="outline" size="sm" className="h-11 shrink-0 px-4 md:h-8 md:px-3" disabled={pending?.(i) ?? false} onClick={() => onRun(i)}>
              {actionLabels[i.action]}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
