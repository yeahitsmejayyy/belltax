import { TRPCError } from "@trpc/server";
import { HouseholdOnboardInput, HouseholdOnboardResult, now } from "@app/schema";
import type { z } from "zod";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { preparerProcedure } from "../trpc";

// Invite client / Add client without invite, all at once and all or nothing: the household, its people, this
// year's return(s) with filing status and filers, and, for an invite, the primary's login and access to the
// household. The dialog checks the same rules as you type; these are the ones that count.

type Input = z.infer<typeof HouseholdOnboardInput>;

function problem(i: Input): string | null {
  const roles = i.members.map((m) => m.role);
  const count = (r: string) => roles.filter((x) => x === r).length;
  if (count("primary") !== 1) return "Mark exactly one member as the primary.";
  if (count("spouse") > 1) return "Only one spouse per household.";
  if (i.mode === "invite" && !i.email) return "Enter the email the invite goes to.";
  if (i.phone && i.phone.replace(/\D/g, "").length !== 10) return "Enter a 10-digit US number, or leave it blank.";
  const filers = [...new Set(i.filers)];
  if (filers.length !== i.filers.length || filers.some((f) => f >= i.members.length)) return "Choose filers from the household's members.";
  if (filers.some((f) => i.members[f]!.role === "dependent")) return "A dependent can't be a filer.";
  const hasSpouse = count("spouse") === 1;
  if ((i.filing === "mfj" || i.filing === "mfs") && !hasSpouse) return "Add a spouse to file as married.";
  if (i.filing === "mfj" && filers.length !== 2) return "Married filing jointly needs both spouses as filers.";
  if ((i.filing === "single" || i.filing === "hoh") && filers.length !== 1) return "This filing status has one filer.";
  if (i.filing === "hoh" && !roles.includes("dependent")) return "Head of household needs a dependent.";
  return null;
}

export const onboardProcedure = preparerProcedure
  .input(HouseholdOnboardInput)
  .output(HouseholdOnboardResult)
  .mutation(({ ctx, input }) => {
    const { db } = runtime();
    const why = problem(input);
    if (why) throw new TRPCError({ code: "BAD_REQUEST", message: why });
    const email = input.email?.trim() || null;
    if (email && input.mode === "invite" && db.query("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE").get(email)) {
      throw new TRPCError({ code: "CONFLICT", message: "That email already has a login. Open the existing household instead." });
    }
    const at = now();
    const householdId = Bun.randomUUIDv7();
    const engagementIds: string[] = [];

    db.transaction(() => {
      const ev = (type: string, subjectType: string, subjectId: string, engagementId: string | null = null, data?: Record<string, string | number | boolean | null>) =>
        appendEvent(db, { actor: ctx.user, type, subjectType, subjectId, householdId, engagementId, data });

      db.run("INSERT INTO households (id, display_name, created_at) VALUES (?, ?, ?)", [householdId, input.surname, at]);
      ev("household.created", "household", householdId);

      const people = input.members.map((m) => {
        const id = Bun.randomUUIDv7();
        const primary = m.role === "primary";
        db.run("INSERT INTO people (id, household_id, first_name, last_name, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
          id, householdId, m.first, input.surname, primary ? email : null, primary ? (input.phone?.trim() || null) : null, at,
        ]);
        ev("person.added", "person", id);
        return { id, role: m.role };
      });
      const dependents = people.filter((p) => p.role === "dependent");

      // One return, or with married filing separately one per filer. Dependents go on the first.
      const returns = input.filing === "mfs" ? input.filers.map((f) => [f]) : [input.filers];
      returns.forEach((filers, n) => {
        const id = Bun.randomUUIDv7();
        engagementIds.push(id);
        db.run(
          "INSERT INTO engagements (id, household_id, tax_year, kind, filing_status, stage, stage_changed_at, created_at) VALUES (?, ?, ?, 'original', ?, 'invited', ?, ?)",
          [id, householdId, input.taxYear, input.filing, at, at],
        );
        const onReturn = (personId: string, role: string, relationship: string | null, months: number | null) =>
          db.run(
            "INSERT INTO return_people (engagement_id, person_id, tax_year, engagement_kind, role, relationship, months_lived_with) VALUES (?, ?, ?, 'original', ?, ?, ?)",
            [id, personId, input.taxYear, role, relationship, months],
          );
        // The household's primary is the return's primary when they file; otherwise the filer is.
        const ordered = [...filers].sort((a, b) => (people[a]!.role === "primary" ? -1 : people[b]!.role === "primary" ? 1 : a - b));
        ordered.forEach((f, k) => onReturn(people[f]!.id, k === 0 ? "primary" : "spouse", null, null));
        if (n === 0) for (const d of dependents) onReturn(d.id, "dependent", "dependent", 12);
        ev("engagement.created", "engagement", id, id, { tax_year: input.taxYear, kind: "original" });
      });

      if (input.mode === "invite" && email) {
        const userId = Bun.randomUUIDv7();
        const primary = people.find((p) => p.role === "primary")!;
        db.run("INSERT INTO users (id, role, email, person_id, created_at) VALUES (?, 'client', ?, ?, ?)", [userId, email, primary.id, at]);
        ev("login.created", "user", userId);
        const grantId = Bun.randomUUIDv7();
        db.run("INSERT INTO household_access (id, user_id, household_id, granted_by, granted_at) VALUES (?, ?, ?, ?, ?)", [grantId, userId, householdId, ctx.user.id, at]);
        ev("access.granted", "household_access", grantId);
      }
      ev("household.onboarded", "household", householdId, null, { mode: input.mode, returns: engagementIds.length, filing: input.filing });
    })();

    return { householdId, engagementIds, invited: input.mode === "invite" };
  });
