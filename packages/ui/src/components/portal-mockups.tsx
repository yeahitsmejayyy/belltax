import type { Stage } from "@app/schema";
import { Camera, Check, ChevronRight, Clock, Moon, Upload } from "lucide-react";
import * as React from "react";

import { Card } from "./card";
import { Float } from "./float";
import { BellMark, Wordmark } from "./logo";
import { Money } from "./money";
import { Progress } from "./progress";
import { DocumentChip, StatusChip, type DocumentChipStatus } from "./status-chip";
import { StageTimeline } from "./timeline";
import { cn } from "../utils";

// The portal, drawn in HTML from the design system for the hero phones (marketing 01), the splash page's phones and
// the solution screenshot (04). Pictures of the portal, not the portal: every word and number comes in through `data`
// (the site's invented sample, or a story's fixture), so nothing here is anybody's data.

/** One row on a "things need you" list: a document's chip, or "unsigned" for the engagement letter. */
export type MockTodo = { title: string; status: DocumentChipStatus | "unsigned" };

/** Everything the portal mockups show. All of it is invented sample data (docs/two-data-worlds.md). */
export type PortalMockup = {
  /** The run-mode badge in the header, e.g. "Demo". */
  mode: string;
  /** The account button's initials. */
  initials: string;
  /** The home page's heading, e.g. "Hi, Jordan". */
  greeting: string;
  /** The line under it: whose return, which year, who prepares it. */
  returnLine: string;
  /** The "things need you" card. */
  needs: { title: string; hint: string; unsigned: string; rows: MockTodo[] };
  /** The phone Documents screen. */
  documents: { title: string; summary: string; progress: number; takePhoto: string; chooseFile: string; tip: string; rows: MockTodo[] };
  /** The phone "letter signed" screen: a heading, a line, the signature's details, the way back. */
  letter: { title: string; note: string; details: [label: string, value: string][]; back: string };
  /** The desktop home only: its badge, top nav, invoice card and stage card. */
  desktop: {
    mode: string;
    nav: string[];
    current: string;
    invoice: { label: string; cents: number; status: string; action: string };
    stage: { title: string; caption: string; stage: Stage };
  };
};

function PortalBar({ data, compact }: { data: PortalMockup; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 border-b bg-background", compact ? "h-11 px-3" : "h-12 px-4")}>
      <BellMark className="size-5" />
      <Wordmark className="h-3.5" />
      <span className="inline-flex h-5 items-center gap-1 rounded-full bg-mode-demo px-2 text-[11px] font-medium text-mode-demo-foreground">
        <span className="size-1 rounded-full bg-current" />
        {data.mode}
      </span>
      <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-brand-subtle text-[11px] font-semibold text-brand-subtle-foreground">{data.initials}</span>
    </div>
  );
}

function TodoList({ rows, unsigned }: { rows: MockTodo[]; unsigned: string }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((r) => (
        <li key={r.title} className="flex items-center gap-2 px-3 py-2.5">
          <span className="grid flex-1 gap-1.5">
            <span className="text-[13px] leading-snug font-medium">{r.title}</span>
            {r.status === "unsigned" ? (
              <StatusChip tone="neutral" icon={Clock} label={unsigned} className="h-5 px-2 text-[11px]" />
            ) : (
              <DocumentChip status={r.status} className="h-5 px-2 text-[11px]" />
            )}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </li>
      ))}
    </ul>
  );
}

function NeedsYou({ data }: { data: PortalMockup }) {
  return (
    <Card className="gap-3 rounded-xl px-4 py-4 shadow-none">
      <div className="grid gap-1">
        <span className="text-sm font-semibold">{data.needs.title}</span>
        <span className="text-xs text-muted-foreground">{data.needs.hint}</span>
      </div>
      <TodoList rows={data.needs.rows} unsigned={data.needs.unsigned} />
    </Card>
  );
}

// A phone outline: rounded body, the speaker pill, the portal header, then the screen.
export function PhoneFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("aspect-[402/874] overflow-hidden rounded-[2.25rem] border bg-background shadow-2xl ring-1 ring-border/50", className)}>
      <div className="flex h-9 items-center justify-center">
        <span className="h-5 w-20 rounded-full bg-muted" />
      </div>
      {children}
    </div>
  );
}

/**
 * Three portal phones drifting side by side (the splash page, ticket 53): Documents, Home, a signed letter. On phones
 * only the middle one shows. Decoration with invented data: hidden from assistive tech and never focusable.
 */
export function PortalPhones({ data, className }: { data: PortalMockup; className?: string }) {
  return (
    <div aria-hidden="true" inert className={cn("flex w-full max-w-240 items-end justify-center gap-3 select-none sm:gap-7", className)}>
      <Float delay={0} className="hidden w-[220px] shrink-0 sm:block">
        <PhoneFrame>
          <PhoneDocuments data={data} />
        </PhoneFrame>
      </Float>
      <Float delay={1200} className="w-[230px] shrink-0 sm:w-[270px]">
        <PhoneFrame>
          <PhoneHome data={data} />
        </PhoneFrame>
      </Float>
      <Float delay={2400} className="hidden w-[220px] shrink-0 sm:block">
        <PhoneFrame>
          <PhoneLetterSigned data={data} />
        </PhoneFrame>
      </Float>
    </div>
  );
}

