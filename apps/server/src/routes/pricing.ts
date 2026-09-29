import { TRPCError } from "@trpc/server";
import type { Database } from "bun:sqlite";
import {
  AddonSaveInput, now, PackageSaveInput, PriceRemoveInput, PriceRemoveResult, PricingListInput, PricingView, PublicPricing,
  type AddonTrigger,
} from "@app/schema";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import type { SessionUser } from "../identity";
import { preparerProcedure, publicProcedure, router } from "../trpc";

// Settings → Services & pricing (admin 32-settings-settings-pricing): packages by filing status and add-ons on
// top, each with "This year" usage derived from invoices, never stored. Prices aren't personal data, so every
// change is recorded in full for the audit trail. `pricing.public` is what the marketing site shows.

type PackageRow = { code: string; filing_status: "single" | "mfj" | "mfs" | "hoh"; name: string; description: string; unit_amount_cents: number; active: number; updated_at: string };
type AddonRow = { code: string; name: string; description: string; unit_amount_cents: number | null; applies_when: AddonTrigger | null; active: number; updated_at: string };

// Returns in the tax year whose invoices (issued or draft, not void) charged or included the code.
function usage(db: Database, taxYear: number | null): Map<string, number> {
  if (taxYear === null) return new Map();
  const rows = db
    .query<{ code: string; n: number }, [number, number]>(
      `SELECT code, COUNT(DISTINCT engagement_id) AS n FROM (
         SELECT l.price_code AS code, i.engagement_id FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id JOIN engagements e ON e.id = i.engagement_id
          WHERE l.price_code IS NOT NULL AND i.status <> 'void' AND e.tax_year = ?
         UNION ALL
         SELECT x.price_code, i.engagement_id FROM invoice_included x JOIN invoices i ON i.id = x.invoice_id JOIN engagements e ON e.id = i.engagement_id
          WHERE i.status <> 'void' AND e.tax_year = ?)
       GROUP BY code`,
    )
    .all(taxYear, taxYear);
  return new Map(rows.map((r) => [r.code, r.n]));
}

const packages = (db: Database, where = "retired_at IS NULL") =>
  db.query<PackageRow, []>(`SELECT code, filing_status, name, description, unit_amount_cents, active, updated_at FROM price_packages WHERE ${where} ORDER BY position, code`).all();
const addons = (db: Database, where = "retired_at IS NULL") =>
  db.query<AddonRow, []>(`SELECT code, name, description, unit_amount_cents, applies_when, active, updated_at FROM price_addons WHERE ${where} ORDER BY position, code`).all();

export function pricingView(db: Database, taxYear?: number): PricingView {
  const year = taxYear ?? db.query<{ y: number | null }, []>("SELECT MAX(tax_year) AS y FROM engagements").get()!.y;
  const used = usage(db, year);
  return {
    taxYear: year,
    packages: packages(db).map((p) => ({
      code: p.code, filingStatus: p.filing_status, name: p.name, description: p.description, unitAmountCents: p.unit_amount_cents,
      active: p.active === 1, usedThisYear: used.get(p.code) ?? 0, updatedAt: p.updated_at,
    })),
    addons: addons(db).map((a) => ({
      code: a.code, name: a.name, description: a.description, unitAmountCents: a.unit_amount_cents, appliesWhen: a.applies_when,
      active: a.active === 1, usedThisYear: used.get(a.code) ?? 0, updatedAt: a.updated_at,
    })),
  };
}

// "Married filing jointly" → "married_filing_jointly", made unique across packages and add-ons.
function newCode(db: Database, name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "item";
  const taken = (c: string) => !!db.query("SELECT 1 FROM price_packages WHERE code = ?1 UNION ALL SELECT 1 FROM price_addons WHERE code = ?1").get(c);
  let code = base;
  for (let n = 2; taken(code); n++) code = `${base}_${n}`;
  return code;
}
const nextPosition = (db: Database, table: string) => (db.query<{ p: number | null }, []>(`SELECT MAX(position) AS p FROM ${table}`).get()!.p ?? 0) + 1;

const record = (db: Database, user: SessionUser, type: string, code: string, data: Record<string, string | number | boolean | null>) =>
  appendEvent(db, { actor: user, type, subjectType: "price", subjectId: code, data });

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "That package or add-on isn't in your pricing." });

