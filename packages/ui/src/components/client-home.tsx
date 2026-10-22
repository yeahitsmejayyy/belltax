import { Stage } from "@app/schema";
import { Check, ChevronRight, CircleDashed, Clock, Coffee } from "lucide-react";
import type * as React from "react";

import { formatDate } from "../format";
import { cn } from "../utils";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Money } from "./money";
import { STAGE_META } from "./stage-pill";
import { INVOICE_STATUS, StatusChip } from "./status-chip";

// The client portal's Home (portal 05-home, 06 dark; desktop 22-desktop-d-home), the one the portal renders and
// Storybook shows (ticket 56): "N things need you", the invoice, and where the return stands. Data in, links out
// through `renderLink`, so the same components serve the app (router links) and the stories (plain anchors).

/** How a component asks the app for a link to `to`. Defaults to a plain <a>. */
export type RenderLink = (to: string, children: React.ReactNode, className?: string) => React.ReactNode;
const anchor: RenderLink = (to, children, className) => (
  <a href={to} className={className}>
    {children}
  </a>
);

type Chip = Pick<React.ComponentProps<typeof StatusChip>, "tone" | "icon" | "label">;

// ---------- What needs the client ----------

/** One thing waiting on the client: what it is, its state, and where it's settled. */
export type Need = { key: string; title: string; to: string; cta: string; chip: Chip };

const NEXT: Record<Stage, (p: string) => string> = {
  invited: (p) => `${p} will send your questions soon.`,
  intake: (p) => `${p} is looking over your answers and will ask for anything else needed.`,
  documents: (p) => `${p} is checking what you sent. You'll hear if anything else is needed.`,
  ready: (p) => `You're all set. ${p} will start your return soon.`,
  preparing: (p) => `${p} is working on your return. You'll be asked to review it when it's ready.`,
  review: (p) => `${p} will go over your return with you before it's filed.`,
  filed: () => "Your return was sent to the IRS and the state. We'll let you know when they accept it.",
  complete: () => "Your return was accepted. You're done for this year.",
};

