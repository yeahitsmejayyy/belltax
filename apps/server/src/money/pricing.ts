import type { Database } from "bun:sqlite";
import type { AddonTrigger, FilingStatus } from "@app/schema";

// Pricing is packages + add-ons (migration 006), edited in the admin's Settings → Services & pricing.
// A package is the base fee for one return, picked by filing status; add-ons are extra work on top, and one
// with no price is "Included": named on the invoice, never charged. Invoices copy the amounts into their own
// lines, so a price change only changes what's suggested next, never an issued invoice (R27).

export type Line = { description: string; quantity: number; unitAmountCents: number; priceCode: string | null };
export type Package = { code: string; filingStatus: Exclude<FilingStatus, "qss">; name: string; unitAmountCents: number; active: boolean };
export type Addon = { code: string; name: string; unitAmountCents: number | null; appliesWhen: AddonTrigger | null; active: boolean };
export type Pricing = { packages: Package[]; addons: Addon[] };

// Retired items are gone from pricing for good; inactive ones are kept but never suggested.
export function loadPricing(db: Database): Pricing {
  const packages = db
    .query<{ code: string; filing_status: Package["filingStatus"]; name: string; unit_amount_cents: number; active: number }, []>(
      "SELECT code, filing_status, name, unit_amount_cents, active FROM price_packages WHERE retired_at IS NULL ORDER BY position, code",
    )
    .all()
    .map((p) => ({ code: p.code, filingStatus: p.filing_status, name: p.name, unitAmountCents: p.unit_amount_cents, active: p.active === 1 }));
  const addons = db
    .query<{ code: string; name: string; unit_amount_cents: number | null; applies_when: AddonTrigger | null; active: number }, []>(
      "SELECT code, name, unit_amount_cents, applies_when, active FROM price_addons WHERE retired_at IS NULL ORDER BY position, code",
    )
    .all()
    .map((a) => ({ code: a.code, name: a.name, unitAmountCents: a.unit_amount_cents, appliesWhen: a.applies_when, active: a.active === 1 }));
  return { packages, addons };
}

// What a return has that pricing cares about: its filing status, whether it amends, and how many of each
// add-on's triggers it shows (from its sources, and from the client's intake answers).
export type ReturnFacts = { filingStatus: FilingStatus | null; isAmended: boolean; triggers: Partial<Record<AddonTrigger, number>> };

export type Suggestion = { packageCode: string | null; lines: Line[]; included: { code: string; name: string }[] };

// Qualifying surviving spouse is priced like married filing jointly (same return, same work).
const packageStatus = (s: FilingStatus | null) => (s === "qss" ? "mfj" : s);

// Some work is billed per item (each rental property); the rest once per return.
const PER_ITEM: ReadonlySet<AddonTrigger> = new Set(["rental"]);

export function suggest(pricing: Pricing, facts: ReturnFacts): Suggestion {
  const addons = pricing.addons.filter((a) => a.active);
  const lineFor = (a: Addon, quantity = 1): Line => ({ description: a.name, quantity, unitAmountCents: a.unitAmountCents!, priceCode: a.code });

  // An amendment is its own piece of work: the 1040-X, not the original return's package again.
  if (facts.isAmended) {
    const amended = addons.find((a) => a.appliesWhen === "amended");
    if (!amended) return { packageCode: null, lines: [], included: [] };
    return amended.unitAmountCents === null
      ? { packageCode: null, lines: [], included: [{ code: amended.code, name: amended.name }] }
      : { packageCode: null, lines: [lineFor(amended)], included: [] };
  }

  const status = packageStatus(facts.filingStatus);
  const pkg = status ? pricing.packages.find((p) => p.active && p.filingStatus === status) : undefined;
  const lines: Line[] = pkg ? [{ description: pkg.name, quantity: 1, unitAmountCents: pkg.unitAmountCents, priceCode: pkg.code }] : [];
  const included: Suggestion["included"] = [];
  for (const a of addons) {
    if (!a.appliesWhen || a.appliesWhen === "amended") continue;
    const n = facts.triggers[a.appliesWhen] ?? 0;
    if (n <= 0) continue;
    if (a.unitAmountCents === null) included.push({ code: a.code, name: a.name });
    else lines.push(lineFor(a, PER_ITEM.has(a.appliesWhen) ? n : 1));
  }
  return { packageCode: pkg?.code ?? null, lines, included };
}

export function factsFor(db: Database, engagementId: string): ReturnFacts {
  const e = db
    .query<{ filing_status: FilingStatus | null; kind: string }, [string]>("SELECT filing_status, kind FROM engagements WHERE id = ?")
    .get(engagementId)!;
  const kinds = db
    .query<{ kind: string; n: number }, [string]>(
      "SELECT s.kind, COUNT(*) AS n FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = ? GROUP BY s.kind",
    )
    .all(engagementId);
  const count = (k: string) => kinds.find((r) => r.kind === k)?.n ?? 0;
  const raw = db.query<{ answers: string }, [string]>("SELECT answers FROM intake_responses WHERE engagement_id = ?").get(engagementId)?.answers;
  const answers = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
  const income = Array.isArray(answers.income_types) ? (answers.income_types as string[]) : [];
  const said = (option: string) => (income.includes(option) ? 1 : 0);
  return {
    filingStatus: e.filing_status,
    isAmended: e.kind === "amended",
    triggers: {
      self_employment: Math.max(count("business"), said("self_employment")),
      rental: Math.max(count("rental_property"), said("rental")),
      investments: Math.max(count("brokerage"), said("investments")),
      ihss: Math.max(count("ihss_provider"), said("ihss")),
      covered_california: answers.coverage_source === "covered_california" ? 1 : 0,
      other_state: answers.moved_where === "into_ca" || answers.moved_where === "out_of_ca" ? 1 : 0,
    },
  };
}

export const suggestionFor = (db: Database, engagementId: string) => suggest(loadPricing(db), factsFor(db, engagementId));

// Invoice numbers run per filing year: 2026-0001, 2026-0002…
export function nextInvoiceNumber(db: Database, year: number): string {
  const max = db
    .query<{ n: number | null }, [string]>("SELECT MAX(CAST(substr(number, 6) AS INTEGER)) AS n FROM invoices WHERE number LIKE ?")
    .get(`${year}-%`)!.n;
  return `${year}-${String((max ?? 0) + 1).padStart(4, "0")}`;
}