/** The phone home page: the greeting, whose return it is, and what's waiting on the client. */
export function PhoneHome({ data }: { data: PortalMockup }) {
  return (
    <>
      <PortalBar data={data} />
      <div className="grid gap-4 p-4 text-left">
        <div className="grid gap-1">
          <span className="text-xl font-semibold tracking-tight">{data.greeting}</span>
          <span className="text-xs text-muted-foreground">{data.returnLine}</span>
        </div>
        <NeedsYou data={data} />
      </div>
    </>
  );
}

/** The phone Documents screen: how many are in, the photo and file buttons, and what's still asked for. */
export function PhoneDocuments({ data }: { data: PortalMockup }) {
  const d = data.documents;
  return (
    <>
      <PortalBar data={data} compact />
      <div className="grid gap-3 p-3 text-left">
        <div className="grid gap-1">
          <span className="text-base font-semibold tracking-tight">{d.title}</span>
          <span className="text-[11px] text-muted-foreground">{d.summary}</span>
        </div>
        <Progress value={d.progress} className="h-1.5 [&>div]:bg-success" />
        <div className="grid gap-2 rounded-lg border border-dashed p-2.5">
          <span className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground">
            <Camera className="size-3.5" /> {d.takePhoto}
          </span>
          <span className="flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs font-medium">
            <Upload className="size-3.5" /> {d.chooseFile}
          </span>
          <span className="text-[11px] leading-snug text-muted-foreground">{d.tip}</span>
        </div>
        <TodoList rows={d.rows} unsigned={data.needs.unsigned} />
      </div>
    </>
  );
}

/** The phone screen after signing the engagement letter: who signed, when, and the way back. */
export function PhoneLetterSigned({ data }: { data: PortalMockup }) {
  const l = data.letter;
  return (
    <>
      <PortalBar data={data} compact />
      <div className="grid gap-3 p-4 text-left">
        <span className="flex size-9 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
          <Check className="size-4" />
        </span>
        <div className="grid gap-1">
          <span className="text-base font-semibold tracking-tight">{l.title}</span>
          <span className="text-[11px] leading-snug text-muted-foreground">{l.note}</span>
        </div>
        <dl className="grid divide-y rounded-lg border text-[11px]">
          {l.details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 px-3 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <span className="flex h-8 items-center justify-center rounded-md border text-xs font-medium">{l.back}</span>
      </div>
    </>
  );
}

// Lays a mockup out at one fixed width and scales it to fit its column, like a screenshot: the layout never
// reflows into a squeeze, whatever the column's width. Height follows the scale, so nothing shifts around it.
function ScaledFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState({ scale: 1, height: 0 });
  React.useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const scale = Math.min(1, outer.current.clientWidth / width);
      setFit({ scale, height: inner.current.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={outer} style={{ height: fit.height || undefined }} className="relative w-full">
      <div ref={inner} style={{ width, transform: `scale(${fit.scale})`, transformOrigin: "top left" }} className="absolute top-0 left-0">
        {children}
      </div>
    </div>
  );
}

// The desktop portal home (marketing 04): what the client sees, mid-season. Always the desktop layout, scaled.
export function DesktopHome({ data }: { data: PortalMockup }) {
  const d = data.desktop;
  return (
    <ScaledFrame width={760}>
    <div className="overflow-hidden rounded-2xl border bg-background text-left shadow-2xl">
      <div className="flex h-11 items-center gap-2 border-b px-4">
        <BellMark className="size-5" />
        <Wordmark className="h-3.5" />
        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-mode-demo px-2 text-[11px] font-medium whitespace-nowrap text-mode-demo-foreground">
          <span className="size-1 rounded-full bg-current" />
          {d.mode}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
          {d.nav.map((label) =>
            label === d.current ? (
              <span key={label} className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">{label}</span>
            ) : (
              <span key={label} className="px-2 py-1">{label}</span>
            ),
          )}
        </span>
        <Moon className="ml-2 size-4 shrink-0 text-muted-foreground" />
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[11px] font-semibold text-brand-subtle-foreground">{data.initials}</span>
      </div>
      <div className="grid gap-4 p-6">
        <div className="grid gap-1">
          <span className="text-lg font-semibold tracking-tight">{data.greeting}</span>
          <span className="text-xs text-muted-foreground">{data.returnLine}</span>
        </div>
        <div className="grid grid-cols-2 items-start gap-4">
          <div className="grid gap-4">
            <NeedsYou data={data} />
            <Card className="flex-row items-center gap-3 rounded-xl px-4 py-3 shadow-none">
              <span className="grid flex-1 gap-1">
                <span className="text-[11px] text-muted-foreground">{d.invoice.label}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Money cents={d.invoice.cents} className="text-sm font-semibold" />
                  <StatusChip tone="neutral" icon={Clock} label={d.invoice.status} className="h-5 px-2 text-[11px]" />
                </span>
              </span>
              <span className="flex h-8 shrink-0 items-center rounded-md border px-3 text-xs font-medium whitespace-nowrap">{d.invoice.action}</span>
            </Card>
          </div>
          <Card className="flex gap-4 rounded-xl px-4 py-4 shadow-none">
            <div className="grid gap-1">
              <span className="text-sm font-semibold">{d.stage.title}</span>
              <span className="text-xs text-muted-foreground">{d.stage.caption}</span>
            </div>
            <StageTimeline stage={d.stage.stage} className="[&_li]:pb-3 [&_li>span:last-child]:text-xs" />
          </Card>
        </div>
      </div>
    </div>
    </ScaledFrame>
  );
}
