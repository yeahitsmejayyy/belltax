import { PRACTICE_NAME } from "@app/schema";

// The engagement letter template. Bump LETTER_TEMPLATE_VERSION whenever the wording changes: every
// letter records the version it was rendered from, and a sent letter's text never changes afterward.
//
// This is a working draft for the demo and the build. Have the final wording reviewed by a tax
// professional before it goes to a real client. Not legal advice.

export const LETTER_TEMPLATE_VERSION = 1;

export const CONSENT_TEXT = "I have read this engagement letter, I agree to its terms, and typing my name is my signature.";

const TEMPLATE = `Engagement letter — tax year {{tax_year}}{{amended_note}}

Prepared {{date}} for the {{household_name}} household
Filing: {{returns}}

1. What we'll do
{{practice_name}} will prepare the federal and California individual income tax returns listed above for tax year {{tax_year}}, using the documents and answers you provide through the client portal. We don't audit or verify the information you give us, though we may ask questions when something looks incomplete.

2. What you'll do
You're responsible for giving us complete and accurate information, keeping the records that support your return, and reviewing the finished return before it's filed. The tax return is yours: you're responsible for what it says, even though we prepare it.

3. Filing
We'll file electronically once you've reviewed the return and signed the separate IRS and California e-file authorizations. Those are signed through our tax software, not this portal.

4. Fees
Our fees for this work are shown on your invoice in the portal. Fees are due before the return is filed unless we agree otherwise in writing.

5. Your information
We keep your information confidential and protect it under our written information security plan. We only share it with taxing authorities as needed to file your return, or as the law requires.

6. Ending this engagement
Either of us can end this engagement in writing at any time. You'll pay for work completed up to that point.

Signed by each person filing: {{filers}}`;

export type LetterFields = {
  practiceName?: string;
  householdName: string;
  taxYear: number;
  amended: boolean;
  date: string; // YYYY-MM-DD
  returns: string[]; // e.g. "Married filing jointly — Dana Reyes & Alex Lin"
  filers: string[];
};

export function renderLetter(f: LetterFields): { body: string; templateVersion: number } {
  const values: Record<string, string> = {
    practice_name: f.practiceName ?? PRACTICE_NAME,
    household_name: f.householdName,
    tax_year: String(f.taxYear),
    amended_note: f.amended ? " (amended return)" : "",
    date: f.date,
    returns: f.returns.join("; "),
    filers: f.filers.join(", "),
  };
  const body = TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = values[key];
    if (v === undefined) throw new Error(`engagement letter template: unknown merge field {{${key}}}`);
    return v;
  });
  return { body, templateVersion: LETTER_TEMPLATE_VERSION };
}

export const FILING_STATUS_LABEL: Record<string, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  mfs: "Married filing separately",
  hoh: "Head of household",
  qss: "Qualifying surviving spouse",
};

export const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
