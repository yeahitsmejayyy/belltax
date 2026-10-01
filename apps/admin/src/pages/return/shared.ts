import type { RouterOutputs } from "@/lib/trpc";

// What the return page's tabs share: the detail shape and a few small helpers.

export type Detail = RouterOutputs["engagement"]["detail"];
export type Person = Detail["people"][number];
export type Invoice = Detail["invoices"][number];
export type Doc = Detail["documents"][number];

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "That didn't go through. Try again.");

// "Dana & Sam Marigold" when the filers share a surname, "Dana Reyes & Sam Marigold" when not.
export function filersName(d: Detail) {
  const filers = d.people.filter((p) => p.role !== "dependent");
  if (!filers.length) return d.household.displayName;
  const last = filers[0]!.lastName;
  return filers.every((p) => p.lastName === last)
    ? `${filers.map((p) => p.firstName).join(" & ")} ${last}`
    : filers.map((p) => `${p.firstName} ${p.lastName}`).join(" & ");
}

// Who a request or document is for, in a word: a first name, or the household.
export const whoFor = (d: Detail, personId: string | null) => (personId ? (d.people.find((p) => p.personId === personId)?.firstName ?? "Household") : "Household");

export const ROLE_LABEL: Record<Person["role"], string> = { primary: "Primary", spouse: "Spouse", dependent: "Dependent" };

export function ageFrom(dob: string | null) {
  if (!dob) return null;
  const b = new Date(`${dob}T12:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

// Dates without a time ("2026-03-07") read in the viewer's zone without slipping a day.
export const dayIso = (d: string) => `${d}T12:00:00Z`;
export const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
