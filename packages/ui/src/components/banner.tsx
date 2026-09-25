import { AlertCircle, CheckCircle2, Info, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";

// A message that belongs to the page, not a moment: offline (portal 07), payment failed (portal 18,
// admin 17). Icon + words + tone, never colour alone. Toasts are for "that worked".

export type BannerTone = "info" | "success" | "warning" | "danger" | "offline";

const TONES: Record<BannerTone, { icon: LucideIcon; cls: string; role: "status" | "alert" }> = {
  info: { icon: Info, cls: "bg-info-subtle text-info-foreground border-info/30", role: "status" },
  success: { icon: CheckCircle2, cls: "bg-success-subtle text-success-foreground border-success/30", role: "status" },
  warning: { icon: TriangleAlert, cls: "bg-warning-subtle text-warning-foreground border-warning/40", role: "status" },
  danger: { icon: AlertCircle, cls: "bg-danger-subtle text-danger-foreground border-danger/30", role: "alert" },
  offline: { icon: WifiOff, cls: "bg-muted text-foreground border-border", role: "status" },
};

export function Banner({ tone = "info", title, children, action, className }: { tone?: BannerTone; title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const t = TONES[tone];
  return (
    <div data-slot="banner" data-tone={tone} role={t.role} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", t.cls, className)}>
      <t.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="grid flex-1 gap-0.5">
        <p className="font-medium">{title}</p>
        {children ? <div className="opacity-90">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
