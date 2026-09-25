// One way to show money and time in all three apps. Money is stored in cents (R26); times are UTC ISO
// strings and shown in the viewer's own time zone.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** 277000 → "$2,770.00" */
export const formatCents = (cents: number) => usd.format(cents / 100);

/** "2026-09-23T17:00:00.000Z" → "Sep 23, 2026" */
export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("en-US", opts);

/** "2026-09-23T17:00:00.000Z" → "Sep 23, 2026, 10:00 AM" (local time) */
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Whole days between an ISO time and now: "days in stage". */
export const daysSince = (iso: string, now = new Date()) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));

/** "3 days ago", "yesterday", "today" */
export function relativeDays(iso: string, now = new Date()) {
  const d = daysSince(iso, now);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}
