import { formatDate } from "@app/ui/format";

import type { RouterOutputs } from "@/lib/trpc";

export type ClientInvoice = RouterOutputs["invoice"]["list"][number];
export type ClientPayment = ClientInvoice["payments"][number];

// How a payment arrived, in words. Stripe payments are cards until bank debits arrive (ticket 09).
export const METHOD: Record<"card" | "cash" | "check" | "zelle" | "other", string> = { card: "Card", cash: "Cash", check: "Check", zelle: "Zelle", other: "Other" };
export const paymentMethod = (p: Pick<ClientPayment, "provider" | "method">) => METHOD[p.provider === "stripe" ? "card" : (p.method ?? "other")];

/** "March 12, 2026 at 6:18 PM", in the viewer's time zone. */
export const longDateTime = (iso: string) =>
  `${formatDate(iso, { month: "long", day: "numeric", year: "numeric" })} at ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

/** A date-only value ("2026-04-15") as "April 15, 2026", never shifted a day by the time zone. */
export const longDay = (day: string) => formatDate(`${day}T12:00:00Z`, { month: "long", day: "numeric", year: "numeric" });

export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/** When a receipt's payment arrived: a card payment has a time; one recorded by hand only has its day. */
export const paidWhen = (p: { paidAt: string; processedBy: "stripe" | "preparer" }) => (p.processedBy === "stripe" ? longDateTime(p.paidAt) : longDay(p.paidAt.slice(0, 10)));
