import { SearchX, UserPlus, Workflow } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";

import { PipelineBoard, type BoardCardData } from "@app/ui/components/board";
import { Button } from "@app/ui/components/button";
import { EmptyState } from "@app/ui/components/empty-state";
import { Skeleton } from "@app/ui/components/skeleton";

import { applyFilters, householdTitle, STALE_DAYS, usePipelineFilters, type PipelineRow } from "@/components/pipeline/filters";
import { PipelineTable } from "@/components/pipeline/table";
import { PipelineToolbar } from "@/components/pipeline/toolbar";
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

function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading the pipeline">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="hidden h-9 w-96 md:block" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

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
  const filterKey = JSON.stringify([filters.q, filters.stage, filters.missing, filters.unpaid, filters.staleDays, q.data?.taxYear]);
  React.useEffect(() => setSelected([]), [filterKey]);

  if (!q.data) return <Loading />;

  const open = (id: string) => navigate(`/returns/${id}`);

  if (!rows.length) {
    const year = q.data.taxYear;
    return (
      <EmptyState
        icon={Workflow}
        className="animate-page border-none"
        title={year ? `No returns for TY ${year} yet` : "No returns yet"}
        description="Invite your first client to start the season. They get a link to set up their portal, answer intake questions and upload documents. Their return shows up here in Invited."
        action={
          <Button onClick={() => invite("invite")} className="h-11 md:h-9">
            <UserPlus /> Invite your first client
          </Button>
        }
      />
    );
  }

  const clear = () => setFilters({ q: null, stage: null, missing: null, unpaid: null, staleDays: null });
  const noMatch = (
    <EmptyState
      icon={SearchX}
      className="border-none"
      title="No returns match these filters"
      description="Try a different name or turn a filter off."
      action={
        <Button variant="outline" onClick={clear} className="h-11 md:h-9">
          Clear filters
        </Button>
      }
    />
  );

  return (
    <div className="grid min-w-0 animate-page gap-4 md:gap-6">
      <PipelineToolbar rows={rows} shown={shown.length} selected={filters.view === "table" ? selected.length : 0} filters={filters} setFilters={setFilters} />

      {filters.view === "table" ? (
        <PipelineTable key={filterKey} rows={shown} onOpen={open} onSelectionChange={setSelected} empty={noMatch} />
      ) : shown.length ? (
        <PipelineBoard
          cards={cards}
          stages={filters.stage ? [filters.stage] : undefined}
          staleAfterDays={filters.staleDays ?? STALE_DAYS}
          onOpen={open}
          onMove={(id, from, to) => {
            const row = shown.find((r) => r.engagementId === id);
            if (row) move.request({ engagementId: id, name: householdTitle(row), from, to });
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
