import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { HouseholdOnboardResult } from "@app/schema";
import { demoWorld } from "./test-harness";

// household.onboard (ticket 13): Invite client / Add client without invite, in one all-or-nothing step.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const onboard = (input: Record<string, unknown>) => w.call(P(), "household.onboard", input, "mutation");
const BASE = { mode: "invite", taxYear: 2026, surname: "Quartz", email: "jo.quartz@example.test", phone: null, filing: "mfj", filers: [0, 1] };
const FAMILY = [{ first: "Jo", role: "primary" }, { first: "Sam", role: "spouse" }, { first: "Kit", role: "dependent" }];
const count = (sql: string, ...p: string[]) => w.get<{ n: number }>(sql, ...p).n;

describe("invite", () => {
  test("a married couple with a child: one joint return, three people, a login for the primary with access", async () => {
    const r = HouseholdOnboardResult.parse((await onboard({ ...BASE, members: FAMILY })).data);
    expect(r.engagementIds).toHaveLength(1);
    expect(r.invited).toBe(true);
    expect(w.all("SELECT 1 FROM people WHERE household_id = ?", r.householdId)).toHaveLength(3);
    expect(w.all<{ role: string }>("SELECT role FROM return_people WHERE engagement_id = ? ORDER BY role", r.engagementIds[0]!).map((x) => x.role)).toEqual(["dependent", "primary", "spouse"]);
    expect(w.get<{ filing_status: string; stage: string }>("SELECT filing_status, stage FROM engagements WHERE id = ?", r.engagementIds[0]!)).toEqual({ filing_status: "mfj", stage: "invited" });
    const login = w.get<{ email: string; activated_at: string | null; first_name: string }>(
      "SELECT u.email, u.activated_at, p.first_name FROM users u JOIN people p ON p.id = u.person_id WHERE p.household_id = ?",
      r.householdId,
    );
    expect(login).toEqual({ email: "jo.quartz@example.test", activated_at: null, first_name: "Jo" });
    expect(count("SELECT COUNT(*) AS n FROM household_access WHERE household_id = ? AND revoked_at IS NULL", r.householdId)).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM events WHERE household_id = ? AND type = 'household.onboarded'", r.householdId)).toBe(1);
  });

  test("married filing separately makes one return per spouse", async () => {
    const r = HouseholdOnboardResult.parse((await onboard({ ...BASE, email: "b@example.test", surname: "Split", filing: "mfs", members: FAMILY.slice(0, 2) })).data);
    expect(r.engagementIds).toHaveLength(2);
    for (const id of r.engagementIds) expect(w.all("SELECT 1 FROM return_people WHERE engagement_id = ? AND role = 'primary'", id)).toHaveLength(1);
  });
});

describe("add without invite", () => {
  test("no email needed; no login is made", async () => {
    const r = HouseholdOnboardResult.parse((await onboard({ ...BASE, mode: "add", email: null, surname: "Later", filing: "single", filers: [0], members: [{ first: "Ren", role: "primary" }] })).data);
    expect(r.invited).toBe(false);
    expect(count("SELECT COUNT(*) AS n FROM users u JOIN people p ON p.id = u.person_id WHERE p.household_id = ?", r.householdId)).toBe(0);
  });
});

describe("all or nothing", () => {
  test("a rule broken is a sentence and nothing is written", async () => {
    const before = count("SELECT COUNT(*) AS n FROM households");
    for (const [change, message] of [
      [{ filing: "mfj", filers: [0] }, "Married filing jointly needs both spouses as filers."],
      [{ filing: "hoh", filers: [0], members: FAMILY.slice(0, 2) }, "Head of household needs a dependent."],
      [{ email: null }, "Enter the email the invite goes to."],
      [{ filers: [0, 2] }, "A dependent can't be a filer."],
      [{ members: [{ first: "A", role: "primary" }, { first: "B", role: "primary" }] }, "Mark exactly one member as the primary."],
    ] as const) {
      const res = await onboard({ ...BASE, members: FAMILY, ...change });
      expect({ message: res.error?.message, status: res.status }).toEqual({ message, status: 400 });
    }
    expect(count("SELECT COUNT(*) AS n FROM households")).toBe(before);
  });

  test("an email that already has a login stops everything", async () => {
    const taken = w.get<{ email: string }>("SELECT email FROM users WHERE role = 'client' LIMIT 1").email;
    const before = count("SELECT COUNT(*) AS n FROM people");
    const res = await onboard({ ...BASE, email: taken, members: FAMILY });
    expect(res.status).toBe(409);
    expect(count("SELECT COUNT(*) AS n FROM people")).toBe(before);
  });

  test("the preparer's only", async () => {
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "household.onboard", { ...BASE, members: FAMILY }, "mutation")).status).toBe(403);
    expect((await w.call(P(), "household.onboard", { ...BASE, members: FAMILY }, "mutation", "portal")).status).toBe(404);
  });
});
