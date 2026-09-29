import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { InvoiceSuggestion, InvoiceSummary, PricingView, PublicPricing } from "@app/schema";
import { z } from "zod";
import { factsFor, loadPricing, suggest, type ReturnFacts } from "./money/pricing";
import { demoWorld } from "./test-harness";

// Ticket 36: pricing is packages + add-ons (migration 006). A package per filing status, add-ons on top,
// "Included" add-ons named but never charged, usage derived from invoices, issued invoices untouched.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const m = (path: string, input: unknown) => w.call(P(), path, input, "mutation");
const pricing = async (taxYear?: number) => PricingView.parse((await w.call(P(), "settings.pricing.list", taxYear ? { taxYear } : undefined)).data);
const facts = (f: Partial<ReturnFacts> & { triggers?: ReturnFacts["triggers"] }): ReturnFacts => ({ filingStatus: "single", isAmended: false, triggers: {}, ...f });

describe("the designed prices ship with it", () => {
  test("four packages by filing status, add-ons with one included and amended switched off", async () => {
    const p = await pricing();
    expect(p.packages.map((x) => [x.code, x.filingStatus, x.unitAmountCents])).toEqual([
      ["single", "single", 22500], ["hoh", "hoh", 31000], ["mfj", "mfj", 34000], ["mfs", "mfs", 24500],
    ]);
    expect(p.addons.find((a) => a.code === "ihss")).toMatchObject({ unitAmountCents: null, appliesWhen: "ihss", active: true });
    expect(p.addons.find((a) => a.code === "amended")).toMatchObject({ unitAmountCents: 15000, active: false });
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'fee_schedule'").n).toBe(0);
  });
});

describe("suggestions", () => {
  const P0 = () => loadPricing(w.db);

  test("the package follows the filing status; surviving spouse prices like joint; no status, no package", () => {
    for (const [status, code] of [["single", "single"], ["mfj", "mfj"], ["mfs", "mfs"], ["hoh", "hoh"], ["qss", "mfj"]] as const) {
      const s = suggest(P0(), facts({ filingStatus: status }));
      expect({ status, code: s.packageCode, first: s.lines[0]?.priceCode }).toEqual({ status, code, first: code });
    }
    expect(suggest(P0(), facts({ filingStatus: null }))).toEqual({ packageCode: null, lines: [], included: [] });
  });

  test("add-ons follow the facts: rentals per property, everything else once; included ones are named, not charged", () => {
    const s = suggest(P0(), facts({ filingStatus: "mfj", triggers: { rental: 2, self_employment: 3, ihss: 1, covered_california: 1, other_state: 1, investments: 1 } }));
    expect(s.lines.map((l) => [l.priceCode, l.quantity, l.unitAmountCents])).toEqual([
      ["mfj", 1, 34000], ["side_work", 1, 8500], ["covered_ca", 1, 4000], ["extra_state", 1, 6000], ["rental", 2, 12500], ["investments", 1, 7500],
    ]);
    expect(s.included).toEqual([{ code: "ihss", name: "IHSS home care income" }]);
    expect(s.lines.every((l) => l.unitAmountCents > 0)).toBe(true); // never a $0 line (R26)
  });

  test("an amendment is the 1040-X alone, and only when that add-on is on", async () => {
    expect(suggest(P0(), facts({ filingStatus: "mfj", isAmended: true, triggers: { rental: 1 } }))).toEqual({ packageCode: null, lines: [], included: [] });
    await m("settings.pricing.saveAddon", { code: "amended", name: "Amended return", description: "Form 1040-X for a prior year", unitAmountCents: 15000, appliesWhen: "amended", active: true });
    expect(suggest(P0(), facts({ filingStatus: "mfj", isAmended: true, triggers: { rental: 1 } })).lines).toEqual([
      { description: "Amended return", quantity: 1, unitAmountCents: 15000, priceCode: "amended" },
    ]);
    await m("settings.pricing.saveAddon", { code: "amended", name: "Amended return", description: "Form 1040-X for a prior year", unitAmountCents: 15000, appliesWhen: "amended", active: false });
  });

  test("inactive packages and add-ons are never suggested", async () => {
    await m("settings.pricing.savePackage", { code: "single", filingStatus: "single", name: "Single", description: "", unitAmountCents: 22500, active: false });
    await m("settings.pricing.saveAddon", { code: "side_work", name: "Side work or gig income", unitAmountCents: 8500, appliesWhen: "self_employment", active: false });
    const s = suggest(P0(), facts({ filingStatus: "single", triggers: { self_employment: 1 } }));
    expect(s.lines).toEqual([]);
    await m("settings.pricing.savePackage", { code: "single", filingStatus: "single", name: "Single", description: "One filer · federal and California", unitAmountCents: 22500, active: true });
    await m("settings.pricing.saveAddon", { code: "side_work", name: "Side work or gig income", description: "Schedule C for 1099-NEC or app-based work", unitAmountCents: 8500, appliesWhen: "self_employment", active: true });
  });

  test("a return's facts come from its sources and the client's answers", () => {
    const e = w.get<{ id: string }>(
      "SELECT e.id FROM engagements e WHERE e.tax_year = 2025 AND e.kind = 'original' AND EXISTS (SELECT 1 FROM intake_responses r WHERE r.engagement_id = e.id) ORDER BY e.id LIMIT 1",
    ).id;
    const before = factsFor(w.db, e);
    const answers = JSON.parse(w.get<{ answers: string }>("SELECT answers FROM intake_responses WHERE engagement_id = ?", e).answers);
    w.db.run("UPDATE intake_responses SET answers = ? WHERE engagement_id = ?", [
      JSON.stringify({ ...answers, coverage_source: "covered_california", moved: true, moved_where: "into_ca", income_types: ["wages", "self_employment"] }),
      e,
    ]);
    const after = factsFor(w.db, e);
    expect(after.triggers).toMatchObject({ covered_california: 1, other_state: 1, self_employment: Math.max(1, before.triggers.self_employment ?? 0) });
    w.db.run("UPDATE intake_responses SET answers = ? WHERE engagement_id = ?", [JSON.stringify(answers), e]);
  });
});

