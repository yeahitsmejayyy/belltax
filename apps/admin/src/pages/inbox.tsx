import type { InboxItem, InboxKind } from "@app/schema";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Clock, FileX2, Inbox as InboxIcon, MessageSquare, PenLine, Upload } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@app/ui/components/button";
import { EmptyState } from "@app/ui/components/empty-state";
import { Skeleton } from "@app/ui/components/skeleton";
import { cn } from "@app/ui/utils";

import { shortWhen } from "@/components/lists/when";
import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// The Inbox (admin 10-inbox-inbox, 11-inbox-inbox-empty, 36-phone-m-inbox): everything waiting on the
// preparer, newest first, one inline action each. j/k or ↑/↓ move, Enter runs the action.

const KINDS = ["document_review", "question_answered", "letter_signed", "payment_failed", "efile_rejected", "stale"] as const satisfies readonly InboxKind[];

const KIND: Record<InboxKind, { label: string; icon: LucideIcon; tint: string }> = {
  document_review: { label: "Documents", icon: Upload, tint: "bg-brand-subtle text-brand-subtle-foreground" },
  question_answered: { label: "Answers", icon: MessageSquare, tint: "bg-muted text-foreground" },
  letter_signed: { label: "Signed letters", icon: PenLine, tint: "bg-muted text-foreground" },
  payment_failed: { label: "Failed payments", icon: AlertCircle, tint: "bg-danger-subtle text-danger-foreground" },
  efile_rejected: { label: "E-file rejections", icon: FileX2, tint: "bg-danger-subtle text-danger-foreground" },
  stale: { label: "Stale returns", icon: Clock, tint: "bg-warning-subtle text-warning-foreground" },
};

const ACTION_LABEL: Record<InboxItem["action"], string> = {
  review_document: "Review",
  acknowledge_answer: "Mark read",
  advance_stage: "Open",
  follow_up_payment: "Open billing",
  resubmit_efile: "Open return",
  open_return: "Open",
};

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.getAttribute("role") === "combobox");

export default function Inbox() {
  usePageTitle("Inbox");
  const navigate = useNavigate();
  const { taxYear } = useTaxYear();
  const [kind, setKind] = useQueryState("kind", parseAsStringLiteral(KINDS));
  const q = trpc.inbox.list.useQuery(taxYear ? { taxYear } : undefined, { enabled: !!taxYear });
  const utils = trpc.useUtils();
  const acknowledge = trpc.request.acknowledge.useMutation({
    onSuccess: () => {
      toast.success("Marked as read");
      void utils.invalidate();
    },
  });

  const items = React.useMemo(() => (q.data?.items ?? []).filter((i) => !kind || i.kind === kind), [q.data, kind]);
  const rows = React.useRef<(HTMLLIElement | null)[]>([]);

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
        run(items[at]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, run]);

  if (!q.data || !taxYear) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading the inbox">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-9 w-full max-w-2xl" />
        <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </div>
    );
  }

  const d = q.data;
  if (d.total === 0) {
    return <EmptyState icon={InboxIcon} title="All caught up" description="New uploads, answers, signed letters and failed payments land here." className="animate-page" />;
  }

  return (
    <div className="grid grid-cols-1 animate-page gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium">{d.total} waiting for review</h2>
        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex" aria-hidden="true">
          <kbd className="rounded border px-1.5 font-mono">j</kbd>
          <kbd className="rounded border px-1.5 font-mono">k</kbd> move
          <kbd className="ml-2 rounded border px-1.5 font-mono">↵</kbd> open
        </p>
      </div>

      <div role="group" aria-label="Show" className="flex gap-2 overflow-x-auto pb-1">
        <Chip pressed={!kind} onClick={() => void setKind(null)}>
          All <span className="tabular-nums">{d.total}</span>
        </Chip>
        {KINDS.filter((k) => d.counts[k]).map((k) => {
          const Icon = KIND[k].icon;
          return (
            <Chip key={k} pressed={kind === k} onClick={() => void setKind(kind === k ? null : k)}>
              <Icon aria-hidden="true" className="size-3.5" />
              {KIND[k].label} <span className="tabular-nums">{d.counts[k]}</span>
            </Chip>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={InboxIcon} title="Nothing of this kind" description="Everything else is still in the Inbox." action={<Button variant="outline" onClick={() => void setKind(null)}>Show everything</Button>} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {items.map((i, n) => {
            const k = KIND[i.kind];
            const pending = acknowledge.isPending && acknowledge.variables?.requestId === i.subjectId;
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
                  <p className="truncate text-sm text-muted-foreground">
                    {i.householdName} household · TY {i.taxYear}
                  </p>
                </div>
                <time dateTime={i.at} className="shrink-0 text-sm whitespace-nowrap text-muted-foreground">
                  {shortWhen(i.at)}
                </time>
                <Button variant="outline" size="sm" className="h-11 shrink-0 px-4 md:h-8 md:px-3" disabled={pending} onClick={() => run(i)}>
                  {ACTION_LABEL[i.action]}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
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
