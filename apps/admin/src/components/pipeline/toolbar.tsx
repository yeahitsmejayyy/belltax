import { Stage } from "@app/schema";
import { Filter, Search } from "lucide-react";

import { Button } from "@app/ui/components/button";
import { Input } from "@app/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@app/ui/components/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { cn } from "@app/ui/utils";

import { stageLabel } from "@/lib/labels";
import { activeFilterCount, isMissing, isStale, isUnpaid, STALE_DAYS, type PipelineFilters, type PipelineRow, type SetPipelineFilters } from "./filters";

// The pipeline toolbar (admin 05-pipeline-board, 07-pipeline-stale, 35-phone-m-pipeline): view toggle, search,
// stage and the three quick filters with counts. On phones the stage and chips fold into a Filters popover.

type Props = { rows: PipelineRow[]; shown: number; selected: number; filters: PipelineFilters; setFilters: SetPipelineFilters };

function Chip({ on, onClick, label, count, className }: { on: boolean; onClick: () => void; label: string; count: number; className?: string }) {
  return (
    <Button
      variant="outline"
      aria-pressed={on}
      onClick={onClick}
      className={cn("group aria-pressed:border-primary aria-pressed:bg-brand-subtle aria-pressed:text-brand-subtle-foreground", className)}
    >
      {label} <span className="tabular-nums text-muted-foreground group-aria-pressed:text-inherit">· {count}</span>
    </Button>
  );
}

function Filters({ rows, filters: f, setFilters, touch }: Pick<Props, "rows" | "filters" | "setFilters"> & { touch?: boolean }) {
  const chip = touch ? "h-11 justify-between text-base" : undefined;
  return (
    <>
      <Select value={f.stage ?? "all"} onValueChange={(v) => setFilters({ stage: v === "all" ? null : (v as Stage) })}>
        <SelectTrigger size={touch ? "touch" : "default"} aria-label="Stage" className={touch ? "w-full" : "w-40"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {Stage.options.map((s) => (
            <SelectItem key={s} value={s}>
              {stageLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Chip className={chip} on={!!f.missing} onClick={() => setFilters({ missing: f.missing ? null : 1 })} label="Missing documents" count={rows.filter(isMissing).length} />
      <Chip className={chip} on={!!f.unpaid} onClick={() => setFilters({ unpaid: f.unpaid ? null : 1 })} label="Unpaid" count={rows.filter(isUnpaid).length} />
      <Chip
        className={chip}
        on={!!f.staleDays}
        onClick={() => setFilters({ staleDays: f.staleDays ? null : STALE_DAYS })}
        label={`Over ${f.staleDays ?? STALE_DAYS} days in stage`}
        count={rows.filter((r) => isStale(r, f.staleDays ?? STALE_DAYS)).length}
      />
    </>
  );
}

export function PipelineToolbar({ rows, shown, selected, filters, setFilters }: Props) {
  const active = activeFilterCount(filters);
  const clear = () => setFilters({ q: null, stage: null, missing: null, unpaid: null, staleDays: null });
  const chipsOn = activeFilterCount({ ...filters, q: "" });

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      {/* A two-way switch, not tabs: there are no tab panels, the whole page changes (axe: aria-valid-attr-value). */}
      <div role="group" aria-label="View" className="inline-flex h-11 w-fit items-center rounded-lg bg-muted p-1 text-muted-foreground md:h-9">
        {(["board", "table"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={filters.view === v}
            data-state={filters.view === v ? "active" : "inactive"}
            onClick={() => setFilters({ view: v })}
            className="inline-flex h-full items-center rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-card"
          >
            {v === "board" ? "Board" : "Table"}
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1 md:max-w-64 md:flex-none">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search by name"
          placeholder="Search by name"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value || null })}
          className="h-11 pl-9 md:h-9 md:w-64"
        />
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <Filters rows={rows} filters={filters} setFilters={setFilters} />
        {active ? (
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
        ) : null}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon-touch" className="relative md:hidden" aria-label={chipsOn ? `Filters, ${chipsOn} on` : "Filters"}>
            <Filter />
            {chipsOn ? (
              <span aria-hidden="true" className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {chipsOn}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-72 gap-2">
          <Filters rows={rows} filters={filters} setFilters={setFilters} touch />
          {active ? (
            <Button variant="ghost" size="touch" onClick={clear}>
              Clear filters
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>

      <p className="w-full text-sm text-muted-foreground tabular-nums md:ml-auto md:w-auto" aria-live="polite">
        {selected ? `${selected} selected · ` : ""}
        {shown === rows.length ? `${rows.length} return${rows.length === 1 ? "" : "s"}` : `${shown} of ${rows.length} returns`}
      </p>
    </div>
  );
}
