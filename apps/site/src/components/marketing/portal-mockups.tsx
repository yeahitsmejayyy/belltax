import { Camera, Check, ChevronRight, Clock, Moon, Upload } from "lucide-react";
import type * as React from "react";

import { Card } from "@app/ui/components/card";
import { BellMark, Wordmark } from "@app/ui/components/logo";
import { Money } from "@app/ui/components/money";
import { Progress } from "@app/ui/components/progress";
import { DocumentChip, StatusChip, type DocumentChipStatus } from "@app/ui/components/status-chip";
import { StageTimeline } from "@app/ui/components/timeline";
import { cn } from "@app/ui/utils";

// The portal, drawn in HTML from the design system for the hero phones (marketing 01) and the solution
// screenshot (04). Invented demo data only: "Jordan A. Example" is not a person.

const TODO: { title: string; status: DocumentChipStatus | "unsigned" }[] = [
  { title: "Paystubs, January to December", status: "rejected" },
  { title: "1099-NEC from Example Rides Co.", status: "needed" },
  { title: "Photo ID for Jordan", status: "needed" },
  { title: "Sign your engagement letter", status: "unsigned" },
];

function PortalBar({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 border-b bg-background", compact ? "h-11 px-3" : "h-12 px-4")}>
      <BellMark className="size-5" />
      <Wordmark className="h-3.5" />
      <span className="inline-flex h-5 items-center gap-1 rounded-full bg-mode-demo px-2 text-[11px] font-medium text-mode-demo-foreground">
        <span className="size-1 rounded-full bg-current" />
        Demo
      </span>
      <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-brand-subtle text-[11px] font-semibold text-brand-subtle-foreground">JE</span>
    </div>
  );
}

function TodoList({ rows = TODO }: { rows?: typeof TODO }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((r) => (
        <li key={r.title} className="flex items-center gap-2 px-3 py-2.5">
          <span className="grid flex-1 gap-1.5">
            <span className="text-[13px] leading-snug font-medium">{r.title}</span>
            {r.status === "unsigned" ? (
              <StatusChip tone="neutral" icon={Clock} label="Not signed" className="h-5 px-2 text-[11px]" />
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

function NeedsYou({ preparerFirst, rows }: { preparerFirst: string; rows?: typeof TODO }) {
  return (
    <Card className="gap-3 rounded-xl px-4 py-4 shadow-none">
      <div className="grid gap-1">
        <span className="text-sm font-semibold">{(rows ?? TODO).length} things need you</span>
        <span className="text-xs text-muted-foreground">Start with the first one. {preparerFirst} is notified as each is done.</span>
      </div>
      <TodoList rows={rows} />
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

export function PhoneHome({ preparer, preparerFirst, year }: { preparer: string; preparerFirst: string; year: number }) {
  return (
    <>
      <PortalBar />
      <div className="grid gap-4 p-4 text-left">
        <div className="grid gap-1">
          <span className="text-xl font-semibold tracking-tight">Hi, Jordan</span>
          <span className="text-xs text-muted-foreground">
            Your {year} tax return · prepared by {preparer}
          </span>
        </div>
        <NeedsYou preparerFirst={preparerFirst} />
      </div>
    </>
  );
}

export function PhoneDocuments() {
  return (
    <>
      <PortalBar compact />
      <div className="grid gap-3 p-3 text-left">
        <div className="grid gap-1">
          <span className="text-base font-semibold tracking-tight">Documents</span>
          <span className="text-[11px] text-muted-foreground">1 of 5 accepted · 3 still needed from you</span>
        </div>
        <Progress value={20} className="h-1.5 [&>div]:bg-success" />
        <div className="grid gap-2 rounded-lg border border-dashed p-2.5">
          <span className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground">
            <Camera className="size-3.5" /> Take a photo
          </span>
          <span className="flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs font-medium">
            <Upload className="size-3.5" /> Choose a file
          </span>
          <span className="text-[11px] leading-snug text-muted-foreground">Photos are fine. Lay the page flat in good light.</span>
        </div>
        <TodoList rows={TODO.slice(1, 3)} />
      </div>
    </>
  );
}

export function PhoneLetterSigned() {
  return (
    <>
      <PortalBar compact />
      <div className="grid gap-3 p-4 text-left">
        <span className="flex size-9 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
          <Check className="size-4" />
        </span>
        <div className="grid gap-1">
          <span className="text-base font-semibold tracking-tight">Letter signed</span>
          <span className="text-[11px] leading-snug text-muted-foreground">Thanks. A copy is on its way to jordan@example.com.</span>
        </div>
        <dl className="grid divide-y rounded-lg border text-[11px]">
          {[
            ["Signed by", "Jordan A. Example"],
            ["Signed", "Feb 12, 9:41 AM"],
            ["Letter", "Engagement letter"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 px-3 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <span className="flex h-8 items-center justify-center rounded-md border text-xs font-medium">Back to home</span>
      </div>
    </>
  );
}

// The desktop portal home (marketing 04): what the client sees, step 3 of 8.
export function DesktopHome({ preparer, preparerFirst, year }: { preparer: string; preparerFirst: string; year: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-background text-left shadow-2xl">
      <div className="flex h-11 items-center gap-2 border-b px-4">
        <BellMark className="size-5" />
        <Wordmark className="h-3.5" />
        <span className="hidden h-5 items-center gap-1 rounded-full bg-mode-demo px-2 text-[11px] font-medium text-mode-demo-foreground sm:inline-flex">
          <span className="size-1 rounded-full bg-current" />
          Demo · sample data
        </span>
        <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
          <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">Home</span>
          <span className="px-2 py-1">Questions</span>
          <span className="px-2 py-1">Documents</span>
          <span className="px-2 py-1">Letter</span>
          <span className="px-2 py-1">Invoice</span>
        </span>
        <Moon className="ml-auto size-4 text-muted-foreground lg:ml-2" />
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-subtle text-[11px] font-semibold text-brand-subtle-foreground">JE</span>
      </div>
      <div className="grid gap-4 p-4 sm:p-6">
        <div className="grid gap-1">
          <span className="text-lg font-semibold tracking-tight">Hi, Jordan</span>
          <span className="text-xs text-muted-foreground">
            Your {year} tax return · prepared by {preparer}
          </span>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <div className="grid gap-4">
            <NeedsYou preparerFirst={preparerFirst} />
            <Card className="flex-row items-center gap-3 rounded-xl px-4 py-3 shadow-none">
              <span className="grid flex-1 gap-1">
                <span className="text-[11px] text-muted-foreground">Invoice from {preparerFirst}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Money cents={28500} className="text-sm font-semibold" />
                  <StatusChip tone="neutral" icon={Clock} label="Due before filing" className="h-5 px-2 text-[11px]" />
                </span>
              </span>
              <span className="flex h-8 items-center rounded-md border px-3 text-xs font-medium">View invoice</span>
            </Card>
          </div>
          <Card className="hidden gap-4 rounded-xl px-4 py-4 shadow-none sm:flex">
            <div className="grid gap-1">
              <span className="text-sm font-semibold">Where your return stands</span>
              <span className="text-xs text-muted-foreground">Step 3 of 8 · Documents</span>
            </div>
            <StageTimeline stage="documents" className="[&_li]:pb-3 [&_li>span:last-child]:text-xs" />
          </Card>
        </div>
      </div>
    </div>
  );
}
