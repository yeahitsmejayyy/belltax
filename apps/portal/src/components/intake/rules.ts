import { INTAKE_V1, IntakeAnswersV1, isVisible, type Question } from "@app/schema";
import type { Answers, Drafts } from "@app/ui/components/intake";

// The questionnaire's rules on the client side: typed text becomes an answer only when the server
// would accept it, and every problem is a sentence saying what to do. The schema stays the judge.
// (What the screens need to draw, follow-ups and answers in words, lives with them in @app/ui/components/intake.)

export const isTyped = (q: Question) => q.type === "text" || q.type === "money" || q.type === "date";

type Check = { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } };
const shape = IntakeAnswersV1.shape as unknown as Record<string, Check>;

// Typed text → the value to save (undefined when blank) or why it can't be saved.
export function parseDraft(q: Question, raw: string): { value?: unknown; error?: string } {
  const s = raw.trim();
  if (!s) return {};
  let value: unknown = s;
  if (q.type === "text" && s.length > 2000) return { error: "Please keep this under 2,000 characters." };
  if (q.type === "money") {
    const n = Number(s.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) return { error: "Enter an amount in dollars, like 1,200." };
    if (n > 10_000_000) return { error: "That's more than this form takes. Tell us in the last step instead." };
    value = Math.round(n * 100) / 100;
  }
  const r = shape[q.id]!.safeParse(value);
  if (!r.success) return { error: q.type === "date" ? "Enter a full date." : (r.error?.issues[0]?.message ?? "Please check this answer.") };
  return { value };
}

export const draftFrom = (v: unknown) => (v === undefined ? "" : String(v));

const REQUIRED: Record<Question["type"], string> = {
  yes_no: "Choose yes or no.",
  choice: "Choose an answer.",
  multi: "Choose at least one.",
  text: "Please answer this question.",
  date: "Enter a date.",
  money: "Enter an amount.",
};

// The problem with one question as things stand, or null.
export function problemWith(q: Question, answers: Answers, drafts: Drafts): string | null {
  if (!isVisible(q, answers)) return null;
  if (isTyped(q)) {
    const { error } = parseDraft(q, drafts[q.id] ?? "");
    if (error) return error;
  }
  const v = answers[q.id];
  if (q.required && (v === undefined || (Array.isArray(v) && v.length === 0))) return REQUIRED[q.type];
  return null;
}

export const sectionOf = (id: string) => INTAKE_V1.findIndex((s) => s.questions.some((q) => q.id === id));