describe("invoices carry what they were priced from", () => {
  test("a new invoice records each line's price and names what's included; the client sees it", async () => {
    const e = w.get<{ id: string }>(
      `SELECT e.id FROM engagements e WHERE e.tax_year = 2025 AND e.kind = 'original' AND e.filing_status IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.engagement_id = e.id)
         AND EXISTS (SELECT 1 FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = e.id AND s.kind = 'ihss_provider')
       ORDER BY e.id LIMIT 1`,
    ).id;
    const s = InvoiceSuggestion.parse((await w.call(P(), "invoice.suggest", { engagementId: e })).data);
    expect(s.included.map((x) => x.code)).toContain("ihss");
    const draft = InvoiceSummary.parse((await m("invoice.create", { engagementId: e })).data);
    expect(w.all<{ price_code: string | null }>("SELECT price_code FROM invoice_lines WHERE invoice_id = ? ORDER BY position", draft.id).map((r) => r.price_code)).toEqual(s.lines.map((l) => l.priceCode));
    expect(draft.included).toContain("IHSS home care income");
    await m("invoice.issue", { invoiceId: draft.id });
    const client = w.get<{ id: string }>("SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'", e).id;
    const seen = z.array(InvoiceSummary).parse((await w.call(client, "invoice.list", { engagementId: e }, "query", "portal")).data);
    expect(seen[0]!.included).toContain("IHSS home care income");
    expect(() => w.db.run("INSERT INTO invoice_included (invoice_id, price_code, name) VALUES (?, 'covered_ca', 'Covered California')", [draft.id])).toThrow(/frozen/);
  });

  test("an included code must be a current, unpriced add-on; a line's code must exist", async () => {
    const e = w.get<{ id: string }>("SELECT e.id FROM engagements e WHERE e.tax_year = 2025 AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.engagement_id = e.id) ORDER BY e.id DESC LIMIT 1").id;
    const line = { description: "Single", quantity: 1, unitAmountCents: 22500, priceCode: "single" };
    expect((await m("invoice.create", { engagementId: e, lines: [line], included: ["side_work"] })).status).toBe(400);
    expect((await m("invoice.create", { engagementId: e, lines: [{ ...line, priceCode: "nope" }] })).status).toBe(400);
    const ok = InvoiceSummary.parse((await m("invoice.create", { engagementId: e, lines: [line, { description: "Typed by hand", quantity: 1, unitAmountCents: 1000 }], included: ["ihss"] })).data);
    expect(ok.included).toEqual(["IHSS home care income"]);
  });
});

