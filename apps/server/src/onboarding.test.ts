import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { EngagementList, HouseholdDetail, PersonView } from "@app/schema";
import { demoWorld } from "./test-harness";

// Onboarding: the preparer creates a household, its people, a return, who's on it, and logins.
// All names below are invented.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const m = (path: string, input: unknown) => w.call(P(), path, input, "mutation");
const q = (path: string, input?: unknown) => w.call(P(), path, input);
const newHousehold = async (name = "Quill-Marsh") => ((await m("household.create", { displayName: name })).data as { id: string }).id;
const addPerson = async (householdId: string, first: string, last: string, extra: Record<string, unknown> = {}) =>
  PersonView.parse((await m("person.add", { householdId, firstName: first, lastName: last, ...extra })).data);

describe("the invite flow, end to end", () => {
  test("household → people → return → who's on it → login → it shows up everywhere", async () => {
    const hh = await newHousehold();
    const robin = await addPerson(hh, "Robin", "Quill", { dateOfBirth: "1984-03-02", ssnLast4: "9321" });
    const sam = await addPerson(hh, "Sam", "Marsh", { dateOfBirth: "1986-07-19" });
    const kit = await addPerson(hh, "Kit", "Quill", { dateOfBirth: "2016-05-01" });

    const { engagementId } = (await m("engagement.create", { householdId: hh, taxYear: 2025 })).data as { engagementId: string };
    const set = await m("engagement.setPeople", {
      engagementId,
      primary: robin.personId,
      spouse: sam.personId,
      dependents: [{ personId: kit.personId, relationship: "daughter", monthsLivedWith: 12 }],
    });
    expect(set.status).toBe(200);

    const login = PersonView.parse((await m("login.create", { personId: robin.personId, email: "robin.quill@example.test" })).data);
    expect(login.login).toMatchObject({ email: "robin.quill@example.test", activated: false });
    expect(login.email).toBe("robin.quill@example.test"); // copied to the person when they had none

    const detail = HouseholdDetail.parse((await q("household.get", { householdId: hh })).data);
    expect(detail.members.map((p) => p.firstName)).toEqual(["Robin", "Sam", "Kit"]);
    expect(detail.access).toHaveLength(1); // the primary's household grant
    expect(detail.returns).toEqual([{ engagementId, taxYear: 2025, kind: "original", stage: "invited", filingStatus: null, filers: expect.arrayContaining(["Robin", "Sam"]) }]);

    const pipeline = EngagementList.parse((await q("engagement.list", { taxYear: 2025, search: "quill-marsh" })).data);
    expect(pipeline.rows.map((r) => r.engagementId)).toEqual([engagementId]);
    // The new client can see their return, and the first stage gate now passes.
    expect(((await w.call(login.login!.userId, "engagement.mine", undefined)).data as { engagementId: string }[]).map((r) => r.engagementId)).toContain(engagementId);
    expect((await m("engagement.advanceStage", { engagementId, to: "intake" })).status).toBe(200);

    for (const type of ["household.created", "person.added", "engagement.created", "engagement.people_set", "login.created", "access.granted"]) {
      expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE type = ? AND household_id = ?", type, hh).n).toBeGreaterThan(0);
    }
  });
});

describe("people", () => {
  test("R1: a likely duplicate is a warning the preparer can confirm past", async () => {
    const existing = w.get<{ first_name: string; last_name: string; date_of_birth: string; household: string }>(
      "SELECT p.first_name, p.last_name, p.date_of_birth, h.display_name AS household FROM people p JOIN households h ON h.id = p.household_id WHERE p.date_of_birth IS NOT NULL LIMIT 1",
    );
    const hh = await newHousehold("Duplicate check");
    const input = { householdId: hh, firstName: existing.first_name.toUpperCase(), lastName: existing.last_name, dateOfBirth: existing.date_of_birth };
    const warned = await m("person.add", input);
    expect(warned.status).toBe(409);
    expect(warned.error!.message).toContain(`in the ${existing.household} household`);
    expect((await m("person.add", { ...input, confirmDuplicate: true })).status).toBe(200);
  });

  test("only the last four digits of an SSN are ever accepted", async () => {
    const hh = await newHousehold("SSN check");
    for (const ssn of ["900-12-3456", "900123456", "12345", "abcd"]) {
      expect((await m("person.add", { householdId: hh, firstName: "Ari", lastName: "Stone", ssnLast4: ssn })).status).toBe(400);
    }
    const ari = await addPerson(hh, "Ari", "Stone", { ssnLast4: "9001" });
    expect((await m("person.update", { personId: ari.personId, ssnLast4: "900-11-2222" })).status).toBe(400);
  });

  test("updates and moves record which fields changed, never the values", async () => {
    const a = await newHousehold("Move from");
    const b = await newHousehold("Move to");
    const lee = await addPerson(a, "Lee", "Park", { phone: "555-0100" });
    const moved = PersonView.parse((await m("person.update", { personId: lee.personId, householdId: b, phone: "555-0199" })).data);
    expect(moved).toMatchObject({ householdId: b, phone: "555-0199" });
    const ev = w.eventsOf("person.moved", lee.personId)[0]!;
    expect(ev.data).not.toContain("555");
    expect(JSON.parse(ev.data).fields).toContain("phone");
  });
});