export const settingsPricingRouter = router({
  list: preparerProcedure
    .input(PricingListInput)
    .output(PricingView)
    .query(({ input }) => pricingView(runtime().db, input?.taxYear)),

  savePackage: preparerProcedure
    .input(PackageSaveInput)
    .output(PricingView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const at = now();
      db.transaction(() => {
        if (!input.code) {
          const code = newCode(db, input.name);
          db.run(
            "INSERT INTO price_packages (code, filing_status, name, description, unit_amount_cents, active, position, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [code, input.filingStatus, input.name, input.description, input.unitAmountCents, input.active ? 1 : 0, nextPosition(db, "price_packages"), at],
          );
          record(db, ctx.user, "settings.price_created", code, { kind: "package", to_cents: input.unitAmountCents, active: input.active });
          return;
        }
        const before = db.query<PackageRow, [string]>("SELECT * FROM price_packages WHERE code = ? AND retired_at IS NULL").get(input.code);
        if (!before) throw notFound();
        db.run("UPDATE price_packages SET filing_status = ?, name = ?, description = ?, unit_amount_cents = ?, active = ?, updated_at = ? WHERE code = ?", [
          input.filingStatus, input.name, input.description, input.unitAmountCents, input.active ? 1 : 0, at, input.code,
        ]);
        record(db, ctx.user, "settings.price_updated", input.code, { kind: "package", from_cents: before.unit_amount_cents, to_cents: input.unitAmountCents, active: input.active });
      })();
      return pricingView(db);
    }),

  saveAddon: preparerProcedure
    .input(AddonSaveInput)
    .output(PricingView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const at = now();
      db.transaction(() => {
        if (!input.code) {
          const code = newCode(db, input.name);
          db.run(
            "INSERT INTO price_addons (code, name, description, unit_amount_cents, applies_when, active, position, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [code, input.name, input.description, input.unitAmountCents, input.appliesWhen, input.active ? 1 : 0, nextPosition(db, "price_addons"), at],
          );
          record(db, ctx.user, "settings.price_created", code, { kind: "addon", to_cents: input.unitAmountCents, active: input.active });
          return;
        }
        const before = db.query<AddonRow, [string]>("SELECT * FROM price_addons WHERE code = ? AND retired_at IS NULL").get(input.code);
        if (!before) throw notFound();
        db.run("UPDATE price_addons SET name = ?, description = ?, unit_amount_cents = ?, applies_when = ?, active = ?, updated_at = ? WHERE code = ?", [
          input.name, input.description, input.unitAmountCents, input.appliesWhen, input.active ? 1 : 0, at, input.code,
        ]);
        record(db, ctx.user, "settings.price_updated", input.code, { kind: "addon", from_cents: before.unit_amount_cents, to_cents: input.unitAmountCents, active: input.active });
      })();
      return pricingView(db);
    }),

  // Delete what was never used; retire what was, so old invoices still name it.
  remove: preparerProcedure
    .input(PriceRemoveInput)
    .output(PriceRemoveResult)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const table = db.query("SELECT 1 FROM price_packages WHERE code = ? AND retired_at IS NULL").get(input.code)
        ? "price_packages"
        : db.query("SELECT 1 FROM price_addons WHERE code = ? AND retired_at IS NULL").get(input.code)
          ? "price_addons"
          : null;
      if (!table) throw notFound();
      const used = !!db.query("SELECT 1 FROM invoice_lines WHERE price_code = ?1 UNION ALL SELECT 1 FROM invoice_included WHERE price_code = ?1 LIMIT 1").get(input.code);
      const outcome = used ? ("retired" as const) : ("deleted" as const);
      db.transaction(() => {
        if (used) db.run(`UPDATE ${table} SET active = 0, retired_at = ?, updated_at = ? WHERE code = ?`, [now(), now(), input.code]);
        else db.run(`DELETE FROM ${table} WHERE code = ?`, [input.code]);
        record(db, ctx.user, `settings.price_${outcome}`, input.code, { kind: table === "price_packages" ? "package" : "addon" });
      })();
      return { outcome };
    }),
});

// Public: the marketing site's price list (ticket 14). Works on the portal listener; no usage, nothing inactive.
export const publicPricingRouter = router({
  public: publicProcedure.output(PublicPricing).query(() => {
    const { db } = runtime();
    return {
      packages: packages(db, "retired_at IS NULL AND active = 1").map((p) => ({ code: p.code, filingStatus: p.filing_status, name: p.name, description: p.description, unitAmountCents: p.unit_amount_cents })),
      addons: addons(db, "retired_at IS NULL AND active = 1").map((a) => ({ code: a.code, name: a.name, description: a.description, unitAmountCents: a.unit_amount_cents })),
    };
  }),
});
