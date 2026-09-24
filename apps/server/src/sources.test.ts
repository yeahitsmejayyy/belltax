import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { RequestView, SOURCE_DOCUMENT_KINDS, SourceView, type SourceKind } from "@app/schema";
import { z } from "zod";
import { demoWorld } from "./test-harness";

// Sources and the returning-client checklist, against the seeded demo world's returning households.

let w: Awaited<ReturnType<typeof demoWorld>>;
let intakeReturnId: string;
beforeAll(async () => {
  w = await demoWorld();
  intakeReturnId = w.get<{ id: string }>(
    "SELECT e.id FROM engagements e WHERE e.tax_year = 2025 AND e.kind = 'original' AND e.stage = 'intake' AND EXISTS (SELECT 1 FROM expected_documents x WHERE x.engagement_id = e.id)",
  ).id;
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const m = (path: string, input: unknown, as = P()) => w.call(as, path, input, "mutation");
const Created = z.object({ created: z.array(RequestView), skipped: z.int() });
const primaryUser = (engagementId: string) =>
  w.get<{ id: string }>("SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'", engagementId).id;

// The returning household whose 2025 return is still at intake: nothing attached yet, 2024 sources waiting.
const returningAtIntake = () => intakeReturnId;
const expectedKinds = (engagementId: string) =>
  w
    .all<{ kind: SourceKind }>("SELECT s.kind FROM expected_documents x JOIN sources s ON s.id = x.source_id WHERE x.engagement_id = ?", engagementId)
    .flatMap((s) => SOURCE_DOCUMENT_KINDS[s.kind])
    .sort();

describe("request.createExpected: the day-one checklist", () => {
  test("a returning household gets exactly last year's open sources as requests, once", async () => {
    const id = returningAtIntake();
    const want = expectedKinds(id);
    expect(want.length).toBeGreaterThan(0);

    const first = Created.parse((await m("request.createExpected", { engagementId: id })).data);
    expect(first.created.map((r) => r.documentKind).sort()).toEqual(want);
    expect(first.created.every((r) => r.status === "open" && /^Upload your .+ from .+/.test(r.title) && r.personId)).toBe(true);
    expect(w.all("SELECT 1 FROM expected_documents WHERE engagement_id = ?", id)).toEqual([]); // now carried onto the return

    const again = Created.parse((await m("request.createExpected", { engagementId: id })).data);
    expect(again.created).toEqual([]);
    expect(again.skipped).toBe(want.length);
  });

  test("a source closed last year drops off the checklist", async () => {
    const closed = w.get<{ id: string; household_id: string }>("SELECT id, household_id FROM sources WHERE last_year = 2024");
    const current = w.get<{ id: string }>("SELECT id FROM engagements WHERE household_id = ? AND tax_year = 2025 AND kind = 'original'", closed.household_id).id;
    await m("request.createExpected", { engagementId: current });
    expect(w.all("SELECT 1 FROM requests WHERE engagement_id = ? AND source_id = ?", current, closed.id)).toEqual([]);
  });
});

describe("engagement.startFromLastYear", () => {
  const completeReturning = () =>
    w.get<{ id: string; household_id: string }>(
      `SELECT e.id, e.household_id FROM engagements e WHERE e.tax_year = 2025 AND e.kind = 'original' AND e.stage = 'complete'
         AND EXISTS (SELECT 1 FROM return_sources rs WHERE rs.engagement_id = e.id) ORDER BY e.id LIMIT 1`,
    );

  test("next year's return has the same people and last year's still-open sources", async () => {
    const last = completeReturning();
    const res = await m("engagement.startFromLastYear", { engagementId: last.id });
    expect(res.status).toBe(200);
    const next = res.data as { engagementId: string; taxYear: number; sourcesCarried: number };
    expect(next.taxYear).toBe(2026);
    const people = (id: string) => w.all<{ person_id: string; role: string }>("SELECT person_id, role FROM return_people WHERE engagement_id = ? ORDER BY person_id", id);
    expect(people(next.engagementId)).toEqual(people(last.id));
    const lastSources = w.all<{ n: number }>("SELECT COUNT(*) AS n FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = ? AND (s.last_year IS NULL OR s.last_year >= 2026)", last.id)[0]!.n;
    expect(next.sourcesCarried).toBe(lastSources);

    // Then the checklist follows from what was carried.
    const list = Created.parse((await m("request.createExpected", { engagementId: next.engagementId })).data);
    expect(list.created.length).toBeGreaterThan(0);

    const twice = await m("engagement.startFromLastYear", { engagementId: last.id });
    expect(twice.status).toBe(409);
    expect(twice.error!.message).toMatch(/already on a 2026 return/);
  });

  test("starts from an original, not an amendment", async () => {
    const amended = w.get<{ id: string }>("SELECT id FROM engagements WHERE kind = 'amended'").id;
    expect((await m("engagement.startFromLastYear", { engagementId: amended })).error!.message).toMatch(/not an amendment/);
  });
});

describe("managing sources", () => {
  const household = () => w.get<{ id: string; person: string }>("SELECT h.id, p.id AS person FROM households h JOIN people p ON p.household_id = h.id LIMIT 1");

  test("a source always has an owner, and can't end before it started", async () => {
    const h = household();
    expect((await m("source.add", { householdId: h.id, kind: "brokerage", label: "Birch Investing", owners: [] })).status).toBe(400);
    const added = SourceView.parse((await m("source.add", { householdId: h.id, kind: "brokerage", label: "Birch Investing", owners: [h.person], firstYear: 2025 })).data);
    expect(added.owners.map((o) => o.personId)).toEqual([h.person]);
    expect(added.expectedDocuments).toEqual(["1099_b", "1099_div"]);
    expect((await m("source.close", { sourceId: added.id, lastYear: 2024 })).error!.message).toMatch(/started in 2025/);
    const closed = SourceView.parse((await m("source.close", { sourceId: added.id, lastYear: 2025, reason: "Account transferred" })).data);
    expect(closed.lastYear).toBe(2025);
    expect(w.eventsOf("source.closed", added.id)[0]!.reason).toBe("Account transferred");
  });

  test("attach only what belongs to the household or someone on the return; detach only if unused", async () => {
    const id = w.get<{ id: string }>("SELECT id FROM engagements WHERE tax_year = 2025 AND kind = 'original' AND stage = 'invited' ORDER BY id LIMIT 1").id;
    const hh = w.get<{ household_id: string }>("SELECT household_id FROM engagements WHERE id = ?", id).household_id;
    const foreign = w.get<{ id: string }>("SELECT id FROM sources WHERE household_id <> ? LIMIT 1", hh).id;
    expect((await m("engagement.attachSources", { engagementId: id, sourceIds: [foreign] })).error!.message).toMatch(/doesn't belong/);

    const own = w.get<{ id: string }>("SELECT id FROM sources WHERE household_id = ? LIMIT 1", hh).id;
    expect((await m("engagement.attachSources", { engagementId: id, sourceIds: [own, own] })).data).toEqual({ attached: 1 });
    expect((await m("engagement.detachSource", { engagementId: id, sourceId: own })).status).toBe(200);
    await m("engagement.attachSources", { engagementId: id, sourceIds: [own] });
    await m("request.createExpected", { engagementId: id });
    expect((await m("engagement.detachSource", { engagementId: id, sourceId: own })).error!.message).toMatch(/already has requests/);
  });
});

describe("the client's side", () => {
  test("a client sees what we think they have; another household can't", async () => {
    const id = returningAtIntake();
    const mine = z.array(SourceView).parse((await w.call(primaryUser(id), "source.list", { engagementId: id })).data);
    expect(mine.length).toBeGreaterThan(0);
    const stranger = w.get<{ id: string }>(
      "SELECT u.id FROM users u JOIN return_people rp ON rp.person_id = u.person_id JOIN engagements e ON e.id = rp.engagement_id WHERE e.household_id <> (SELECT household_id FROM engagements WHERE id = ?) AND u.role = 'client' LIMIT 1",
      id,
    ).id;
    expect((await w.call(stranger, "source.list", { engagementId: id })).status).toBe(404);
  });

  test("'I left that job': no document this year withdraws its requests; a final document keeps them", async () => {
    const id = returningAtIntake();
    await m("request.createExpected", { engagementId: id });
    const client = primaryUser(id);
    const listed = z.array(SourceView).parse((await w.call(client, "source.list", { engagementId: id })).data);
    expect(listed.length).toBeGreaterThanOrEqual(2); // two employers in this household
    const [gone, finalYear] = listed;

    const left = SourceView.parse((await m("source.leave", { engagementId: id, sourceId: gone!.id, stillExpectDocument: false, note: "Left in 2024" }, client)).data);
    expect(left.lastYear).toBe(2024);
    expect(w.all("SELECT status FROM requests WHERE engagement_id = ? AND source_id = ?", id, gone!.id).every((r) => (r as { status: string }).status === "cancelled")).toBe(true);

    const final = SourceView.parse((await m("source.leave", { engagementId: id, sourceId: finalYear!.id, stillExpectDocument: true }, client)).data);
    expect(final.lastYear).toBe(2025);
    expect(w.all<{ status: string }>("SELECT status FROM requests WHERE engagement_id = ? AND source_id = ?", id, finalYear!.id).some((r) => r.status === "open")).toBe(true);
  });
});

describe("authorization", () => {
  test("clients can't manage sources or build checklists; live is closed until auth", async () => {
    const id = returningAtIntake();
    const client = primaryUser(id);
    const hh = w.get<{ household_id: string }>("SELECT household_id FROM engagements WHERE id = ?", id).household_id;
    expect((await m("request.createExpected", { engagementId: id }, client)).status).toBe(403);
    expect((await m("engagement.startFromLastYear", { engagementId: id }, client)).status).toBe(403);
    expect((await m("source.add", { householdId: hh, kind: "bank", label: "x", owners: [w.preparerId] }, client)).status).toBe(403);
    w.use("live");
    expect((await w.call(null, "source.list", { engagementId: id })).status).toBe(401);
  });
});