describe("who's on a return: R6–R10 in plain words", () => {
  const seededFiler = () =>
    w.get<{ person_id: string; name: string; household: string }>(
      `SELECT rp.person_id, p.first_name || ' ' || p.last_name AS name, h.display_name AS household
         FROM return_people rp JOIN people p ON p.id = rp.person_id JOIN engagements e ON e.id = rp.engagement_id JOIN households h ON h.id = e.household_id
        WHERE rp.tax_year = 2025 AND rp.role = 'primary' AND rp.engagement_kind = 'original' LIMIT 1`,
    );
  const seededDependent = () =>
    w.get<{ person_id: string; name: string }>(
      `SELECT rp.person_id, p.first_name || ' ' || p.last_name AS name FROM return_people rp JOIN people p ON p.id = rp.person_id
        WHERE rp.tax_year = 2025 AND rp.role = 'dependent' AND rp.engagement_kind = 'original'
          AND NOT EXISTS (SELECT 1 FROM return_people o WHERE o.person_id = rp.person_id AND o.tax_year = 2025 AND o.role = 'primary')
        LIMIT 1`,
    );
  const freshReturn = async () => {
    const hh = await newHousehold("Rules check");
    const me = await addPerson(hh, "Jo", "Rivera", { confirmDuplicate: true });
    const { engagementId } = (await m("engagement.create", { householdId: hh, taxYear: 2025 })).data as { engagementId: string };
    return { hh, me, engagementId };
  };

  test("R6: someone who already files that year can't file again", async () => {
    const other = seededFiler();
    const { engagementId, me } = await freshReturn();
    const res = await m("engagement.setPeople", { engagementId, primary: me.personId, spouse: other.person_id });
    expect(res.status).toBe(409);
    expect(res.error!.message).toBe(`${other.name} already files an original 2025 return (${other.household} household).`);
  });

  test("R7: someone already claimed as a dependent can't be claimed again", async () => {
    const kid = seededDependent();
    const { engagementId, me } = await freshReturn();
    const res = await m("engagement.setPeople", { engagementId, primary: me.personId, dependents: [{ personId: kid.person_id, relationship: "son", monthsLivedWith: 6 }] });
    expect(res.error!.message).toMatch(new RegExp(`^${kid.name} is already claimed as a dependent for 2025`));
  });

  test("R8: a dependent elsewhere may still file their own return", async () => {
    const kid = seededDependent();
    const { engagementId } = await freshReturn();
    expect((await m("engagement.setPeople", { engagementId, primary: kid.person_id })).status).toBe(200);
  });

  test("R9: nobody appears twice", async () => {
    const { engagementId, me } = await freshReturn();
    const res = await m("engagement.setPeople", { engagementId, primary: me.personId, dependents: [{ personId: me.personId, relationship: "self", monthsLivedWith: 12 }] });
    expect(res.status).toBe(400);
    expect(res.error!.message).toBe("Jo Rivera is listed twice.");
  });

  test("setting people again replaces them, and it's frozen once preparation starts", async () => {
    const { engagementId, me, hh } = await freshReturn();
    const partner = await addPerson(hh, "Mo", "Rivera", { confirmDuplicate: true });
    await m("engagement.setPeople", { engagementId, primary: me.personId });
    await m("engagement.setPeople", { engagementId, primary: me.personId, spouse: partner.personId });
    expect(w.all("SELECT role FROM return_people WHERE engagement_id = ? ORDER BY role", engagementId)).toEqual([{ role: "primary" }, { role: "spouse" }]);

    const preparing = w.get<{ id: string; primary: string }>(
      "SELECT e.id, rp.person_id AS \"primary\" FROM engagements e JOIN return_people rp ON rp.engagement_id = e.id AND rp.role = 'primary' WHERE e.stage = 'preparing' AND e.tax_year = 2025 LIMIT 1",
    );
    const res = await m("engagement.setPeople", { engagementId: preparing.id, primary: preparing.primary });
    expect(res.status).toBe(412);
    expect(res.error!.message).toMatch(/Move it back first/);
  });

  test("filers named on a sent letter can't change until it's voided", async () => {
    const ready = w.get<{ id: string; primary: string }>(
      `SELECT e.id, rp.person_id AS "primary" FROM engagements e JOIN return_people rp ON rp.engagement_id = e.id AND rp.role = 'primary'
         JOIN engagement_letters l ON l.id = e.letter_id AND l.status = 'sent'
        WHERE e.stage = 'ready' AND e.tax_year = 2025 AND EXISTS (SELECT 1 FROM return_people s WHERE s.engagement_id = e.id AND s.role = 'spouse') LIMIT 1`,
    );
    const res = await m("engagement.setPeople", { engagementId: ready.id, primary: ready.primary });
    expect(res.error!.message).toMatch(/Void it before changing them/);
  });
});