describe("usage and changes", () => {
  test('"This year" counts returns whose invoices used each price, straight from the invoices', async () => {
    const p = await pricing(2025);
    const expected = w.all<{ code: string; n: number }>(
      `SELECT code, COUNT(DISTINCT engagement_id) AS n FROM (
         SELECT l.price_code AS code, i.engagement_id FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id JOIN engagements e ON e.id = i.engagement_id
          WHERE l.price_code IS NOT NULL AND i.status <> 'void' AND e.tax_year = 2025
         UNION ALL SELECT x.price_code, i.engagement_id FROM invoice_included x JOIN invoices i ON i.id = x.invoice_id JOIN engagements e ON e.id = i.engagement_id
          WHERE i.status <> 'void' AND e.tax_year = 2025) GROUP BY code`,
    );
    expect(expected.length).toBeGreaterThan(1); // the seed priced its invoices this way
    for (const { code, n } of expected) {
      const item = [...p.packages, ...p.addons].find((x) => x.code === code)!;
      expect({ code, used: item.usedThisYear }).toEqual({ code, used: n });
    }
  });

  test("a price change moves new suggestions only; issued invoices keep what they charged; it's recorded", async () => {
    const issued = w.get<{ invoice_id: string; engagement_id: string; total_cents: number }>(
      "SELECT b.invoice_id, b.engagement_id, b.total_cents FROM invoice_balances b JOIN invoice_lines l ON l.invoice_id = b.invoice_id WHERE b.status = 'issued' AND l.price_code = 'mfj' LIMIT 1",
    );
    await m("settings.pricing.savePackage", { code: "mfj", filingStatus: "mfj", name: "Married filing jointly", description: "Two filers, one return · federal and California", unitAmountCents: 36000 });
    expect(JSON.parse(w.eventsOf("settings.price_updated", "mfj").at(-1)!.data)).toMatchObject({ kind: "package", from_cents: 34000, to_cents: 36000 });
    expect(suggest(loadPricing(w.db), facts({ filingStatus: "mfj" })).lines[0]!.unitAmountCents).toBe(36000);
    const after = z.array(InvoiceSummary).parse((await w.call(P(), "invoice.list", { engagementId: issued.engagement_id })).data);
    expect(after.find((i) => i.id === issued.invoice_id)!.totalCents).toBe(issued.total_cents);
    await m("settings.pricing.savePackage", { code: "mfj", filingStatus: "mfj", name: "Married filing jointly", description: "Two filers, one return · federal and California", unitAmountCents: 34000 });
  });

  test("add a package and an add-on; remove deletes what was never used and retires what was", async () => {
    const withNew = PricingView.parse((await m("settings.pricing.savePackage", { filingStatus: "single", name: "Single, simple", description: "W-2 only", unitAmountCents: 17500 })).data);
    expect(withNew.packages.at(-1)).toMatchObject({ code: "single_simple", unitAmountCents: 17500, usedThisYear: 0 });
    const withAddon = PricingView.parse((await m("settings.pricing.saveAddon", { name: "Prior-year notice", unitAmountCents: null })).data);
    expect(withAddon.addons.at(-1)).toMatchObject({ code: "prior_year_notice", unitAmountCents: null, appliesWhen: null });
    expect((await m("settings.pricing.remove", { code: "single_simple" })).data).toEqual({ outcome: "deleted" });
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM price_packages WHERE code = 'single_simple'").n).toBe(0);

    expect((await m("settings.pricing.remove", { code: "mfj" })).data).toEqual({ outcome: "retired" });
    expect((await pricing()).packages.some((x) => x.code === "mfj")).toBe(false);
    expect(suggest(loadPricing(w.db), facts({ filingStatus: "mfj" })).packageCode).toBeNull();
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM invoice_lines WHERE price_code = 'mfj'").n).toBeGreaterThan(0); // history intact
    expect((await m("settings.pricing.savePackage", { code: "mfj", filingStatus: "mfj", name: "x", unitAmountCents: 1 })).status).toBe(404);
    w.db.run("UPDATE price_packages SET retired_at = NULL, active = 1 WHERE code = 'mfj'"); // put it back for later tests
  });

  test("codes are one namespace, and prices must be positive", async () => {
    expect(() => w.db.run("INSERT INTO price_addons (code, name, unit_amount_cents, active, position, updated_at) VALUES ('mfj', 'x', 1, 1, 99, '2026-09-28T00:00:00.000Z')")).toThrow(/already a package/);
    expect((await m("settings.pricing.savePackage", { filingStatus: "single", name: "Free", unitAmountCents: 0 })).status).toBe(400);
  });
});

describe("the public price list", () => {
  test("active prices only, no usage, on the portal with no one signed in", async () => {
    const res = await w.call(null, "pricing.public", undefined, "query", "portal");
    expect(res.status).toBe(200);
    const p = PublicPricing.parse(res.data);
    expect(p.packages.map((x) => x.code)).toEqual(["single", "hoh", "mfj", "mfs"]);
    expect(p.addons.some((a) => a.code === "amended")).toBe(false); // inactive
    expect(JSON.stringify(res.data)).not.toContain("usedThisYear");
  });

  test("settings.pricing is the admin's: 404 on the portal, 403 for a client", async () => {
    expect((await w.call(P(), "settings.pricing.list", undefined, "query", "portal")).status).toBe(404);
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "settings.pricing.remove", { code: "single" }, "mutation")).status).toBe(403);
  });
});
