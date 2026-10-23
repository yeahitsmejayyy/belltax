import type { DashboardSummary, Stage } from "@app/schema";
import type * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatCents, formatDate } from "../format";
import { cn } from "../utils";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./chart";
import { Money } from "./money";
import { Progress } from "./progress";
import { Skeleton } from "./skeleton";
import { StagePill, type Waiting } from "./stage-pill";
import { HealthCheckRow, StatCard, type HealthTone } from "./stat-card";

// The preparer's dashboard (admin 03-dashboard-dashboard, 34-phone-m-dashboard): the season at a glance. Every
// number comes in from dashboard.summary (derived on the server); these only draw it. Links go through `renderLink`
// and actions out through callbacks, so the app keeps the routing.

/** Draws a link: the app passes its router's Link. Plain `<a href>` by default. */
export type RenderLink = (href: string, className: string, children: React.ReactNode) => React.ReactNode;
const plainLink: RenderLink = (href, className, children) => (
  <a href={href} className={className}>
    {children}
  </a>
);

// ---------- Season ----------

/** Where the season stands: its phase, days to the deadline, and a bar for how far through it is. */
export function SeasonProgress({ season: s, taxYear }: { season: DashboardSummary["season"]; taxYear: number }) {
  const deadline = formatDate(`${s.deadline}T12:00:00Z`, { month: "long", day: "numeric", year: "numeric" });
  const what =
    s.phase === "before"
      ? `TY ${taxYear} season opens ${formatDate(`${s.opensOn}T12:00:00Z`, { month: "long", day: "numeric" })}`
      : s.phase === "extension"
        ? `TY ${taxYear} extension season · ${s.daysToDeadline} days to ${deadline}`
        : s.phase === "closed"
          ? `TY ${taxYear} season is over`
          : `TY ${taxYear} season · ${s.daysToDeadline} days to ${deadline}`;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className="text-sm font-medium">{what}</span>
      <Progress value={(s.day / s.length) * 100} aria-label="How far through the season" className="h-1.5 max-w-md flex-1 basis-40" />
      <span className="text-sm text-muted-foreground tabular-nums">
        Day {s.day} of {s.length}
      </span>
    </div>
  );
}

// ---------- KPIs ----------

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export type DashboardKpisProps = Pick<DashboardSummary, "returns" | "money" | "waitingOnYou" | "daysInStage">;

/** The four headline numbers: filed, collected, waiting on you, days in stage. */
export function DashboardKpis({ returns, money, waitingOnYou, daysInStage }: DashboardKpisProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Returns filed"
        value={`${returns.filed} of ${returns.total}`}
        progress={pct(returns.filed, returns.total)}
        detail={`${returns.complete} complete · ${returns.waitingOnAuthority} waiting on IRS and FTB`}
      />
      <StatCard
        label="Collected"
        value={<Money cents={money.collectedCents} />}
        progress={pct(money.collectedCents, money.billedCents)}
        detail={`of ${formatCents(money.billedCents)} billed · ${formatCents(money.outstandingCents)} outstanding`}
      />
      <StatCard label="Waiting on you" value={waitingOnYou.total} detail={`${waitingOnYou.toPrepare} returns to prepare · ${waitingOnYou.inbox} in Inbox`} />
      <StatCard
        label="Avg. days in stage"
        value={daysInStage.average}
        detail={daysInStage.over7 ? `${daysInStage.over7} returns over 7 days` : "Nothing over 7 days"}
        detailTone={daysInStage.over7 ? "warning" : "muted"}
      />
    </div>
  );
}

// ---------- Returns by stage ----------

const WAITING_BAR: Record<Waiting, string> = { client: "bg-muted-foreground/40", preparer: "bg-primary", authority: "bg-info", done: "bg-success" };
const WAITING_WORDS: [Waiting, string][] = [["client", "Waiting on client"], ["preparer", "Waiting on you"], ["authority", "Waiting on IRS and FTB"], ["done", "Done"]];

export type StageCount = { stage: Stage; count: number; waiting: Waiting };

