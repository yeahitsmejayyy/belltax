import { Stage } from "@app/schema";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import type { RouterOutputs } from "@/lib/trpc";

// The pipeline's view and filters live in the URL, so the dashboard can link straight to a slice
// (/pipeline?stage=filed, ?staleDays=7, ?missing=1). Unknown params are left alone.

export type PipelineRow = RouterOutputs["engagement"]["list"]["rows"][number];

export const STALE_DAYS = 7;

const params = {
  view: parseAsStringLiteral(["board", "table"] as const).withDefault("board"),
  q: parseAsString.withDefault(""),
  stage: parseAsStringLiteral(Stage.options),
  missing: parseAsInteger,
  unpaid: parseAsInteger,
  staleDays: parseAsInteger,
};

export function usePipelineFilters() {
  return useQueryStates(params);
}

export type PipelineFilters = ReturnType<typeof usePipelineFilters>[0];
export type SetPipelineFilters = ReturnType<typeof usePipelineFilters>[1];

export const householdTitle = (r: PipelineRow) => (r.filers.length ? `${r.filers.join(" & ")} ${r.householdName}` : r.householdName);

export const isMissing = (r: PipelineRow) => r.openRequests > 0;
export const isUnpaid = (r: PipelineRow) => r.balanceCents > 0;
export const isStale = (r: PipelineRow, days: number) => r.daysInStage > days;

export function applyFilters(rows: PipelineRow[], f: PipelineFilters) {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || householdTitle(r).toLowerCase().includes(q)) &&
      (!f.stage || r.stage === f.stage) &&
      (!f.missing || isMissing(r)) &&
      (!f.unpaid || isUnpaid(r)) &&
      (!f.staleDays || isStale(r, f.staleDays)),
  );
}
