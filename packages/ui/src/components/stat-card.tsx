import { AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { Progress } from "./progress";

// The dashboard's KPIs and health checks (admin 03-dashboard-dashboard).

export function StatCard({ label, value, progress, detail, detailTone = "muted", className }: { label: string; value: React.ReactNode; progress?: number; detail?: React.ReactNode; detailTone?: "muted" | "warning"; className?: string }) {
  return (
    <div data-slot="stat-card" className={cn("grid content-start gap-3 rounded-xl border bg-card p-5", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
      {progress !== undefined ? <Progress value={progress} aria-label={label} /> : null}
      {detail ? <span className={cn("text-sm", detailTone === "warning" ? "text-warning-foreground" : "text-muted-foreground")}>{detail}</span> : null}
    </div>
  );
}

export type HealthTone = "ok" | "info" | "warning" | "danger";
const HEALTH: Record<HealthTone, { icon: LucideIcon; cls: string }> = {
  ok: { icon: CheckCircle2, cls: "bg-success-subtle text-success-foreground" },
  info: { icon: Info, cls: "bg-info-subtle text-info-foreground" },
  // Warning icons draw in the foreground shade: the solid amber is under 3:1 on white (principles.md, open question 2).
  warning: { icon: TriangleAlert, cls: "bg-warning-subtle text-warning-foreground" },
  danger: { icon: AlertCircle, cls: "bg-danger-subtle text-danger-foreground" },
};

export function HealthCheckRow({ tone, title, detail, action }: { tone: HealthTone; title: React.ReactNode; detail?: React.ReactNode; action?: React.ReactNode }) {
  const h = HEALTH[tone];
  return (
    <div data-slot="health-check" data-tone={tone} className="flex items-center gap-3 border-b py-3 last:border-0">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", h.cls)}>
        <h.icon aria-hidden="true" className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
      </div>
      {action}
    </div>
  );
}
