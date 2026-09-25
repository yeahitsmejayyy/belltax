import type { Database } from "bun:sqlite";
import { SeasonPreview, SeasonPreviewInput, SeasonReport, SeasonRolloverInput, type SeasonPlanItem } from "@app/schema";
import type { EngagementRef } from "../access";
import { runtime } from "../db/client";
import type { SessionUser } from "../identity";
import { preparerProcedure, router } from "../trpc";
import { createExpected, isOpenFor, lastYearSources, startNextYear } from "./source";

// Before January: open next season for every returning client in one step. The plan says, for each of
// last year's returns, whether it rolls over and why not; the rollover re-plans each household inside its
// own transaction (so it acts on what's true right then, and one bad household can't block the rest).

type Person = { person_id: string; role: string; relationship: string | null; months_lived_with: number | null; name: string; household_id: string | null };
type Planned = SeasonPlanItem & { ref: EngagementRef; carry: Person[] };

const householdsWithReturns = (db: Database, fromYear: number, only?: string[]) =>
  db
    .query<{ id: string; display_name: string; archived_at: string | null }, [number]>(
      `SELECT h.id, h.display_name, h.archived_at FROM households h
        WHERE EXISTS (SELECT 1 FROM engagements e WHERE e.household_id = h.id AND e.tax_year = ?)
        ORDER BY h.display_name, h.id`,
    )
    .all(fromYear)
    .filter((h) => !only || only.includes(h.id));

function planHousehold(db: Database, h: { id: string; display_name: string; archived_at: string | null }, fromYear: number): Planned[] {
  const toYear = fromYear + 1;
  const returns = db
    .query<{ id: string; kind: string; stage: string }, [string, number]>(
      "SELECT id, kind, stage FROM engagements WHERE household_id = ? AND tax_year = ? ORDER BY kind DESC, created_at, id",
    )
    .all(h.id, fromYear);
  return returns.map((r) => {
    const people = db
      .query<Person, [string]>(
        `SELECT rp.person_id, rp.role, rp.relationship, rp.months_lived_with, p.first_name || ' ' || p.last_name AS name, p.household_id
           FROM return_people rp JOIN people p ON p.id = rp.person_id
          WHERE rp.engagement_id = ?
          ORDER BY CASE rp.role WHEN 'primary' THEN 0 WHEN 'spouse' THEN 1 ELSE 2 END, p.date_of_birth`,
      )
      .all(r.id);
    const filers = people.filter((p) => p.role !== "dependent");
    const onNext = (p: Person, asFiler: boolean) =>
      !!db
        .query(
          `SELECT 1 FROM return_people WHERE person_id = ? AND tax_year = ? AND engagement_kind = 'original'
             AND ${asFiler ? "role IN ('primary', 'spouse')" : "role = 'dependent'"}`,
        )
        .get(p.person_id, toYear);
    const base = {
      householdId: h.id,
      householdName: h.display_name,
      fromEngagementId: r.id,
      filers: filers.map((p) => p.name),
      ref: { id: r.id, household_id: h.id, tax_year: fromYear, stage: r.stage },
    };
    const skip = (reason: string): Planned => ({ ...base, action: "skip", reason, people: 0, dependentsLeft: [], sourcesToCarry: 0, carry: [] });

    if (h.archived_at) return skip("The household is archived.");
    if (r.kind !== "original") return skip(`An amended ${fromYear} return; ${toYear} starts from the original.`);
    if (r.stage !== "complete") return skip(`The ${fromYear} return is at "${r.stage}", not complete. Finish it, or start ${toYear} from the return itself.`);
    const moved = filers.find((p) => p.household_id !== h.id);
    if (moved) return skip(`${moved.name} is now in another household. Start ${toYear} by hand.`);
    const already = filers.find((p) => onNext(p, true));
    if (already) return skip(`${already.name} is already on a ${toYear} return.`);

    const left = people.filter((p) => p.role === "dependent" && (p.household_id !== h.id || onNext(p, false)));
    const carry = people.filter((p) => !left.includes(p));
    return {
      ...base,
      action: "create",
      reason: null,
      people: carry.length,
      dependentsLeft: left.map((p) => p.name),
      sourcesToCarry: lastYearSources(db, r.id).filter((s) => isOpenFor(s, toYear)).length,
      carry,
    };
  });
}

const publicItem = ({ ref: _ref, carry: _carry, ...item }: Planned): SeasonPlanItem => item;

export const seasonRouter = router({
  preview: preparerProcedure
    .input(SeasonPreviewInput)
    .output(SeasonPreview)
    .query(({ input }) => {
      const { db } = runtime();
      const items = householdsWithReturns(db, input.fromYear).flatMap((h) => planHousehold(db, h, input.fromYear).map(publicItem));
      return { fromYear: input.fromYear, toYear: input.fromYear + 1, items };
    }),

  rollover: preparerProcedure
    .input(SeasonRolloverInput)
    .output(SeasonReport)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const report: SeasonReport = { fromYear: input.fromYear, toYear: input.fromYear + 1, created: [], skipped: [], failed: [] };
      for (const h of householdsWithReturns(db, input.fromYear, input.householdIds)) {
        let plan: Planned[] = [];
        try {
          db.transaction(() => {
            plan = planHousehold(db, h, input.fromYear);
            report.created.push(...rollHousehold(db, ctx.user, plan));
          })();
          for (const p of plan) if (p.action === "skip") report.skipped.push({ ...strip(p), reason: p.reason! });
        } catch (e) {
          // Nothing from this household was kept; say so for each return that would have rolled.
          for (const p of plan) {
            if (p.action === "skip") report.skipped.push({ ...strip(p), reason: p.reason! });
            else report.failed.push({ ...strip(p), error: e instanceof Error ? e.message : "Failed." });
          }
        }
      }
      return report;
    }),
});

const strip = (p: Planned) => ({ householdId: p.householdId, householdName: p.householdName, fromEngagementId: p.fromEngagementId, filers: p.filers });

function rollHousehold(db: Database, user: SessionUser, plan: Planned[]): SeasonReport["created"] {
  return plan
    .filter((p) => p.action === "create")
    .map((p) => {
      const { id, carried } = startNextYear(db, user, p.ref, p.carry, { rollover: true });
      const next: EngagementRef = { id, household_id: p.householdId, tax_year: p.ref.tax_year + 1, stage: "invited" };
      const { createdIds } = createExpected(db, user, next);
      return { ...strip(p), engagementId: id, people: p.people, dependentsLeft: p.dependentsLeft, sourcesCarried: carried, requestsCreated: createdIds.length };
    });
}
