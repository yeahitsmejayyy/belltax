import { EngagementList, EngagementListInput, MyEngagement, Stage } from "@app/schema";
import { z } from "zod";
import { runtime } from "../db/client";
import { authedProcedure, preparerProcedure, router } from "../trpc";

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

  // The signed-in client's own returns, newest season first. Filer access wins over a grant.
  mine: authedProcedure.output(z.array(MyEngagement)).query(({ ctx }) => {
    const rows = runtime()
      .db.query<Record<string, string | number | null>, [string]>(
        `SELECT p.engagement_id, p.household_name, p.tax_year, p.kind, p.filing_status, p.stage, p.open_requests, p.balance_cents,
                MIN(ca.via) AS via
           FROM client_access ca JOIN pipeline_rows p ON p.engagement_id = ca.engagement_id
          WHERE ca.user_id = ?
          GROUP BY p.engagement_id
          ORDER BY p.tax_year DESC, p.kind, p.household_name`,
      )
      .all(ctx.user.id);
    return rows.map((r) => ({
      engagementId: r.engagement_id as string,
      householdName: r.household_name as string,
      taxYear: r.tax_year as number,
      kind: r.kind as MyEngagement["kind"],
      filingStatus: r.filing_status as MyEngagement["filingStatus"],
      stage: r.stage as MyEngagement["stage"],
      via: r.via as MyEngagement["via"],
      openRequests: r.open_requests as number,
      balanceCents: r.balance_cents as number,
    }));
  }),
});