/** A bar per stage, coloured by who it's waiting on; each row links to that stage (`stageHref`). */
export function ReturnsByStageCard({
  byStage,
  stageHref,
  renderLink = plainLink,
  title = "Returns by stage",
  description = "Click a stage to open it in the pipeline.",
}: {
  byStage: StageCount[];
  stageHref: (stage: Stage) => string;
  renderLink?: RenderLink;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  const maxStage = Math.max(1, ...byStage.map((b) => b.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {byStage.map((b) => (
          <StageLink key={b.stage} href={stageHref(b.stage)} renderLink={renderLink}>
            <StagePill stage={b.stage} />
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full", WAITING_BAR[b.waiting])} style={{ width: `${(b.count / maxStage) * 100}%` }} />
            </span>
            <span className="text-right text-sm font-medium tabular-nums">{b.count}</span>
          </StageLink>
        ))}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
          {WAITING_WORDS.map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("size-2 rounded-[2px]", WAITING_BAR[k])} />
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StageLink({ href, renderLink, children }: { href: string; renderLink: RenderLink; children: React.ReactNode }) {
  return renderLink(href, "grid grid-cols-[9rem_1fr_2rem] items-center gap-3 rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none", children);
}

// ---------- Health checks ----------

/** One health check: its tone, what it found, and (when there's something to look at) a button. */
export type HealthCheck = { key: string; tone: HealthTone; title: React.ReactNode; detail?: React.ReactNode; action?: { label: React.ReactNode; onClick: () => void } };

/** Things that need a look before they turn into problems, with how many need attention. */
export function HealthChecksCard({
  checks,
  needAttention = 0,
  title = "Health checks",
  description = "Things that need a look before they turn into problems.",
}: {
  checks: HealthCheck[];
  needAttention?: number;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="grid gap-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {needAttention ? <span className="text-sm font-medium text-warning-foreground">{needAttention} need attention</span> : null}
      </CardHeader>
      <CardContent>
        {checks.map((h) => (
          <HealthCheckRow
            key={h.key}
            tone={h.tone}
            title={h.title}
            detail={h.detail}
            action={
              h.action ? (
                <Button variant="outline" size="sm" onClick={h.action.onClick}>
                  {h.action.label}
                </Button>
              ) : undefined
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ---------- Filings per week ----------

const FILINGS_CHART: ChartConfig = { thisYear: { label: "This season", color: "var(--chart-1)" }, lastYear: { label: "Last season", color: "var(--chart-5)" } };

/** A week of filings: its label on the axis ("Feb 9"), and how many were filed this season and last. */
export type FilingWeek = { week: string; thisYear: number; lastYear: number };

/** Returns filed per week, this season against last, with the running totals in the description. */
export function FilingsPerWeekCard({ weeks, filedSoFar, lastYearBySameDay }: { weeks: FilingWeek[]; filedSoFar: number; lastYearBySameDay: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Returns filed per week</CardTitle>
        <CardDescription>
          {filedSoFar} filed so far · {lastYearBySameDay} by this point last season
        </CardDescription>
      </CardHeader>
      <CardContent>
        {weeks.length ? (
          <ChartContainer config={FILINGS_CHART} className="h-56 w-full">
            <BarChart data={weeks} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="lastYear" fill="var(--color-lastYear)" radius={4} />
              <Bar dataKey="thisYear" fill="var(--color-thisYear)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">The chart starts when the season opens.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** The server's weeks (`weekOf` dates) as chart rows labelled "Feb 9". */
export const filingWeeks = (weeks: DashboardSummary["filingsPerWeek"]["weeks"]): FilingWeek[] =>
  weeks.map((w) => ({ ...w, week: formatDate(`${w.weekOf}T12:00:00Z`, { month: "short", day: "numeric" }) }));

// ---------- Billing by package ----------

export type PackageBilling = { code: string; name: string; returns: number; billedCents: number };

/** What's been invoiced this season, one line per package. */
export function BillingByPackageCard({ packages }: { packages: PackageBilling[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing by package</CardTitle>
        <CardDescription>What's been invoiced this season, by package.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {packages.length ? (
          packages.map((p) => (
            <div key={p.code} className="flex items-center justify-between gap-4 text-sm">
              <span>
                {p.name} <span className="text-muted-foreground">· {p.returns} return{p.returns === 1 ? "" : "s"}</span>
              </span>
              <Money cents={p.billedCents} className="font-medium" />
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Nothing invoiced yet this season.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- The page ----------

export type DashboardProps = {
  summary: DashboardSummary;
  taxYear: number;
  /** Shown above everything (the public demo's TryThis). */
  before?: React.ReactNode;
  /** Where a stage row on "Returns by stage" goes. */
  stageHref: (stage: Stage) => string;
  renderLink?: RenderLink;
  /** A health check's button, or none (nothing to look at). */
  healthAction?: (check: DashboardSummary["health"][number]) => HealthCheck["action"];
};

/** The whole dashboard: season, KPIs, then stages and health checks, then filings and billing. */
export function Dashboard({ summary: d, taxYear, before, stageHref, renderLink, healthAction }: DashboardProps) {
  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      {before}
      <SeasonProgress season={d.season} taxYear={taxYear} />

      <DashboardKpis returns={d.returns} money={d.money} waitingOnYou={d.waitingOnYou} daysInStage={d.daysInStage} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReturnsByStageCard byStage={d.byStage} stageHref={stageHref} renderLink={renderLink} />
        <HealthChecksCard needAttention={d.needAttention} checks={d.health.map((h) => ({ key: h.key, tone: h.tone, title: h.title, detail: h.detail, action: healthAction?.(h) }))} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FilingsPerWeekCard weeks={filingWeeks(d.filingsPerWeek.weeks)} filedSoFar={d.filingsPerWeek.filedSoFar} lastYearBySameDay={d.filingsPerWeek.lastYearBySameDay} />
        <BillingByPackageCard packages={d.billingByPackage} />
      </div>
    </div>
  );
}

/** The dashboard's shape while the summary loads. */
export function DashboardLoading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading the dashboard">
      <Skeleton className="h-6 w-96 max-w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
    </div>
  );
}