describe("amended returns", () => {
  test("start with the original's people; must point at an original in the same household and year", async () => {
    const original = w.get<{ id: string; household_id: string }>(
      "SELECT id, household_id FROM engagements WHERE kind = 'original' AND tax_year = 2025 AND stage = 'complete' LIMIT 1",
    );
    const created = await m("engagement.create", { householdId: original.household_id, taxYear: 2025, kind: "amended", amendsId: original.id });
    const amendedId = (created.data as { engagementId: string }).engagementId;
    const people = (id: string) => w.all<{ person_id: string; role: string }>("SELECT person_id, role FROM return_people WHERE engagement_id = ? ORDER BY person_id", id);
    expect(people(amendedId)).toEqual(people(original.id));

    expect((await m("engagement.create", { householdId: original.household_id, taxYear: 2025, kind: "amended" })).error!.message).toMatch(/which original/);
    expect((await m("engagement.create", { householdId: original.household_id, taxYear: 2025, kind: "amended", amendsId: amendedId })).error!.message).toMatch(/not at another amendment/);
    expect((await m("engagement.create", { householdId: await newHousehold("Elsewhere"), taxYear: 2025, kind: "amended", amendsId: original.id })).error!.message).toMatch(/same household and tax year/);
    expect((await m("engagement.create", { householdId: original.household_id, taxYear: 2025, amendsId: original.id })).status).toBe(400);
  });
});

describe("logins and access", () => {
  test("one login per person, one person per email", async () => {
    const hh = await newHousehold("Login check");
    const a = await addPerson(hh, "Nia", "Ford");
    const b = await addPerson(hh, "Rae", "Ford");
    expect((await m("login.create", { personId: a.personId, email: "nia.ford@example.test" })).status).toBe(200);
    expect((await m("login.create", { personId: a.personId, email: "other@example.test" })).error!.message).toMatch(/already has a login/);
    expect((await m("login.create", { personId: b.personId, email: "NIA.FORD@example.test" })).error!.message).toMatch(/already used/);
  });

  test("granting and revoking a household, with history kept", async () => {
    const parents = await newHousehold("Grant parents");
    const helperHome = await newHousehold("Grant helper");
    const helper = await addPerson(helperHome, "Val", "Grant");
    const helperLogin = PersonView.parse((await m("login.create", { personId: helper.personId, email: "val.grant@example.test", grantHousehold: false })).data).login!;
    const { grantId } = (await m("access.grant", { userId: helperLogin.userId, householdId: parents })).data as { grantId: string };
    expect((await m("access.grant", { userId: helperLogin.userId, householdId: parents })).status).toBe(409);
    expect((await m("access.revoke", { grantId })).status).toBe(400);
    expect((await m("access.revoke", { grantId, reason: "No longer helping" })).status).toBe(200);
    const detail = HouseholdDetail.parse((await q("household.get", { householdId: parents })).data);
    expect(detail.access[0]).toMatchObject({ grantId, email: "val.grant@example.test" });
    expect(detail.access[0]!.revokedAt).not.toBeNull();
  });
});

describe("households list and archive", () => {
  test("search by household or person; archived households hide unless asked for", async () => {
    const hh = await newHousehold("Archive check");
    await addPerson(hh, "Zephyr", "Oakes");
    const found = (await q("household.list", { search: "zephyr" })).data as { id: string }[];
    expect(found.map((h) => h.id)).toEqual([hh]);
    await m("household.update", { householdId: hh, archived: true });
    expect(((await q("household.list", { search: "zephyr" })).data as unknown[]).length).toBe(0);
    expect(((await q("household.list", { search: "zephyr", includeArchived: true })).data as unknown[]).length).toBe(1);
  });
});

describe("authorization", () => {
  test("clients can't use any of it; live mode is closed until auth", async () => {
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    const hh = w.get<{ id: string }>("SELECT id FROM households LIMIT 1").id;
    expect((await w.call(client, "household.create", { displayName: "Nope" }, "mutation")).status).toBe(403);
    expect((await w.call(client, "household.get", { householdId: hh })).status).toBe(403);
    expect((await w.call(client, "person.add", { householdId: hh, firstName: "No", lastName: "Pe" }, "mutation")).status).toBe(403);
    expect((await w.call(client, "engagement.create", { householdId: hh, taxYear: 2025 }, "mutation")).status).toBe(403);
    w.use("live");
    expect((await w.call(null, "household.list", undefined)).status).toBe(401);
  });
});
