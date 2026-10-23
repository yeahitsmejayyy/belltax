import { Stage } from "@app/schema";
import * as React from "react";
import { useNavigate } from "react-router-dom";

import { PipelineBoard, type BoardCardData } from "@app/ui/components/board";
import { PipelineEmpty, PipelineLoading, PipelineNoMatch, PipelineTable, PipelineToolbar, type PipelineChip, type PipelineTableRow } from "@app/ui/components/pipeline";

import { applyFilters, householdTitle, isMissing, isStale, isUnpaid, STALE_DAYS, usePipelineFilters, type PipelineFilters, type PipelineRow, type SetPipelineFilters } from "@/components/pipeline/filters";
import { useStageMove } from "@/components/stage-move";
import { FILING_SHORT } from "@/lib/labels";
import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";
import { useInvite } from "@/shell/invite";
import { usePageTitle } from "@/shell/header-slots";

// The pipeline (admin 05-pipeline-board, 06-table, 07-stale, 08-empty, 35-phone-m-pipeline): every return this
// tax year as a board or a table. Filters are in the URL and applied here over the year's rows.

const toCard = (r: PipelineRow): BoardCardData => ({
  id: r.engagementId,
  stage: r.stage,
  household: householdTitle(r),
  filers: r.filers.length === 1 ? "1 filer" : `${r.filers.length} filers`,
  filingStatus: r.filingStatus ? FILING_SHORT[r.filingStatus] : null,
  missingDocuments: r.openRequests,
  unpaid: r.balanceCents > 0,
  daysInStage: r.daysInStage,
});

const toTableRow = (r: PipelineRow): PipelineTableRow => ({
  id: r.engagementId,
  household: householdTitle(r),
  filers: r.filers.length,
  filing: r.filingStatus ? FILING_SHORT[r.filingStatus] : null,
  stage: r.stage,
  daysInStage: r.daysInStage,
  openRequests: r.openRequests,
  balanceCents: r.balanceCents,
  efile: r.efile,
});

// The three quick filters, with how many of the year's returns each matches.
const chipsFor = (rows: PipelineRow[], f: PipelineFilters, setFilters: SetPipelineFilters): PipelineChip[] => [
  { id: "missing", label: "Missing documents", on: !!f.missing, count: rows.filter(isMissing).length, onToggle: () => setFilters({ missing: f.missing ? null : 1 }) },
  { id: "unpaid", label: "Unpaid", on: !!f.unpaid, count: rows.filter(isUnpaid).length, onToggle: () => setFilters({ unpaid: f.unpaid ? null : 1 }) },
  {
    id: "stale",
    label: `Over ${f.staleDays ?? STALE_DAYS} days in stage`,
    on: !!f.staleDays,
    count: rows.filter((r) => isStale(r, f.staleDays ?? STALE_DAYS)).length,
    onToggle: () => setFilters({ staleDays: f.staleDays ? null : STALE_DAYS }),
  },
];

export default function Pipeline() {
  usePageTitle("Pipeline");
  const navigate = useNavigate();
  const invite = useInvite();
  const { taxYear } = useTaxYear();
  const [filters, setFilters] = usePipelineFilters();
  const [selected, setSelected] = React.useState<string[]>([]);
  const move = useStageMove();
  const q = trpc.engagement.list.useQuery(taxYear ? { taxYear } : undefined);

  const rows = React.useMemo(() => q.data?.rows ?? [], [q.data]);
  const shown = React.useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const cards = React.useMemo(() => shown.map(toCard), [shown]);
  const tableRows = React.useMemo(() => shown.map(toTableRow), [shown]);
  const filterKey = JSON.stringify([filters.q, filters.stage, filters.missing, filters.unpaid, filters.staleDays, q.data?.taxYear]);
  React.useEffect(() => setSelected([]), [filterKey]);

  if (!q.data) return <PipelineLoading />;

  const open = (id: string) => navigate(`/returns/${id}`);

  if (!rows.length) return <PipelineEmpty taxYear={q.data.taxYear} onInvite={() => invite("invite")} />;

  const clear = () => setFilters({ q: null, stage: null, missing: null, unpaid: null, staleDays: null });
  const noMatch = <PipelineNoMatch onClear={clear} />;

  return (
    <div className="grid min-w-0 animate-page gap-4 md:gap-6">
      <PipelineToolbar
        view={filters.view}
        onViewChange={(view) => setFilters({ view })}
        query={filters.q}
        onQueryChange={(q) => setFilters({ q: q || null })}
        stage={filters.stage}
        onStageChange={(stage) => setFilters({ stage })}
        chips={chipsFor(rows, filters, setFilters)}
        onClear={clear}
        total={rows.length}
        shown={shown.length}
        selected={filters.view === "table" ? selected.length : 0}
      />

      {filters.view === "table" ? (
        <PipelineTable key={filterKey} rows={tableRows} onOpen={open} onSelectionChange={setSelected} empty={noMatch} />
      ) : shown.length ? (
        <PipelineBoard
          cards={cards}
          stages={filters.stage ? [filters.stage] : undefined}
          staleAfterDays={filters.staleDays ?? STALE_DAYS}
          onOpen={open}
          // Forward one stage at a time, or back to any earlier stage (the server's rules), so other columns fade.
          canMove={(card, to) => {
            const d = Stage.options.indexOf(to) - Stage.options.indexOf(card.stage);
            return d === 1 || d < 0;
          }}
          onMove={(id, from, to) => {
            const row = shown.find((r) => r.engagementId === id);
            if (!row) return Promise.resolve(false);
            const m = { engagementId: id, name: householdTitle(row), from, to };
            return Stage.options.indexOf(to) > Stage.options.indexOf(from) ? move.advanceNow(m) : move.request(m);
          }}
          className="-mx-4 px-4 md:mx-0 md:px-0"
        />
      ) : (
        noMatch
      )}

      {move.dialog}
    </div>
  );
}
