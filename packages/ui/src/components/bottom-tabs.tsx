import type { LucideIcon } from "lucide-react";

import { cn } from "../utils";

// The admin's phone navigation (admin 34-37): four tabs at the bottom, 44px+ targets, a badge for counts.
// The app renders its router links through `renderLink` so this stays router-agnostic.

export type BottomTab = { key: string; label: string; icon: LucideIcon; badge?: number };

export function BottomTabs({ tabs, active, renderLink, className }: { tabs: BottomTab[]; active: string; renderLink: (tab: BottomTab, children: React.ReactNode, className: string) => React.ReactNode; className?: string }) {
  return (
    <nav aria-label="Main" data-slot="bottom-tabs" className={cn("fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden", className)}>
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              {renderLink(
                t,
                <>
                  <span className={cn("relative flex h-7 w-14 items-center justify-center rounded-full transition-colors", on && "bg-brand-subtle")}>
                    <t.icon aria-hidden="true" className="size-5" />
                    {t.badge ? (
                      <span className="absolute -top-1.5 right-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
                        {t.badge}
                      </span>
                    ) : null}
                  </span>
                  <span>{t.label}</span>
                </>,
                cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  on ? "font-semibold text-foreground" : "text-muted-foreground",
                ),
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
