import type { DemoPreparer } from "../components/admin-auth-pages";
import type { PracticeDetails, PreparerSignInMethods } from "../components/admin-settings";
import type { LetterPreview, LetterTemplateVersion, LetterVersionSummary } from "../components/letter-template";
import type { PriceAddon, PricePackage } from "../components/pricing-settings";

// Invented data for the preparer's Settings and sign-in stories (ticket 58). Nothing here is real: the demo
// practice (Bell Tax, as the seed has it), .test emails, 555-01xx phones.

export const PRACTICE: PracticeDetails = {
  practiceName: "Bell Tax",
  preparerName: "Morgan Hale",
  preparerCredential: "CRTP",
  replyToEmail: "hello@belltax.example",
  phone: "(555) 010-0117",
  city: "Fresno",
  state: "CA",
  updatedAt: "2026-10-14T18:30:00.000Z",
};

export const PACKAGES: PricePackage[] = [
  { code: "pkg-single", filingStatus: "single", name: "Single", description: "One filer, W-2 and the usual forms.", unitAmountCents: 22500, active: true, usedThisYear: 14 },
  { code: "pkg-mfj", filingStatus: "mfj", name: "Married filing jointly", description: "Two filers on one return.", unitAmountCents: 32500, active: true, usedThisYear: 9 },
  { code: "pkg-hoh", filingStatus: "hoh", name: "Head of household", description: "", unitAmountCents: 27500, active: true, usedThisYear: 1 },
  { code: "pkg-mfs", filingStatus: "mfs", name: "Married filing separately", description: "Each spouse's own return.", unitAmountCents: 27500, active: false, usedThisYear: 0 },
];

export const ADDONS: PriceAddon[] = [
  { code: "add-sched-c", name: "Schedule C", description: "Self-employment income and expenses.", unitAmountCents: 15000, appliesWhen: "self_employment", active: true, usedThisYear: 6 },
  { code: "add-rental", name: "Rental property", description: "Per property.", unitAmountCents: 12500, appliesWhen: "rental", active: true, usedThisYear: 2 },
  { code: "add-ihss", name: "IHSS income", description: "", unitAmountCents: null, appliesWhen: "ihss", active: true, usedThisYear: 3 },
  { code: "add-rush", name: "Rush turnaround", description: "Filed within three days.", unitAmountCents: 7500, appliesWhen: null, active: false, usedThisYear: 0 },
];

export const MERGE_FIELDS = ["client_names", "tax_year", "practice_name", "preparer_name", "package_name", "fee"];
export const REQUIRED_FIELDS = ["client_names", "tax_year", "fee"];

export const LETTER_BODY = `Dear {{client_names}},

Thank you for choosing {{practice_name}} to prepare your {{tax_year}} income tax returns.

{{preparer_name}} will prepare your federal and state returns from the information you provide. Our fee for the {{package_name}} is {{fee}}.

Please read this letter and sign it in the portal.`;

export const LETTER_CURRENT: LetterTemplateVersion = { version: 3, body: LETTER_BODY, createdAt: "2026-10-09T17:05:00.000Z", createdBy: "Morgan Hale" };
export const LETTER_VERSIONS: LetterVersionSummary[] = [
  { version: 3, createdAt: "2026-10-09T17:05:00.000Z", letters: 4 },
  { version: 2, createdAt: "2026-09-21T16:40:00.000Z", letters: 11 },
  { version: 1, createdAt: "2026-08-30T15:00:00.000Z", letters: 1 },
];

/** Fills a draft with invented sample values, as the server's preview does, or says what's missing. */
export function samplePreview(draft: string): LetterPreview {
  const missing = REQUIRED_FIELDS.filter((f) => !draft.includes(`{{${f}}}`));
  if (missing.length) return { problems: missing.map((f) => `The letter must include {{${f}}}.`), rendered: null };
  const values: Record<string, string> = {
    client_names: "Avery and Sam Quillfeather",
    tax_year: "2026",
    practice_name: PRACTICE.practiceName,
    preparer_name: PRACTICE.preparerName,
    package_name: "Married filing jointly package",
    fee: "$325.00",
  };
  return { problems: [], rendered: draft.replace(/\{\{(\w+)\}\}/g, (_, f: string) => values[f] ?? `{{${f}}}`) };
}

export const SIGN_IN: PreparerSignInMethods = {
  passkeys: [
    { id: "k1", name: "MacBook Pro", createdAt: "2026-08-30T15:00:00.000Z", lastUsedAt: "2026-10-21T16:12:00.000Z", synced: true },
    { id: "k2", name: "iPhone", createdAt: "2026-09-02T18:20:00.000Z", lastUsedAt: "2026-10-19T02:40:00.000Z", synced: true },
  ],
  authenticatorApp: true,
  recoveryCodesLeft: 8,
};
export const SIGN_IN_LOW: PreparerSignInMethods = { passkeys: [SIGN_IN.passkeys[0]!], authenticatorApp: false, recoveryCodesLeft: 2 };

export const NEW_CODES = ["7KQ2-M9XD", "P4TW-3HVN", "C8RL-6ZJF", "W2NB-Q7YK", "H5GE-1MSP", "D9VA-4XCT", "R3UJ-8LBQ", "N6FY-2KWE", "T1ZH-5RGM", "B7XS-9DPA"];

export const DEMO_PREPARERS: DemoPreparer[] = [{ id: "u-morgan", label: "Morgan Hale (preparer)" }];
