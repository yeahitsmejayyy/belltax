import { TRPCError } from "@trpc/server";
import {
  AccessGrantInput,
  AccessRevokeInput,
  HouseholdCreateInput,
  HouseholdDetail,
  HouseholdGetInput,
  HouseholdListInput,
  HouseholdSummary,
  HouseholdUpdateInput,
  LoginCreateInput,
  now,
  PersonAddInput,
  PersonUpdateInput,
  PersonView,
} from "@app/schema";
import { z } from "zod";
import { runtime } from "../db/client";
import { appendEvent, VIEW_TYPE_SQL } from "../events";
import { preparerProcedure, router } from "../trpc";

// Onboarding: the preparer's side of "Invite client". Households, the people in them, logins and grants.
// Returns and who's on them live in routes/engagement.ts.

const notFound = (what: string) => new TRPCError({ code: "NOT_FOUND", message: `${what} not found.` });
const idOf = <T>(v: T | undefined, what: string) => {
  if (!v) throw notFound(what);
  return v;
};

type PersonRow = {
  id: string;
  household_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  date_of_birth: string | null;
  ssn_last4: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  user_email: string | null;
  activated_at: string | null;
};

const PERSON_SQL = `SELECT p.*, u.id AS user_id, u.email AS user_email, u.activated_at
  FROM people p LEFT JOIN users u ON u.person_id = p.id`;

const toPerson = (r: PersonRow): PersonView => ({
  personId: r.id,
  householdId: r.household_id,
  firstName: r.first_name,
  middleName: r.middle_name,
  lastName: r.last_name,
  suffix: r.suffix,
  dateOfBirth: r.date_of_birth,
  ssnLast4: r.ssn_last4,
  email: r.email,
  phone: r.phone,
  login: r.user_id ? { userId: r.user_id, email: r.user_email!, activated: !!r.activated_at } : null,
});

export const personById = (id: string) => {
  const r = runtime().db.query<PersonRow, [string]>(`${PERSON_SQL} WHERE p.id = ?`).get(id);
  return r ? toPerson(r) : null;
};

const householdExists = (id: string) => !!runtime().db.query("SELECT 1 FROM households WHERE id = ?").get(id);

