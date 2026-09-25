import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "../utils"

// shadcn's chart wrapper on Recharts, trimmed: colours come from a config mapped to CSS variables (use the
// --chart-* tokens), a themed tooltip and legend. Admin 03: filings per week, billing by package.

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)
function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error("useChart must be used within a <ChartContainer />")
  return ctx
}

function ChartContainer({ id, className, children, config, ...props }: React.ComponentProps<"div"> & { config: ChartConfig; children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"] }) {
  const unique = React.useId()
  const chartId = `chart-${id ?? unique.replace(/:/g, "")}`
  // Colours as CSS variables on the container itself (style attribute, no injected <style>).
  const vars = Object.fromEntries(Object.entries(config).filter(([, c]) => c.color).map(([k, c]) => [`--color-${k}`, c.color])) as React.CSSProperties
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        style={vars}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipItem = { dataKey?: string | number; name?: string | number; value?: number | string; color?: string }

function ChartTooltipContent({ active, payload, label, formatter }: { active?: boolean; payload?: TooltipItem[]; label?: React.ReactNode; formatter?: (value: number | string) => React.ReactNode }) {
  const { config } = useChart()
  if (!active || !payload?.length) return null
  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl">
      {label != null ? <div className="font-medium">{label}</div> : null}
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.name)
        return (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-[2px]" style={{ background: item.color ?? `var(--color-${key})` }} />
              {config[key]?.label ?? key}
            </span>
            <span className="font-mono font-medium tabular-nums">{formatter && item.value != null ? formatter(item.value) : item.value}</span>
          </div>
        )
      })}
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({ payload }: { payload?: { dataKey?: string | number; value?: string; color?: string }[] }) {
  const { config } = useChart()
  if (!payload?.length) return null
  return (
    <div className="flex items-center justify-center gap-4 pt-3">
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value)
        return (
          <div key={key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-[2px]" style={{ background: item.color }} />
            {config[key]?.label ?? key}
          </div>
        )
      })}
    </div>
  )
}

export { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent }
