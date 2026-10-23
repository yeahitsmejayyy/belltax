import type { DashboardSummary } from "@app/schema";

// Invented numbers for the admin dashboard stories: a season five weeks in, and the same practice before it opens.
// Nothing here is real.

export const SUMMARY: DashboardSummary = {
  taxYear: 2026,
  season: { phase: "regular", opensOn: "2027-01-26", deadline: "2027-04-15", daysToDeadline: 40, day: 39, length: 79 },
  returns: { total: 27, filed: 6, complete: 4, waitingOnAuthority: 2 },
  money: { billedCents: 549000, collectedCents: 277000, outstandingCents: 272000 },
  waitingOnYou: { total: 18, toPrepare: 7, inbox: 11 },
  daysInStage: { average: 4.4, over7: 6 },
  byStage: [
    { stage: "invited", count: 3, waiting: "client" },
    { stage: "intake", count: 4, waiting: "client" },
    { stage: "documents", count: 6, waiting: "client" },
    { stage: "ready", count: 4, waiting: "preparer" },
    { stage: "preparing", count: 3, waiting: "preparer" },
    { stage: "review", count: 1, waiting: "client" },
    { stage: "filed", count: 2, waiting: "authority" },
    { stage: "complete", count: 4, waiting: "done" },
  ],
  filingsPerWeek: {
    weeks: [
      { weekOf: "2027-02-02", thisYear: 0, lastYear: 1 },
      { weekOf: "2027-02-09", thisYear: 1, lastYear: 2 },
      { weekOf: "2027-02-16", thisYear: 2, lastYear: 3 },
      { weekOf: "2027-02-23", thisYear: 1, lastYear: 2 },
      { weekOf: "2027-03-02", thisYear: 2, lastYear: 2 },
    ],
    filedSoFar: 6,
    lastYearBySameDay: 10,
  },
  billingByPackage: [
    { code: "single", name: "Single", returns: 9, billedCents: 202500 },
    { code: "mfj", name: "Married filing jointly", returns: 7, billedCents: 276500 },
    { code: "hoh", name: "Head of household", returns: 1, billedCents: 70000 },
  ],
  health: [
    { key: "failed_payments", tone: "danger", count: 2, title: "2 failed payments · $565.00", detail: "Dana & Sam Marigold, Remy Dovetail", names: ["Dana & Sam Marigold", "Remy Dovetail"], link: "/invoices?settlement=failed_last_attempt", tracked: true },
    { key: "stale_returns", tone: "warning", count: 6, title: "6 returns stuck over 7 days", detail: "Longest: Toni Wren · 12 days in Documents", names: ["Toni Wren"], link: "/pipeline?staleDays=7", tracked: true },
    { key: "inbox", tone: "info", count: 11, title: "11 items waiting in Inbox", detail: "Uploads, replies and payment updates to review.", names: [], link: "/inbox", tracked: true },
    { key: "efile_rejections", tone: "ok", count: 0, title: "No e-file rejections", detail: "All 6 filed returns were accepted or are pending.", names: [], link: "/pipeline?stage=filed", tracked: true },
  ],
  needAttention: 2,
};

// The same practice the week before the season opens: nothing filed or billed yet.
export const BEFORE_SEASON: DashboardSummary = {
  ...SUMMARY,
  season: { phase: "before", opensOn: "2027-01-26", deadline: "2027-04-15", daysToDeadline: 87, day: 0, length: 79 },
  returns: { total: 12, filed: 0, complete: 0, waitingOnAuthority: 0 },
  money: { billedCents: 0, collectedCents: 0, outstandingCents: 0 },
  waitingOnYou: { total: 0, toPrepare: 0, inbox: 0 },
  daysInStage: { average: 2.1, over7: 0 },
  byStage: SUMMARY.byStage.map((b) => ({ ...b, count: b.stage === "invited" ? 8 : b.stage === "intake" ? 4 : 0 })),
  filingsPerWeek: { weeks: [], filedSoFar: 0, lastYearBySameDay: 0 },
  billingByPackage: [],
  health: [{ key: "efile_rejections", tone: "ok", count: 0, title: "No e-file rejections", detail: "Nothing filed yet.", names: [], link: "/pipeline?stage=filed", tracked: true }],
  needAttention: 0,
};
