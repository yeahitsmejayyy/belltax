import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { LetterTemplateView, LetterView } from "@app/schema";
import { z } from "zod";
import { demoWorld } from "./test-harness";

// Practice settings: a versioned letter template. Pricing (packages + add-ons) is in pricing.test.ts.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const m = (path: string, input: unknown) => w.call(P(), path, input, "mutation");
const template = async () => LetterTemplateView.parse((await w.call(P(), "settings.letterTemplate.get", undefined)).data);
const GOOD = `Engagement letter for the {{household_name}} household, tax year {{tax_year}}{{amended_note}}.

{{practice_name}} will prepare: {{returns}}. Fees are on your invoice. Dated {{date}}.

Signed by each person filing: {{filers}}`;

describe("the letter template", () => {
  test("ships as version 1, the wording letters were already using", async () => {
    const t = await template();
    expect(t.current.version).toBe(1);
    expect(t.current.body).toContain("{{filers}}");
    expect(t.versions[0]!.letters).toBeGreaterThan(0); // every seeded letter came from it
    expect(t.requiredFields).toEqual(["household_name", "tax_year", "filers"]);
  });

  test("unknown or missing merge fields are refused, in words", async () => {
    const unknown = await m("settings.letterTemplate.publish", { body: `${GOOD}\n\nReference: {{ssn}} and {{client_email}}` });
    expect(unknown.status).toBe(400);
    expect(unknown.error!.message).toContain("Unknown merge fields: {{ssn}}, {{client_email}}.");
    const missing = await m("settings.letterTemplate.publish", { body: GOOD.replace("{{filers}}", "everyone") });
    expect(missing.error!.message).toContain("A letter must include {{filers}}.");
    const preview = (await w.call(P(), "settings.letterTemplate.preview", { body: GOOD })).data as { problems: string[]; rendered: string };
    expect(preview.problems).toEqual([]);
    expect(preview.rendered).toContain("Sample-Household household, tax year 2026");
    expect(preview.rendered).not.toMatch(/\{\{/);
  });

  test("publishing adds a version; new letters use it, existing letters keep theirs", async () => {
    const sent = w.get<{ id: string; body: string; body_sha256: string; template_version: number }>(
      "SELECT id, body, body_sha256, template_version FROM engagement_letters WHERE status = 'signed' LIMIT 1",
    );
    const published = await m("settings.letterTemplate.publish", { body: GOOD });
    expect(published.data).toEqual({ version: 2 });
    expect((await m("settings.letterTemplate.publish", { body: GOOD })).status).toBe(412); // nothing changed

    // An old letter is untouched: same text, same hash, still version 1.
    expect(w.get<object>("SELECT body, body_sha256, template_version FROM engagement_letters WHERE id = ?", sent.id)).toEqual({
      body: sent.body, body_sha256: sent.body_sha256, template_version: 1,
    });
    // A new letter comes from version 2.
    const fresh = w.get<{ id: string }>(
      "SELECT e.id FROM engagements e WHERE e.letter_id IS NULL AND e.tax_year = 2025 AND e.stage = 'invited' AND EXISTS (SELECT 1 FROM return_people rp WHERE rp.engagement_id = e.id) LIMIT 1",
    ).id;
    const letter = LetterView.parse((await m("letter.create", { engagementIds: [fresh] })).data);
    expect(letter.templateVersion).toBe(2);
    expect(letter.body).toStartWith("Engagement letter for the ");

    const t = await template();
    expect(t.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(w.eventsOf("settings.template_published", "2")).toHaveLength(1);
  });

  test("a published version can never be edited or deleted", () => {
    expect(() => w.db.run("UPDATE letter_templates SET body = 'changed' WHERE version = 1")).toThrow(/never changes/);
    expect(() => w.db.run("DELETE FROM letter_templates WHERE version = 1")).toThrow(/never changes/);
  });
});

describe("authorization", () => {
  test("404 on the portal, 403 for a client on the admin", async () => {
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(P(), "settings.pricing.list", undefined, "query", "portal")).status).toBe(404);
    expect((await w.call(client, "settings.letterTemplate.get", undefined, "query", "admin")).status).toBe(403);
    expect((await w.call(client, "settings.pricing.savePackage", { code: "single", filingStatus: "single", name: "Single", unitAmountCents: 1 }, "mutation", "admin")).status).toBe(403);
  });
});
