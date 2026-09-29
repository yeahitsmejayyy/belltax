import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { LetterView, PracticeView, PublicPractice } from "@app/schema";
import { demoWorld } from "./test-harness";

// Ticket 37: the practice's own details, stored once (migration 007) and used wherever they appear.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const m = (path: string, input: unknown) => w.call(P(), path, input, "mutation");
const get = async () => PracticeView.parse((await w.call(P(), "settings.practice.get", undefined)).data);
const DESIGN = { practiceName: "BellTaxPrep", preparerName: "Patrick J. Bell", replyToEmail: "pj@belltaxprep.example", phone: "(555) 010-0142", city: "Los Angeles", state: "CA" };

describe("Settings → Practice", () => {
  test("ships with the design's (invented) details", async () => {
    expect(await get()).toMatchObject({ ...DESIGN, preparerCredential: null });
  });

  test("a save records exactly what changed, once; saving the same again records nothing", async () => {
    const res = await m("settings.practice.update", { ...DESIGN, preparerCredential: "EA", city: "Pasadena" });
    expect(PracticeView.parse(res.data)).toMatchObject({ preparerCredential: "EA", city: "Pasadena", state: "CA" });
    const events = w.eventsOf("settings.practice_updated", "practice");
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]!.data)).toEqual({ preparerCredential_from: null, preparerCredential_to: "EA", city_from: "Los Angeles", city_to: "Pasadena" });
    await m("settings.practice.update", { ...DESIGN, preparerCredential: "EA", city: "Pasadena" });
    expect(w.eventsOf("settings.practice_updated", "practice")).toHaveLength(1);
    await m("settings.practice.update", { ...DESIGN, preparerCredential: "", city: "Los Angeles" }); // blank means none
    expect((await get()).preparerCredential).toBeNull();
  });

  test("bad values are refused with a sentence that says what to do", async () => {
    for (const [bad, message] of [
      [{ replyToEmail: "pj@" }, "Enter a valid email"],
      [{ phone: "555-0142" }, "Enter a 10-digit US number"],
      [{ state: "California" }, "two-letter state"],
      [{ practiceName: "  " }, "Enter the practice name."],
    ] as const) {
      const res = await m("settings.practice.update", { ...DESIGN, ...bad });
      expect({ bad, status: res.status, has: (res.error?.message ?? "").includes(message) }).toEqual({ bad, status: 400, has: true });
    }
    expect((await get()).replyToEmail).toBe(DESIGN.replyToEmail);
  });
});

describe("letters use it", () => {
  test("the next draft carries the new name; a sent letter never changes", async () => {
    const sent = w.get<{ id: string; body: string; body_sha256: string }>("SELECT id, body, body_sha256 FROM engagement_letters WHERE status IN ('sent', 'signed') LIMIT 1");
    await m("settings.practice.update", { ...DESIGN, practiceName: "Demo Bell Tax Co" });
    const id = w.get<{ id: string }>(
      `SELECT e.id FROM engagements e WHERE e.letter_id IS NULL AND e.kind = 'original' AND e.tax_year = 2025
         AND EXISTS (SELECT 1 FROM return_people rp WHERE rp.engagement_id = e.id AND rp.role = 'primary')
         AND (e.filing_status IS NULL OR e.filing_status <> 'mfs') ORDER BY e.id LIMIT 1`,
    ).id;
    const draft = LetterView.parse((await m("letter.create", { engagementIds: [id] })).data);
    expect(draft.body).toContain("Demo Bell Tax Co");
    const after = w.get<{ body: string; body_sha256: string }>("SELECT body, body_sha256 FROM engagement_letters WHERE id = ?", sent.id);
    expect(after).toEqual({ body: sent.body, body_sha256: sent.body_sha256 });
    await m("settings.practice.update", DESIGN);
  });

  test("{{preparer_name}} is a merge field; the preview uses the practice's real details", async () => {
    const body = `Letter for {{household_name}}, tax year {{tax_year}}{{amended_note}}. Prepared by {{preparer_name}} at {{practice_name}} for {{filers}}: {{returns}}. {{date}}.`;
    const res = await w.call(P(), "settings.letterTemplate.preview", { body });
    const preview = res.data as { problems: string[]; rendered: string | null };
    expect(preview.problems).toEqual([]);
    expect(preview.rendered).toContain("Prepared by Patrick J. Bell at BellTaxPrep");
  });
});

describe("the public details", () => {
  test("anyone can read them on the portal; the texting number and edit time stay private", async () => {
    const res = await w.call(null, "practice.public", undefined, "query", "portal");
    expect(res.status).toBe(200);
    const pub = PublicPractice.parse(res.data);
    expect(pub).toMatchObject({ practiceName: DESIGN.practiceName, preparerName: DESIGN.preparerName, city: "Los Angeles", state: "CA" });
    expect(Object.keys(res.data as object).sort()).toEqual(["city", "practiceName", "preparerCredential", "preparerName", "replyToEmail", "state"]);
    expect(JSON.stringify(res.data)).not.toContain("010-0142");
  });

  test("editing is the admin's: 404 on the portal, 403 for a client", async () => {
    expect((await w.call(P(), "settings.practice.get", undefined, "query", "portal")).status).toBe(404);
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "settings.practice.update", DESIGN, "mutation")).status).toBe(403);
  });
});
