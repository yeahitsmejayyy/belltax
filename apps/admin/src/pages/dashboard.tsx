import type { DashboardSummary } from "@app/schema";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { TryThis } from "@app/ui/components/demo-tour";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@app/ui/components/chart";
import { Money } from "@app/ui/components/money";
import { Progress } from "@app/ui/components/progress";
import { Skeleton } from "@app/ui/components/skeleton";
import { StagePill } from "@app/ui/components/stage-pill";
import { HealthCheckRow, StatCard } from "@app/ui/components/stat-card";
import { formatCents, formatDate } from "@app/ui/format";
import { cn } from "@app/ui/utils";

import { useDemoTour, useDismissed } from "@/lib/demo-tour";
import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// The dashboard (admin 03-dashboard-dashboard, 34-phone-m-dashboard): the season at a glance, from
// dashboard.summary. Every number is derived on the server; nothing here is computed from partial data.

const WAITING_BAR: Record<string, string> = { client: "bg-muted-foreground/40", preparer: "bg-primary", authority: "bg-info", done: "bg-success" };
const WAITING_WORDS: [string, string][] = [["client", "Waiting on client"], ["preparer", "Waiting on you"], ["authority", "Waiting on IRS and FTB"], ["done", "Done"]];

const chart: ChartConfig = { thisYear: { label: "This season", color: "var(--chart-1)" }, lastYear: { label: "Last season", color: "var(--chart-5)" } };

function Season({ s, taxYear }: { s: DashboardSummary["season"]; taxYear: number }) {
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

// The public demo's suggestions for a first visit (ticket 45).
const AGENT_TIPS = [
  { id: "pipeline", label: "Move a return forward", detail: "Drag a card in the pipeline to its next stage.", href: "/pipeline" },
  { id: "inbox", label: "Work the inbox", detail: "New documents and answers from clients land here.", href: "/inbox" },
  { id: "clients", label: "Open a household", detail: "People, returns and history in one place.", href: "/clients" },
];

export default function Dashboard() {
  usePageTitle("Dashboard");
  const navigate = useNavigate();
  const { taxYear } = useTaxYear();
  const q = trpc.dashboard.summary.useQuery(taxYear ? { taxYear } : undefined, { enabled: !!taxYear });
  const d = q.data;
  const tour = useDemoTour();
  const [tipsHidden, hideTips] = useDismissed("admin-dashboard");

  if (!d || !taxYear) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Loading the dashboard">
        <Skeleton className="h-6 w-96 max-w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
      </div>
    );
  }

  const maxStage = Math.max(1, ...d.byStage.map((b) => b.count));
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      {tour && !tipsHidden ? (
        <TryThis
          items={AGENT_TIPS}
          onDismiss={hideTips}
          renderLink={(item, className, children) => (
            <Link to={item.href} className={className}>
              {children}
            </Link>
          )}
        />
      ) : null}
      <Season s={d.season} taxYear={taxYear} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Returns filed"
          value={`${d.returns.filed} of ${d.returns.total}`}
          progress={pct(d.returns.filed, d.returns.total)}
          detail={`${d.returns.complete} complete · ${d.returns.waitingOnAuthority} waiting on IRS and FTB`}
        />
        <StatCard
          label="Collected"
          value={<Money cents={d.money.collectedCents} />}
          progress={pct(d.money.collectedCents, d.money.billedCents)}
          detail={`of ${formatCents(d.money.billedCents)} billed · ${formatCents(d.money.outstandingCents)} outstanding`}
        />
        <StatCard label="Waiting on you" value={d.waitingOnYou.total} detail={`${d.waitingOnYou.toPrepare} returns to prepare · ${d.waitingOnYou.inbox} in Inbox`} />
        <StatCard
          label="Avg. days in stage"
          value={d.daysInStage.average}
          detail={d.daysInStage.over7 ? `${d.daysInStage.over7} returns over 7 days` : "Nothing over 7 days"}
          detailTone={d.daysInStage.over7 ? "warning" : "muted"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Returns by stage</CardTitle>
            <CardDescription>Click a stage to open it in the pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {d.byStage.map((b) => (
              <Link key={b.stage} to={`/pipeline?stage=${b.stage}`} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3 rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                <StagePill stage={b.stage} />
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className={cn("block h-full rounded-full", WAITING_BAR[b.waiting])} style={{ width: `${(b.count / maxStage) * 100}%` }} />
                </span>
                <span className="text-right text-sm font-medium tabular-nums">{b.count}</span>
              </Link>
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

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div className="grid gap-1.5">
              <CardTitle>Health checks</CardTitle>
              <CardDescription>Things that need a look before they turn into problems.</CardDescription>
            </div>
            {d.needAttention ? <span className="text-sm font-medium text-warning-foreground">{d.needAttention} need attention</span> : null}
          </CardHeader>
          <CardContent>
            {d.health.map((h) => (
              <HealthCheckRow
                key={h.key}
                tone={h.tone}
                title={h.title}
                detail={h.detail}
                action={
                  h.count > 0 ? (
                    <Button variant="outline" size="sm" onClick={() => navigate(h.link)}>
                      {h.key === "inbox" ? "Open" : "Review"}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Returns filed per week</CardTitle>
            <CardDescription>
              {d.filingsPerWeek.filedSoFar} filed so far · {d.filingsPerWeek.lastYearBySameDay} by this point last season
            </CardDescription>
          </CardHeader>
          <CardContent>
            {d.filingsPerWeek.weeks.length ? (
              <ChartContainer config={chart} className="h-56 w-full">
                <BarChart data={d.filingsPerWeek.weeks.map((w) => ({ ...w, week: formatDate(`${w.weekOf}T12:00:00Z`, { month: "short", day: "numeric" }) }))} accessibilityLayer>
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

        <Card>
          <CardHeader>
            <CardTitle>Billing by package</CardTitle>
            <CardDescription>What's been invoiced this season, by package.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {d.billingByPackage.length ? (
              d.billingByPackage.map((p) => (
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
      </div>
    </div>
  );
}
