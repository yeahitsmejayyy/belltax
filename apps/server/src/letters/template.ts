import type { Database } from "bun:sqlite";

// The engagement letter template lives in the database (letter_templates, migration 003), versioned:
// publishing adds a version and past versions are frozen, so every letter records exactly which
// wording it was rendered from. The shipped wording is version 1.
//
// Have the wording reviewed by a tax professional before it goes to a real client. Not legal advice.

export const CONSENT_TEXT = "I have read this engagement letter, I agree to its terms, and typing my name is my signature.";

// Every field a template may use, and the ones a letter can't do without.
export const MERGE_FIELDS = ["practice_name", "preparer_name", "household_name", "tax_year", "amended_note", "date", "returns", "filers"] as const;
export const REQUIRED_FIELDS = ["household_name", "tax_year", "filers"] as const;
const FIELD = /\{\{(\w+)\}\}/g;

export type LetterTemplate = { version: number; body: string };

export const currentTemplate = (db: Database): LetterTemplate =>
  db.query<LetterTemplate, []>("SELECT version, body FROM letter_templates ORDER BY version DESC LIMIT 1").get()!;

// Problems with a template, in plain words. Empty means it can be published.
export function templateProblems(body: string): string[] {
  const used = new Set([...body.matchAll(FIELD)].map((m) => m[1]!));
  const unknown = [...used].filter((f) => !(MERGE_FIELDS as readonly string[]).includes(f));
  const missing = REQUIRED_FIELDS.filter((f) => !used.has(f));
  const problems: string[] = [];
  if (unknown.length) problems.push(`Unknown merge field${unknown.length > 1 ? "s" : ""}: ${unknown.map((f) => `{{${f}}}`).join(", ")}.`);
  if (missing.length) problems.push(`A letter must include ${missing.map((f) => `{{${f}}}`).join(", ")}.`);
  if (/\{\{(?!\w+\}\})/.test(body)) problems.push("There's an unclosed {{ in the text.");
  return problems;
}

export type LetterFields = {
  practiceName: string; // from Settings → Practice (routes/practice.ts)
  preparerName: string;
  householdName: string;
  taxYear: number;
  amended: boolean;
  date: string; // YYYY-MM-DD
  returns: string[]; // e.g. "Married filing jointly — Dana Reyes & Alex Lin"
  filers: string[];
};

export function renderLetter(template: LetterTemplate, f: LetterFields): { body: string; templateVersion: number } {
  const values: Record<(typeof MERGE_FIELDS)[number], string> = {
    practice_name: f.practiceName,
    preparer_name: f.preparerName,
    household_name: f.householdName,
    tax_year: String(f.taxYear),
    amended_note: f.amended ? " (amended return)" : "",
    date: f.date,
    returns: f.returns.join("; "),
    filers: f.filers.join(", "),
  };
  const body = template.body.replace(FIELD, (_, key: string) => {
    const v = values[key as keyof typeof values];
    if (v === undefined) throw new Error(`engagement letter template v${template.version}: unknown merge field {{${key}}}`);
    return v;
  });
  return { body, templateVersion: template.version };
}

export const FILING_STATUS_LABEL: Record<string, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  mfs: "Married filing separately",
  hoh: "Head of household",
  qss: "Qualifying surviving spouse",
};

export const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
