import type { Database } from "bun:sqlite";

// The fee schedule lives in the database (fee_schedule, migration 003), editable from the admin's
// settings. Invoices copy the amounts into their own lines, so a fee change never touches an
// issued invoice: it only changes what's suggested next.

export type Line = { description: string; quantity: number; unitAmountCents: number };
export type Fee = { code: string; description: string; unitAmountCents: number; active: boolean };
export type Fees = Record<string, Fee>;

export function loadFees(db: Database): Fees {
  const rows = db
    .query<{ code: string; description: string; unit_amount_cents: number; active: number }, []>(
      "SELECT code, description, unit_amount_cents, active FROM fee_schedule ORDER BY position",
    )
    .all();
  return Object.fromEntries(rows.map((r) => [r.code, { code: r.code, description: r.description, unitAmountCents: r.unit_amount_cents, active: r.active === 1 }]));
}

// What a return usually costs, from what's on it. Inactive fees are left out. The preparer edits before issuing.
export function suggestedLines(fees: Fees, c: { isAmended: boolean; businesses: number; rentals: number; investments: number }): Line[] {
  const line = (code: string, quantity = 1): Line[] => {
    const f = fees[code];
    return f && f.active && quantity > 0 ? [{ description: f.description, quantity, unitAmountCents: f.unitAmountCents }] : [];
  };
  if (c.isAmended) return line("amended");
  return [...line("federal"), ...line("state"), ...line("schedule_c", c.businesses), ...line("schedule_e", c.rentals), ...line("schedule_d", c.investments ? 1 : 0)];
}

export function suggestedLinesFor(db: Database, engagementId: string): Line[] {
  const c = db
    .query<{ is_amended: number; businesses: number; rentals: number; brokerages: number }, [string, string]>(
      `SELECT c.is_amended, c.businesses, c.rentals,
              (SELECT COUNT(*) FROM return_sources rs JOIN sources s ON s.id = rs.source_id
                WHERE rs.engagement_id = ? AND s.kind = 'brokerage') AS brokerages
         FROM return_complexity c WHERE c.engagement_id = ?`,
    )
    .get(engagementId, engagementId)!;
  return suggestedLines(loadFees(db), { isAmended: c.is_amended === 1, businesses: c.businesses, rentals: c.rentals, investments: c.brokerages });
}

// Invoice numbers run per filing year: 2026-0001, 2026-0002…
export function nextInvoiceNumber(db: Database, year: number): string {
  const max = db
    .query<{ n: number | null }, [string]>("SELECT MAX(CAST(substr(number, 6) AS INTEGER)) AS n FROM invoices WHERE number LIKE ?")
    .get(`${year}-%`)!.n;
  return `${year}-${String((max ?? 0) + 1).padStart(4, "0")}`;
}
