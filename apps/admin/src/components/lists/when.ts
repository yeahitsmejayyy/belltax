import { daysSince, formatDate } from "@app/ui/format";

// Short times for lists (admin 10-inbox, 29-invoices): "2:14 PM" today, "Yesterday", then "Mar 7".
export function shortWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return formatDate(iso, d.getFullYear() === now.getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

// Day headings for the activity feed: "Today", "Yesterday", "Monday, Mar 3".
export function dayHeading(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (daysSince(iso, now) <= 1 && d.getDate() !== now.getDate()) return "Yesterday";
  return formatDate(iso, { weekday: "long", month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

// A plain calendar date ("2026-03-07") at noon UTC, so it never slips a day in any time zone.
export const dueDate = (day: string) => formatDate(`${day}T12:00:00Z`, { month: "short", day: "numeric" });