/** "N things need you": each a link to the screen that settles it, and one button for the first. Empty: what's next. */
export function NeedsCard({ needs, stage, preparer, renderLink = anchor }: { needs: Need[]; stage: Stage; preparer: string; renderLink?: RenderLink }) {
  if (!needs.length) {
    return (
      <Card>
        <CardContent className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
            <Coffee aria-hidden="true" className="size-5" />
          </span>
          <div className="grid gap-1">
            <h2 className="font-semibold">Nothing needs you right now</h2>
            <p className="text-sm text-muted-foreground">{NEXT[stage](preparer)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  const first = needs[0]!;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>{needs.length === 1 ? "1 thing needs you" : `${needs.length} things need you`}</h2>
        </CardTitle>
        <CardDescription>Start with the first one. {preparer} is notified as each is done.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="divide-y overflow-hidden rounded-lg border">
          {needs.map((n) => (
            <li key={n.key}>
              {renderLink(
                n.to,
                <>
                  <span className="grid min-w-0 flex-1 gap-1.5">
                    <span className="font-medium break-words">{n.title}</span>
                    <StatusChip {...n.chip} />
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </>,
                "flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
              )}
            </li>
          ))}
        </ul>
        <Button asChild size="touch" className="w-full">
          {renderLink(first.to, first.cta)}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- Where the return stands ----------

export const STAGE_LABEL: Record<Stage, string> = {
  invited: "Invited",
  intake: "Questions",
  documents: "Documents",
  ready: "Ready to prep",
  preparing: "Preparing",
  review: "Your review",
  filed: "Filed",
  complete: "Complete",
};

const NOW: Record<Stage, (p: string) => string> = {
  invited: () => "Set up your account to get started.",
  intake: () => "Answer questions about your household and income.",
  documents: (p) => `Upload the documents ${p} asked for.`,
  ready: (p) => `You're all set. ${p} will start soon.`,
  preparing: (p) => `${p} is working on your return.`,
  review: () => "Look over your return and approve it.",
  filed: () => "Sent to the IRS and the state. Waiting for them to accept it.",
  complete: () => "Your return was accepted. You're done for this year.",
};

/** The eight stages in the client's words: done ones checked with the day reached, the current one with what's now. */
export function StageProgress({ stage, reached = [], preparer }: { stage: Stage; reached?: { stage: Stage; at: string }[]; preparer: string }) {
  const at = Stage.options.indexOf(stage);
  const done = stage === "complete";
  // A return moved back can reach a stage twice; the latest visit is the one that counts.
  const when = new Map<Stage, string>();
  for (const r of reached) if (!when.has(r.stage) || r.at > when.get(r.stage)!) when.set(r.stage, r.at);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>Where your return stands</h2>
        </CardTitle>
        <CardDescription>
          Step {at + 1} of {Stage.options.length} · {STAGE_LABEL[stage]}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid">
          {Stage.options.map((s, i) => {
            const state = i < at || (done && i === at) ? "done" : i === at ? "current" : "upcoming";
            const Icon = STAGE_META[s].icon;
            const day = when.get(s);
            return (
              <li key={s} data-state={state} aria-current={i === at ? "step" : undefined} className="relative flex gap-4 pb-6 last:pb-0">
                {i < Stage.options.length - 1 ? <span aria-hidden="true" className={cn("absolute top-10 bottom-0 left-[19px] w-0.5", i < at ? "bg-primary" : "bg-border")} /> : null}
                <span
                  className={cn(
                    "relative flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums",
                    state === "done" && "border-primary bg-primary text-primary-foreground",
                    state === "current" && "border-primary bg-brand-subtle text-brand-subtle-foreground ring-4 ring-brand-subtle",
                    state === "upcoming" && "bg-card text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check aria-hidden="true" className="size-4" /> : state === "current" ? <Icon aria-hidden="true" className="size-4" /> : i + 1}
                </span>
                <div className="grid min-w-0 content-start gap-1 pt-2">
                  <span className={cn("flex flex-wrap items-center gap-2", state === "current" ? "font-semibold" : state === "upcoming" && "text-muted-foreground")}>
                    {STAGE_LABEL[s]}
                    {i === at && !done ? <span className="rounded-full bg-brand-subtle px-2 text-xs leading-5 font-medium text-brand-subtle-foreground">Now</span> : null}
                  </span>
                  {state === "done" ? (
                    <span className="text-sm text-muted-foreground">Done{day ? ` · ${formatDate(day, { month: "short", day: "numeric" })}` : ""}</span>
                  ) : state === "current" ? (
                    <span className="text-sm text-muted-foreground">{NOW[s](preparer)}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------- The invoice ----------

/** The parts of an invoice the Home card reads. */
export type HomeInvoice = { settlement: "draft" | "void" | "unpaid" | "partial" | "paid" | "failed_last_attempt"; totalCents: number; balanceCents: number; dueOn: string | null };

/** The invoice's state as a chip: paid (and the like), due before filing, due on a day, or overdue. */
export function invoiceChip(inv: HomeInvoice, today = new Date().toISOString().slice(0, 10)): Chip {
  if (inv.settlement !== "unpaid") return INVOICE_STATUS[inv.settlement];
  if (!inv.dueOn) return { tone: "neutral", icon: CircleDashed, label: "Due before filing" };
  const due = `${inv.dueOn}T12:00:00Z`;
  if (inv.dueOn < today) return { ...INVOICE_STATUS.overdue, label: `Overdue since ${formatDate(due, { month: "short", day: "numeric" })}` };
  return { tone: "brand", icon: Clock, label: `Due ${formatDate(due, { month: "short", day: "numeric" })}` };
}

/** What's owed, its state, and the way to it. */
export function InvoiceCard({ invoice, preparer, to = "/invoice", renderLink = anchor }: { invoice: HomeInvoice; preparer: string; to?: string; renderLink?: RenderLink }) {
  const cents = invoice.settlement === "paid" ? invoice.totalCents : invoice.balanceCents;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm text-muted-foreground">Invoice from {preparer}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Money cents={cents} className="text-2xl font-semibold" />
            <StatusChip {...invoiceChip(invoice)} />
          </div>
        </div>
        <Button asChild variant="outline" size="touch">
          {renderLink(to, "View invoice")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- The page ----------

export type ClientHomeProps = {
  firstName: string;
  taxYear: number;
  amended?: boolean;
  /** Full name in the subtitle ("prepared by …"); first name everywhere else. */
  preparerName: string;
  stage: Stage;
  reached?: { stage: Stage; at: string }[];
  needs: Need[];
  invoice?: HomeInvoice | null;
  /** Beside the greeting: the return picker when there's more than one. */
  picker?: React.ReactNode;
  /** Under the greeting: the demo tour's "Try this". */
  tips?: React.ReactNode;
  renderLink?: RenderLink;
};

/** Home: the greeting, then what needs the client and the invoice beside where the return stands. One column on a phone. */
export function ClientHome({ firstName, taxYear, amended, preparerName, stage, reached, needs, invoice, picker, tips, renderLink = anchor }: ClientHomeProps) {
  const preparer = preparerName.trim().split(/\s+/)[0] ?? preparerName;
  return (
    <div data-slot="client-home" className="grid grid-cols-1 animate-page gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Hi, {firstName}</h1>
          <p className="text-muted-foreground">
            Your {taxYear} {amended ? "amended " : ""}tax return · prepared by {preparerName}
          </p>
        </div>
        {picker}
      </header>
      {tips}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="grid grid-cols-1 gap-6">
          <NeedsCard needs={needs} stage={stage} preparer={preparer} renderLink={renderLink} />
          {invoice ? <InvoiceCard invoice={invoice} preparer={preparer} renderLink={renderLink} /> : null}
        </div>
        <StageProgress stage={stage} reached={reached} preparer={preparer} />
      </div>
    </div>
  );
}