export const householdRouter = router({
  create: preparerProcedure
    .input(HouseholdCreateInput)
    .output(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const id = Bun.randomUUIDv7();
      db.transaction(() => {
        db.run("INSERT INTO households (id, display_name, created_at) VALUES (?, ?, ?)", [id, input.displayName, now()]);
        appendEvent(db, { actor: ctx.user, type: "household.created", subjectType: "household", subjectId: id, householdId: id });
      })();
      return { id };
    }),

  update: preparerProcedure
    .input(HouseholdUpdateInput)
    .output(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      if (!householdExists(input.householdId)) throw notFound("Household");
      db.transaction(() => {
        if (input.displayName) db.run("UPDATE households SET display_name = ? WHERE id = ?", [input.displayName, input.householdId]);
        if (input.archived !== undefined) {
          db.run("UPDATE households SET archived_at = ? WHERE id = ?", [input.archived ? now() : null, input.householdId]);
        }
        appendEvent(db, {
          actor: ctx.user,
          type: input.archived ? "household.archived" : "household.updated",
          subjectType: "household",
          subjectId: input.householdId,
          householdId: input.householdId,
        });
      })();
      return { id: input.householdId };
    }),

  // The Clients screen: newest activity first.
  list: preparerProcedure
    .input(HouseholdListInput)
    .output(z.array(HouseholdSummary))
    .query(({ input }) => {
      const search = input?.search?.toLowerCase() ?? "";
      return runtime()
        .db.query<Record<string, string | number | null>, [number, string, string, string]>(
          `SELECT h.id, h.display_name, h.archived_at,
                  (SELECT COUNT(*) FROM people p WHERE p.household_id = h.id) AS members,
                  (SELECT COUNT(*) FROM people p JOIN users u ON u.person_id = p.id WHERE p.household_id = h.id) AS logins,
                  (SELECT MAX(tax_year) FROM engagements e WHERE e.household_id = h.id) AS latest_tax_year,
                  (SELECT MAX(occurred_at) FROM events ev WHERE ev.household_id = h.id AND NOT ${VIEW_TYPE_SQL}) AS last_activity_at
             FROM households h
            WHERE (? OR h.archived_at IS NULL)
              AND (? = '' OR instr(lower(h.display_name), ?) > 0
                   OR EXISTS (SELECT 1 FROM people p WHERE p.household_id = h.id AND instr(lower(p.first_name || ' ' || p.last_name), ?) > 0))
            ORDER BY last_activity_at DESC, h.display_name`,
        )
        .all(input?.includeArchived ? 1 : 0, search, search, search)
        .map((r) => ({
          id: r.id as string,
          displayName: r.display_name as string,
          archivedAt: r.archived_at as string | null,
          members: r.members as number,
          logins: r.logins as number,
          latestTaxYear: r.latest_tax_year as number | null,
          lastActivityAt: r.last_activity_at as string | null,
        }));
    }),

  // A client record: who's in the household, who can sign in to it, and every return it has filed.
  get: preparerProcedure
    .input(HouseholdGetInput)
    .output(HouseholdDetail)
    .query(({ input }) => {
      const { db } = runtime();
      const h = idOf(
        db.query<{ id: string; display_name: string; archived_at: string | null }, [string]>("SELECT id, display_name, archived_at FROM households WHERE id = ?").get(input.householdId),
        "Household",
      );
      const members = db
        .query<PersonRow, [string]>(`${PERSON_SQL} WHERE p.household_id = ? ORDER BY p.date_of_birth, p.first_name`)
        .all(h.id)
        .map(toPerson);
      const access = db
        .query<{ id: string; user_id: string; email: string; name: string | null; granted_at: string; revoked_at: string | null }, [string]>(
          `SELECT ha.id, ha.user_id, u.email, p.first_name || ' ' || p.last_name AS name, ha.granted_at, ha.revoked_at
             FROM household_access ha JOIN users u ON u.id = ha.user_id LEFT JOIN people p ON p.id = u.person_id
            WHERE ha.household_id = ? ORDER BY ha.granted_at`,
        )
        .all(h.id)
        .map((a) => ({ grantId: a.id, userId: a.user_id, email: a.email, name: a.name, grantedAt: a.granted_at, revokedAt: a.revoked_at }));
      const returns = db
        .query<{ engagement_id: string; tax_year: number; kind: "original" | "amended"; stage: HouseholdDetail["returns"][number]["stage"]; filing_status: HouseholdDetail["returns"][number]["filingStatus"]; filers: string | null }, [string]>(
          `SELECT engagement_id, tax_year, kind, stage, filing_status, filers FROM pipeline_rows WHERE household_id = ?
            ORDER BY tax_year DESC, kind, engagement_id`,
        )
        .all(h.id)
        .map((r) => ({
          engagementId: r.engagement_id,
          taxYear: r.tax_year,
          kind: r.kind,
          stage: r.stage,
          filingStatus: r.filing_status,
          filers: r.filers ? r.filers.split(" & ") : [],
        }));
      return { id: h.id, displayName: h.display_name, archivedAt: h.archived_at, members, access, returns };
    }),
});

