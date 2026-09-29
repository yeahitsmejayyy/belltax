import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SearchResults } from "@app/schema";
import { demoWorld } from "./test-harness";

// Ticket 41: ⌘K search across clients, people, returns and invoices; word-prefix matching; never numbers
// that identify a person.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const search = async (q: string, as = P()) => SearchResults.parse((await w.call(as, "search.query", { q })).data);
const group = (r: SearchResults, type: string) => r.groups.find((g) => g.type === type)?.hits ?? [];
const somebody = () =>
  w.get<{ id: string; first: string; last: string; household_id: string; display_name: string }>(
    "SELECT p.id, p.first_name AS first, p.last_name AS last, p.household_id, h.display_name FROM people p JOIN households h ON h.id = p.household_id JOIN users u ON u.person_id = p.id ORDER BY p.id LIMIT 1",
  );

describe("finds each kind of thing", () => {
  test("a surname finds the client, its people and its returns", async () => {
    const s = somebody();
    const r = await search(s.display_name);
    expect(group(r, "client").map((h) => h.id)).toContain(s.household_id);
    expect(group(r, "person").map((h) => h.id)).toContain(s.id);
    const returns = group(r, "return");
    expect(returns.length).toBeGreaterThan(0);
    expect(returns.every((h) => h.householdId === s.household_id || h.label.toLowerCase().includes(s.display_name.toLowerCase().split(/[ -]/)[0]!))).toBe(true);
  });

  test("an invoice by its number, whole or just the end", async () => {
    const inv = w.get<{ id: string; number: string; engagement_id: string }>("SELECT id, number, engagement_id FROM invoices ORDER BY number LIMIT 1");
    const whole = group(await search(inv.number), "invoice");
    expect(whole[0]).toMatchObject({ id: inv.id, label: inv.number, engagementId: inv.engagement_id });
    expect(group(await search(inv.number.slice(5)), "invoice").map((h) => h.id)).toContain(inv.id);
  });

  test("a return by household and year", async () => {
    const e = w.get<{ id: string; display_name: string }>("SELECT e.id, h.display_name FROM engagements e JOIN households h ON h.id = e.household_id WHERE e.tax_year = 2025 ORDER BY e.id LIMIT 1");
    const hits = group(await search(`${e.display_name} 2025`), "return");
    expect(hits.map((h) => h.id)).toContain(e.id);
    expect(hits.every((h) => h.label.endsWith("TY 2025") || h.label.includes("TY 2025"))).toBe(true);
  });

  test("words match the starts of words, in any order, ignoring case", async () => {
    const s = somebody();
    const q = `${s.last.slice(0, 3).toUpperCase()} ${s.first.slice(0, 2).toLowerCase()}`;
    expect(group(await search(q), "person").map((h) => h.id)).toContain(s.id);
    expect(group(await search(s.first.slice(1, 4)), "person").map((h) => h.id)).not.toContain(s.id); // the middle of a word doesn't count
  });
});

describe("ranking and limits", () => {
  test("an exact name comes before one it only starts", async () => {
    for (const name of ["Larkspur", "Lark"]) await w.call(P(), "household.create", { displayName: name }, "mutation");
    const hits = group(await search("lark"), "client");
    expect(hits.slice(0, 2).map((h) => h.label)).toEqual(["Lark", "Larkspur"]);
  });

  test("at most eight per group", async () => {
    const r = await search("2025");
    for (const g of r.groups) expect(g.hits.length).toBeLessThanOrEqual(8);
    expect(group(r, "return").length).toBe(8); // there are more than eight 2025 returns
  });

  test("nothing matching is an empty answer, not an error; wildcards are just characters", async () => {
    expect((await search("zzqqx")).groups).toEqual([]);
    expect((await search("%")).groups).toEqual([]);
    expect((await search("_")).groups).toEqual([]);
  });
});

describe("never numbers that identify someone", () => {
  test("anything shaped like a full SSN finds nothing, however it's typed", async () => {
    for (const q of ["900-12-3456", "900123456", "900 12 3456"]) expect({ q, groups: (await search(q)).groups }).toEqual({ q, groups: [] });
  });

  test("the last four of an SSN isn't searchable either", async () => {
    const p = w.get<{ id: string; ssn_last4: string }>("SELECT id, ssn_last4 FROM people WHERE ssn_last4 IS NOT NULL LIMIT 1");
    expect(group(await search(p.ssn_last4), "person").map((h) => h.id)).not.toContain(p.id);
  });
});

describe("recent", () => {
  test("with nothing typed, the returns you opened last, newest first", async () => {
    const [a, b] = w.all<{ id: string }>("SELECT id FROM engagements WHERE tax_year = 2025 ORDER BY id LIMIT 2");
    await w.call(P(), "engagement.detail", { engagementId: a!.id });
    await new Promise((r) => setTimeout(r, 5));
    await w.call(P(), "engagement.detail", { engagementId: b!.id });
    const r = await search("  ");
    expect(r.recent).toBe(true);
    expect(r.groups[0]!.heading).toBe("Recent");
    expect(r.groups[0]!.hits.slice(0, 2).map((h) => h.id)).toEqual([b!.id, a!.id]);
  });
});

describe("who can", () => {
  test("the preparer only: 404 on the portal, 403 for a client", async () => {
    expect((await w.call(P(), "search.query", { q: "a" }, "query", "portal")).status).toBe(404);
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "search.query", { q: "a" })).status).toBe(403);
  });
});
