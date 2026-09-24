import type { Database } from "bun:sqlite";

// The fee schedule, in cents. One place for the seed and for invoice suggestions.
// A settings screen can own this later; until then it's code, reviewed like code.
export const PRICES = {
  federal: 25000, // Form 1040
  state: 10000, // California Form 540
  scheduleC: 15000, // per business
  scheduleE: 12500, // per rental property
  scheduleD: 7500, // investments
  amended: 20000, // Form 1040-X
} as const;

export type Line = { description: string; quantity: number; unitAmountCents: number };

// What a return usually costs, from what's on it. The preparer edits before issuing.
export function suggestedLines(c: { isAmended: boolean; businesses: number; rentals: number; investments: number }): Line[] {
  if (c.isAmended) return [{ description: "Amended return (Form 1040-X)", quantity: 1, unitAmountCents: PRICES.amended }];
  return [
    { description: "Federal return (Form 1040)", quantity: 1, unitAmountCents: PRICES.federal },
    { description: "California return (Form 540)", quantity: 1, unitAmountCents: PRICES.state },
    ...(c.businesses ? [{ description: "Schedule C · self-employment", quantity: c.businesses, unitAmountCents: PRICES.scheduleC }] : []),
    ...(c.rentals ? [{ description: "Schedule E · rental property", quantity: c.rentals, unitAmountCents: PRICES.scheduleE }] : []),
    ...(c.investments ? [{ description: "Schedule D · investments", quantity: 1, unitAmountCents: PRICES.scheduleD }] : []),
  ];
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
  return suggestedLines({ isAmended: c.is_amended === 1, businesses: c.businesses, rentals: c.rentals, investments: c.brokerages });
}

// Invoice numbers run per filing year: 2026-0001, 2026-0002…
export function nextInvoiceNumber(db: Database, year: number): string {
  const max = db
    .query<{ n: number | null }, [string]>("SELECT MAX(CAST(substr(number, 6) AS INTEGER)) AS n FROM invoices WHERE number LIKE ?")
    .get(`${year}-%`)!.n;
  return `${year}-${String((max ?? 0) + 1).padStart(4, "0")}`;
}
