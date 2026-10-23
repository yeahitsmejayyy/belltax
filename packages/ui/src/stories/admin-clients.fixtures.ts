import type { ClientRow } from "../components/admin-clients";
import type { ExportResult } from "../components/export-household-dialog";
import type { HouseholdDetailData } from "../components/household-detail";
import type { RolloverReport, SeasonPreview } from "../components/new-season";

// Invented data for the admin Clients, Household and New season stories (ticket 58). Nothing here is real: invented
// names, .test emails, SSN last four starting with 9.

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const CLIENTS: ClientRow[] = [
  { id: "hh-marigold", displayName: "Marigold household", archivedAt: null, members: 3, logins: 2, latestTaxYear: 2026, lastActivityAt: daysAgo(1) },
  { id: "hh-kestrel", displayName: "Kestrel household", archivedAt: null, members: 2, logins: 1, latestTaxYear: 2026, lastActivityAt: daysAgo(4) },
  { id: "hh-wren", displayName: "Wren household", archivedAt: null, members: 1, logins: 0, latestTaxYear: 2025, lastActivityAt: "2026-03-14T18:00:00.000Z" },
  { id: "hh-ostrander", displayName: "Ostrander household", archivedAt: null, members: 4, logins: 0, latestTaxYear: null, lastActivityAt: null },
  { id: "hh-lindqvist", displayName: "Lindqvist household", archivedAt: "2026-05-02T16:00:00.000Z", members: 2, logins: 1, latestTaxYear: 2024, lastActivityAt: "2025-04-10T17:00:00.000Z" },
];

export const HOUSEHOLD: HouseholdDetailData = {
  id: "hh-marigold",
  displayName: "Marigold household",
  archivedAt: null,
  members: [
    {
      personId: "p-dana",
      firstName: "Dana",
      middleName: "R.",
      lastName: "Marigold",
      suffix: null,
      dateOfBirth: "1986-04-12",
      ssnLast4: "9012",
      email: "dana@marigold.test",
      phone: "(555) 010-2231",
      login: { userId: "u-dana", email: "dana@marigold.test", activated: true },
    },
    {
      personId: "p-sam",
      firstName: "Sam",
      middleName: null,
      lastName: "Marigold",
      suffix: "Jr.",
      dateOfBirth: "1984-11-30",
      ssnLast4: "9345",
      email: "sam@marigold.test",
      phone: null,
      login: { userId: "u-sam", email: "sam@marigold.test", activated: false },
    },
    { personId: "p-ivy", firstName: "Ivy", middleName: null, lastName: "Marigold", suffix: null, dateOfBirth: "2016-08-03", ssnLast4: null, email: null, phone: null, login: null },
  ],
  returns: [
    { engagementId: "e-marigold-2026", taxYear: 2026, kind: "original", stage: "preparing", filingLabel: "MFJ", filers: ["Dana", "Sam"] },
    { engagementId: "e-marigold-2025a", taxYear: 2025, kind: "amended", stage: "filed", filingLabel: "MFJ", filers: ["Dana", "Sam"] },
    { engagementId: "e-marigold-2025", taxYear: 2025, kind: "original", stage: "complete", filingLabel: "MFJ", filers: ["Dana", "Sam"] },
  ],
  access: [
    { grantId: "g-dana", email: "dana@marigold.test", name: "Dana Marigold", grantedAt: "2025-01-18T17:00:00.000Z", revokedAt: null },
    { grantId: "g-sam", email: "sam@marigold.test", name: null, grantedAt: "2026-01-09T17:00:00.000Z", revokedAt: null },
    { grantId: "g-old", email: "old-address@marigold.test", name: null, grantedAt: "2025-01-18T17:00:00.000Z", revokedAt: "2026-01-09T17:00:00.000Z" },
  ],
};

export const NEW_HOUSEHOLD: HouseholdDetailData = {
  id: "hh-ostrander",
  displayName: "Ostrander household",
  archivedAt: null,
  members: [{ personId: "p-rue", firstName: "Rue", middleName: null, lastName: "Ostrander", suffix: null, dateOfBirth: null, ssnLast4: null, email: null, phone: null, login: null }],
  returns: [],
  access: [],
};

export const ARCHIVED_HOUSEHOLD: HouseholdDetailData = { ...HOUSEHOLD, id: "hh-lindqvist", displayName: "Lindqvist household", archivedAt: "2026-05-02T16:00:00.000Z" };

export const EXPORT_RESULT: ExportResult = { path: "/Users/example/BellTax Exports/marigold-household-2026-10-22.btpx", documents: 14, bytes: 3_421_772, encrypted: true };

export const PREVIEW: SeasonPreview = {
  fromYear: 2026,
  toYear: 2027,
  items: [
    { householdId: "hh-marigold", householdName: "Marigold household", fromEngagementId: "e-marigold-2026", filers: ["Dana", "Sam"], action: "create", reason: null, people: 3, dependentsLeft: [], sourcesToCarry: 4 },
    { householdId: "hh-kestrel", householdName: "Kestrel household", fromEngagementId: "e-kestrel-2026", filers: ["Sidney"], action: "create", reason: null, people: 1, dependentsLeft: ["Jules (aged out)"], sourcesToCarry: 2 },
    { householdId: "hh-wren", householdName: "Wren household", fromEngagementId: "e-wren-2026", filers: [], action: "skip", reason: "Already has a TY 2027 return", people: 1, dependentsLeft: [], sourcesToCarry: 0 },
  ],
};

export const EMPTY_PREVIEW: SeasonPreview = { fromYear: 2023, toYear: 2024, items: [] };

export const REPORT: RolloverReport = {
  toYear: 2027,
  created: [
    { engagementId: "e-marigold-2027", householdName: "Marigold household", people: 3, sourcesCarried: 4, requestsCreated: 6, dependentsLeft: [] },
    { engagementId: "e-kestrel-2027", householdName: "Kestrel household", people: 1, sourcesCarried: 2, requestsCreated: 3, dependentsLeft: ["Jules"] },
  ],
  skipped: [{ fromEngagementId: "e-wren-2026", householdName: "Wren household", reason: "Already has a TY 2027 return" }],
  failed: [{ fromEngagementId: "e-ostrander-2026", householdName: "Ostrander household", error: "Its primary filer has no date of birth." }],
};