export const personRouter = router({
  // Rule R1: a person exists once. A likely duplicate is a warning the preparer confirms past, not a block.
  add: preparerProcedure
    .input(PersonAddInput)
    .output(PersonView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      if (!householdExists(input.householdId)) throw notFound("Household");
      if (!input.confirmDuplicate) {
        const match = db
          .query<{ name: string; household: string | null }, [string, string, string | null, string | null, string | null, string | null]>(
            `SELECT p.first_name || ' ' || p.last_name AS name, h.display_name AS household
               FROM people p LEFT JOIN households h ON h.id = p.household_id
              WHERE lower(p.first_name) = lower(?) AND lower(p.last_name) = lower(?)
                AND ((? IS NOT NULL AND p.date_of_birth = ?) OR (? IS NOT NULL AND p.ssn_last4 = ?))
              LIMIT 1`,
          )
          .get(input.firstName, input.lastName, input.dateOfBirth ?? null, input.dateOfBirth ?? null, input.ssnLast4 ?? null, input.ssnLast4 ?? null);
        if (match) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `This looks like ${match.name}${match.household ? ` in the ${match.household} household` : ""}. Add them anyway only if it's a different person.`,
          });
        }
      }
      const id = Bun.randomUUIDv7();
      db.transaction(() => {
        db.run(
          `INSERT INTO people (id, household_id, first_name, middle_name, last_name, suffix, date_of_birth, ssn_last4, email, phone, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, input.householdId, input.firstName, input.middleName ?? null, input.lastName, input.suffix ?? null,
            input.dateOfBirth ?? null, input.ssnLast4 ?? null, input.email ?? null, input.phone ?? null, now(),
          ],
        );
        appendEvent(db, { actor: ctx.user, type: "person.added", subjectType: "person", subjectId: id, householdId: input.householdId });
      })();
      return personById(id)!;
    }),

  update: preparerProcedure
    .input(PersonUpdateInput)
    .output(PersonView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const before = idOf(personById(input.personId), "Person");
      if (input.householdId && !householdExists(input.householdId)) throw notFound("Household");
      const cols: Record<string, string | null | undefined> = {
        household_id: input.householdId,
        first_name: input.firstName,
        last_name: input.lastName,
        middle_name: input.middleName,
        suffix: input.suffix,
        date_of_birth: input.dateOfBirth,
        ssn_last4: input.ssnLast4,
        email: input.email,
        phone: input.phone,
      };
      const set = Object.entries(cols).filter(([, v]) => v !== undefined);
      if (!set.length) return before;
      db.transaction(() => {
        db.run(`UPDATE people SET ${set.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`, [...set.map(([, v]) => v ?? null), input.personId]);
        // Which fields changed, never their values: the audit log holds no personal data (R33).
        appendEvent(db, {
          actor: ctx.user,
          type: input.householdId !== undefined && input.householdId !== before.householdId ? "person.moved" : "person.updated",
          subjectType: "person",
          subjectId: input.personId,
          householdId: input.householdId ?? before.householdId,
          data: { fields: set.map(([k]) => k).join(",") },
        });
      })();
      return personById(input.personId)!;
    }),
});

export const loginRouter = router({
  // A portal login for a person (no password yet; invites and passwords arrive with auth, ticket 05).
  create: preparerProcedure
    .input(LoginCreateInput)
    .output(PersonView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const person = idOf(personById(input.personId), "Person");
      if (person.login) throw new TRPCError({ code: "CONFLICT", message: `${person.firstName} already has a login (${person.login.email}).` });
      if (db.query("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE").get(input.email)) {
        throw new TRPCError({ code: "CONFLICT", message: "That email is already used by another login." });
      }
      const userId = Bun.randomUUIDv7();
      const at = now();
      db.transaction(() => {
        db.run("INSERT INTO users (id, role, email, person_id, created_at) VALUES (?, 'client', ?, ?, ?)", [userId, input.email, person.personId, at]);
        if (!person.email) db.run("UPDATE people SET email = ? WHERE id = ?", [input.email, person.personId]);
        appendEvent(db, { actor: ctx.user, type: "login.created", subjectType: "user", subjectId: userId, householdId: person.householdId });
        if (input.grantHousehold && person.householdId) {
          const grantId = Bun.randomUUIDv7();
          db.run("INSERT INTO household_access (id, user_id, household_id, granted_by, granted_at) VALUES (?, ?, ?, ?, ?)", [grantId, userId, person.householdId, ctx.user.id, at]);
          appendEvent(db, { actor: ctx.user, type: "access.granted", subjectType: "household_access", subjectId: grantId, householdId: person.householdId });
        }
      })();
      return personById(person.personId)!;
    }),
});

export const accessRouter = router({
  // Open a household to a login: an adult child helping a parent, a caregiver.
  grant: preparerProcedure
    .input(AccessGrantInput)
    .output(z.object({ grantId: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const user = db.query<{ role: string }, [string]>("SELECT role FROM users WHERE id = ?").get(input.userId);
      if (!user || user.role !== "client") throw notFound("Client login");
      if (!householdExists(input.householdId)) throw notFound("Household");
      if (db.query("SELECT 1 FROM household_access WHERE user_id = ? AND household_id = ? AND revoked_at IS NULL").get(input.userId, input.householdId)) {
        throw new TRPCError({ code: "CONFLICT", message: "That login can already open this household." });
      }
      const grantId = Bun.randomUUIDv7();
      db.transaction(() => {
        db.run("INSERT INTO household_access (id, user_id, household_id, granted_by, granted_at) VALUES (?, ?, ?, ?, ?)", [grantId, input.userId, input.householdId, ctx.user.id, now()]);
        appendEvent(db, { actor: ctx.user, type: "access.granted", subjectType: "household_access", subjectId: grantId, householdId: input.householdId });
      })();
      return { grantId };
    }),

  // Close it again. The grant row stays as history; returns the person files remain theirs regardless.
  revoke: preparerProcedure
    .input(AccessRevokeInput)
    .output(z.object({ grantId: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const grant = idOf(
        db.query<{ household_id: string; revoked_at: string | null }, [string]>("SELECT household_id, revoked_at FROM household_access WHERE id = ?").get(input.grantId),
        "Access",
      );
      if (grant.revoked_at) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "That access is already revoked." });
      db.transaction(() => {
        db.run("UPDATE household_access SET revoked_at = ? WHERE id = ?", [now(), input.grantId]);
        appendEvent(db, { actor: ctx.user, type: "access.revoked", subjectType: "household_access", subjectId: input.grantId, householdId: grant.household_id, reason: input.reason });
      })();
      return { grantId: input.grantId };
    }),
});
