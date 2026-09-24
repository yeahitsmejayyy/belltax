import { EngagementList, EngagementListInput, Stage } from "@app/schema";
import { runtime } from "../db/client";
import { preparerProcedure, router } from "../trpc";

const DAY = 86_400_000;

type Row = {
  engagement_id: string;
  household_id: string;
  household_name: string;
  tax_year: number;
  kind: "original" | "amended";
  filing_status: EngagementList["rows"][number]["filingStatus"];
  stage: Stage;
  stage_changed_at: string;
  filers: string | null;
  open_requests: number;
  balance_cents: number;
  complexity: "simple" | "involved";
};

export const engagementRouter = router({
  // The preparer's pipeline for one tax year: board columns, counts, and every return in them.
  list: preparerProcedure
    .input(EngagementListInput)
    .output(EngagementList)
    .query(({ input }) => {
      const { db } = runtime();
      const years = db
        .query<{ tax_year: number }, []>("SELECT DISTINCT tax_year FROM engagements ORDER BY tax_year DESC")
        .all()
        .map((r) => r.tax_year);
      const taxYear = input?.taxYear ?? years[0] ?? null;
      const counts = Object.fromEntries(Stage.options.map((s) => [s, 0])) as Record<Stage, number>;
      if (taxYear === null) return { taxYear, years, counts, rows: [] };

      const search = input?.search?.toLowerCase() ?? "";
      const all = db
        .query<Row, [number, string, string, string]>(
          `SELECT p.*, c.label AS complexity
             FROM pipeline_rows p
             JOIN return_complexity c ON c.engagement_id = p.engagement_id
            WHERE p.tax_year = ?
              AND (? = '' OR instr(lower(p.household_name), ?) > 0 OR instr(lower(coalesce(p.filers, '')), ?) > 0)`,
        )
        .all(taxYear, search, search, search);

      for (const r of all) counts[r.stage]++;
      const now = Date.now();
      const rows = all
        .filter((r) => !input?.stage || r.stage === input.stage)
        .sort(
          (a, b) =>
            Stage.options.indexOf(a.stage) - Stage.options.indexOf(b.stage) || a.stage_changed_at.localeCompare(b.stage_changed_at),
        )
        .map((r) => ({
          engagementId: r.engagement_id,
          householdId: r.household_id,
          householdName: r.household_name,
          taxYear: r.tax_year,
          kind: r.kind,
          filingStatus: r.filing_status,
          stage: r.stage,
          stageChangedAt: r.stage_changed_at,
          daysInStage: Math.max(0, Math.floor((now - Date.parse(r.stage_changed_at)) / DAY)),
          filers: r.filers ? r.filers.split(" & ") : [],
          openRequests: r.open_requests,
          balanceCents: r.balance_cents,
          complexity: r.complexity,
        }));
      return { taxYear, years, counts, rows };
    }),
});
