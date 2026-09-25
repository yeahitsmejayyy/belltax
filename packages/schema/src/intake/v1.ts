import { z } from "zod";

// Intake questionnaire, version 1. DRAFT: to be checked against what ProSeries asks (docs/intake-v1.md,
// generated from this file). Defined as data so the portal renders it and the server validates it
// from one source.
//
// By design it never asks for a full SSN, an IP PIN or bank account numbers (WISP §V.1): those stay in
// ProSeries and on the documents. Text answers are refused if they look like one.

export const INTAKE_VERSION = 1;

type Base = { id: string; label: string; help?: string; required: boolean; showIf?: ShowIf };
export type ShowIf = { question: string; equals: string | boolean } | { question: string; includes: string };
export type Question =
  | (Base & { type: "yes_no" })
  | (Base & { type: "choice"; options: readonly { value: string; label: string }[] })
  | (Base & { type: "multi"; options: readonly { value: string; label: string }[] })
  | (Base & { type: "date" })
  | (Base & { type: "money" })
  | (Base & { type: "text" });
export type Section = { id: string; title: string; intro?: string; questions: readonly Question[] };

const opts = (...pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
const NO_NUMBERS = "Please don't include Social Security, IP PIN or account numbers here.";

export const INTAKE_V1: readonly Section[] = [
  {
    id: "household",
    title: "Your household this year",
    questions: [
      { id: "marital_changed", type: "yes_no", required: true, label: "Did your marital status change during the year?" },
      {
        id: "marital_change",
        type: "choice",
        required: true,
        label: "What changed?",
        options: opts(["married", "I got married"], ["divorced", "I got divorced"], ["separated", "We separated"], ["widowed", "My spouse passed away"]),
        showIf: { question: "marital_changed", equals: true },
      },
      { id: "marital_change_date", type: "date", required: false, label: "When?", showIf: { question: "marital_changed", equals: true } },
      { id: "moved", type: "yes_no", required: true, label: "Did you move during the year?" },
      {
        id: "moved_where",
        type: "choice",
        required: true,
        label: "Where did you move?",
        options: opts(["within_ca", "Somewhere else in California"], ["into_ca", "Into California from another state"], ["out_of_ca", "Out of California"]),
        showIf: { question: "moved", equals: true },
      },
      { id: "moved_date", type: "date", required: false, label: "When did you move?", showIf: { question: "moved", equals: true } },
    ],
  },
  {
    id: "dependents",
    title: "People you support",
    questions: [
      { id: "has_dependents", type: "yes_no", required: true, label: "Does anyone depend on you for support, like children, a parent or another relative?" },
      {
        id: "dependents_changed",
        type: "yes_no",
        required: true,
        label: "Has that changed since last year? For example a birth, an adoption, or someone moving in or out.",
        showIf: { question: "has_dependents", equals: true },
      },
      {
        id: "dependents_note",
        type: "text",
        required: true,
        label: "Tell us who, and what changed.",
        help: `${NO_NUMBERS} We'll ask for Social Security cards separately.`,
        showIf: { question: "dependents_changed", equals: true },
      },
      { id: "childcare", type: "yes_no", required: true, label: "Did you pay for childcare or dependent care so you could work?", showIf: { question: "has_dependents", equals: true } },
      { id: "dependent_student", type: "yes_no", required: false, label: "Is anyone you support a full-time student aged 19 to 23?", showIf: { question: "has_dependents", equals: true } },
    ],
  },
  {
    id: "income",
    title: "Your income",
    intro: "Tick everything that applies to you or your spouse this year.",
    questions: [
      {
        id: "income_types",
        type: "multi",
        required: true,
        label: "Where did your income come from?",
        options: opts(
          ["wages", "A job (Form W-2)"],
          ["ihss", "IHSS caregiving"],
          ["self_employment", "Self-employment, freelancing or gig apps (1099-NEC or 1099-K)"],
          ["investments", "Interest, dividends or selling investments (1099-INT, -DIV, -B)"],
          ["retirement", "A pension or retirement account (1099-R)"],
          ["social_security", "Social Security (SSA-1099)"],
          ["unemployment", "Unemployment (1099-G)"],
          ["rental", "Rental property"],
          ["other", "Something else"],
        ),
      },
      { id: "job_changed", type: "yes_no", required: true, label: "Did you start or leave a job this year?" },
      {
        id: "business_expenses",
        type: "yes_no",
        required: true,
        label: "Do you have a summary of your business expenses (mileage, supplies, phone, home office)?",
        showIf: { question: "income_types", includes: "self_employment" },
      },
      { id: "other_income", type: "text", required: true, label: "What was the other income?", help: NO_NUMBERS, showIf: { question: "income_types", includes: "other" } },
      { id: "sold_home", type: "yes_no", required: true, label: "Did you sell a home or other property?" },
      // Every Form 1040 asks this question.
      { id: "digital_assets", type: "yes_no", required: true, label: "Did you receive, sell, swap or trade cryptocurrency or other digital assets?" },
    ],
  },
  {
    id: "life_events",
    title: "Things that might lower your tax",
    questions: [
      { id: "tuition", type: "yes_no", required: true, label: "Did you or someone you support pay college tuition (Form 1098-T)?" },
      { id: "student_loan_interest", type: "yes_no", required: true, label: "Did you pay interest on a student loan (Form 1098-E)?" },
      { id: "bought_home", type: "yes_no", required: true, label: "Did you buy a home?" },
      { id: "mortgage_interest", type: "yes_no", required: true, label: "Do you pay mortgage interest (Form 1098)?" },
      { id: "energy_upgrades", type: "yes_no", required: false, label: "Did you add solar panels, a heat pump or other energy upgrades to your home?" },
      { id: "electric_vehicle", type: "yes_no", required: false, label: "Did you buy an electric vehicle?" },
      { id: "charitable_giving", type: "yes_no", required: false, label: "Did you give to charity?" },
    ],
  },
  {
    id: "health",
    title: "Health coverage",
    questions: [
      {
        id: "coverage_source",
        type: "choice",
        required: true,
        label: "Where did your health coverage come from?",
        options: opts(
          ["employer", "An employer"],
          ["covered_california", "Covered California (you'll get Form 1095-A)"],
          ["medi_cal", "Medi-Cal"],
          ["medicare", "Medicare"],
          ["none", "I didn't have coverage"],
          ["other", "Somewhere else"],
        ),
      },
      { id: "covered_all_year", type: "yes_no", required: true, label: "Was everyone in your household covered for the whole year?" },
    ],
  },
  {
    id: "prior_year",
    title: "Last year and letters",
    questions: [
      {
        id: "prior_preparer",
        type: "choice",
        required: true,
        label: "Who prepared last year's return?",
        options: opts(["bell_tax_prep", "Bell Tax Prep"], ["someone_else", "Another preparer"], ["self", "I did it myself"], ["did_not_file", "I didn't file"]),
      },
      { id: "tax_letters", type: "yes_no", required: true, label: "Did you get any letters from the IRS or the California Franchise Tax Board this year?" },
      { id: "estimated_payments", type: "yes_no", required: true, label: "Did you make estimated tax payments for the year?" },
      { id: "estimated_payments_total", type: "money", required: false, label: "About how much, in total?", showIf: { question: "estimated_payments", equals: true } },
      {
        id: "has_ip_pin",
        type: "yes_no",
        required: true,
        label: "Did the IRS send you an Identity Protection PIN (IP PIN)?",
        help: "Bring the letter to your appointment. Don't type the PIN here.",
      },
    ],
  },
  {
    id: "wrap_up",
    title: "Last few things",
    questions: [
      {
        id: "refund_preference",
        type: "choice",
        required: true,
        label: "If you get a refund, how would you like it?",
        help: "We collect bank details securely when you sign your return, never in this portal.",
        options: opts(["direct_deposit", "Direct deposit"], ["check", "A paper check"], ["apply_next_year", "Apply it to next year's taxes"]),
      },
      { id: "questions_for_preparer", type: "text", required: false, label: "Anything else we should know, or questions for us?", help: NO_NUMBERS },
    ],
  },
];

export const QUESTIONS: readonly Question[] = INTAKE_V1.flatMap((s) => s.questions);
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

// Shaped like an SSN (with or without dashes) or a bank/card account number.
const LOOKS_SENSITIVE = /\b\d{3}-?\d{2}-?\d{4}\b|\b\d{8,17}\b/;

function valueSchema(q: Question): z.ZodType {
  switch (q.type) {
    case "yes_no":
      return z.boolean();
    case "choice":
      return z.enum(q.options.map((o) => o.value) as [string, ...string[]]);
    case "multi":
      return z
        .array(z.enum(q.options.map((o) => o.value) as [string, ...string[]]))
        .min(1)
        .refine((a) => new Set(a).size === a.length, "Each choice once.");
    case "date":
      return z.iso.date();
    case "money":
      return z.number().min(0).max(10_000_000);
    case "text":
      return z.string().trim().min(1).max(2000).refine((s) => !LOOKS_SENSITIVE.test(s), NO_NUMBERS);
  }
}

// Answers so far: every key must be a v1 question, every value the right shape. Partial is fine.
export const IntakeAnswersV1 = z.object(Object.fromEntries(QUESTIONS.map((q) => [q.id, valueSchema(q).optional()]))).strict();
export type IntakeAnswersV1 = Record<string, unknown>; // built from the question list, so its keys are dynamic

export function isVisible(q: Question, answers: IntakeAnswersV1): boolean {
  if (!q.showIf) return true;
  const parent = byId.get(q.showIf.question);
  if (!parent || !isVisible(parent, answers)) return false;
  const v = answers[q.showIf.question];
  return "equals" in q.showIf ? v === q.showIf.equals : Array.isArray(v) && v.includes(q.showIf.includes);
}

// Required questions the client can see and hasn't answered. Empty means it can be submitted.
export function missingRequired(answers: IntakeAnswersV1): Question[] {
  return QUESTIONS.filter((q) => q.required && isVisible(q, answers) && answers[q.id] === undefined);
}
