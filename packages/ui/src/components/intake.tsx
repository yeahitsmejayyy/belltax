import type { Question, Section } from "@app/schema";
import { Check, CheckCircle2, CircleAlert, CloudOff, FolderOpen, LoaderCircle, Lock } from "lucide-react";
import type * as React from "react";

import { formatCents, formatDate, formatDateTime } from "../format";
import { cn } from "../utils";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card } from "./card";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Progress } from "./progress";
import { RadioCard, RadioGroup } from "./radio-group";
import { Skeleton } from "./skeleton";
import { Textarea } from "./textarea";

// The client portal's questionnaire (portal 09-12), the pieces apps/portal renders and Storybook shows. The
// questionnaire comes in as data (`sections`, a Section[] from @app/schema; the portal passes INTAKE_V1), answers and
// errors come in as props, and every change goes out through a callback. Saving, checking and sending stay in the app.

export type Answers = Record<string, unknown>;
export type Drafts = Record<string, string>; // what's typed in text, money and date fields
export type SaveState = { status: "idle" | "saving" | "saved" | "error"; at?: Date };

// ── Rules the screens need ────────────────────────────────────────────────────────────────────────────

// Whether a question shows, given the answers so far: its parent shows and was answered the way it asks for.
// Looked up in the questionnaire passed in, so it works for any Section[] (the same rule as @app/schema's isVisible).
export function visibleIn(sections: readonly Section[]) {
  const byId = new Map(sections.flatMap((s) => s.questions).map((q) => [q.id, q]));
  const visible = (q: Question, answers: Answers): boolean => {
    if (!q.showIf) return true;
    const parent = byId.get(q.showIf.question);
    if (!parent || !visible(parent, answers)) return false;
    const v = answers[q.showIf.question];
    return "equals" in q.showIf ? v === q.showIf.equals : Array.isArray(v) && v.includes(q.showIf.includes);
  };
  return visible;
}

// Follow-ups nest under the question they depend on, when it's in the same section.
export const rootsOf = (s: Section) => s.questions.filter((q) => !q.showIf || !s.questions.some((p) => p.id === q.showIf!.question));
export const followUpsOf = (s: Section, id: string) => s.questions.filter((q) => q.showIf?.question === id);

// An answer in words, the way the review and the read-only view show it.
export function inWords(q: Question, v: unknown): string {
  switch (q.type) {
    case "yes_no":
      return v ? "Yes" : "No";
    case "choice":
      return q.options.find((o) => o.value === v)?.label ?? String(v);
    case "multi":
      return (v as string[]).map((x) => q.options.find((o) => o.value === x)?.label ?? x).join(", ");
    case "date":
      return formatDate(`${v}T12:00:00Z`, { month: "long", day: "numeric", year: "numeric" });
    case "money":
      return formatCents(Math.round((v as number) * 100));
    case "text":
      return String(v);
  }
}

// ── StepHeader ────────────────────────────────────────────────────────────────────────────────────────

// "Step 2 of 8" with the quiet save state beside it and the bar underneath (portal 09-12).
export function StepHeader({ step, total, title, save, onRetry }: { step: number; total: number; title: string; save: SaveState; onRetry: () => void }) {
  return (
    <div className="grid gap-3">
      <div className="flex min-h-6 items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          Step {step} of {total}
        </span>
        <span aria-live="polite" className="inline-flex items-center gap-1.5">
          {save.status === "saving" ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> Saving…
            </>
          ) : save.status === "saved" ? (
            <>
              <Check aria-hidden="true" className="size-4" /> Saved {save.at?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </>
          ) : save.status === "error" ? (
            <>
              <CloudOff aria-hidden="true" className="size-4" /> Not saved yet
              <Button variant="link" size="sm" className="h-auto px-1 py-0 max-md:min-h-11" onClick={onRetry}>
                Try again
              </Button>
            </>
          ) : null}
        </span>
      </div>
      <Progress value={Math.round((step / total) * 100)} aria-label={`Step ${step} of ${total}: ${title}`} />
    </div>
  );
}

// ── StepIntro ─────────────────────────────────────────────────────────────────────────────────────────

// The step's heading and its one-line intro. The heading takes focus when the step changes (`headingRef`).
export function StepIntro({ title, intro, headingRef }: { title: string; intro?: string | null; headingRef?: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="grid gap-2">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-balance outline-none md:text-3xl">
        {title}
      </h1>
      {intro ? <p className="text-pretty text-muted-foreground">{intro}</p> : null}
    </div>
  );
}

// ── QuestionField ─────────────────────────────────────────────────────────────────────────────────────

// One question, drawn by its type (portal 09-intake-intake-household): choices and yes/no as whole-row
// cards, several-of as checkbox rows, typed answers as fields. Label, help and the error sit together.
export type QuestionFieldProps = {
  q: Question;
  value: unknown;
  draft: string;
  error: string | null;
  onAnswer: (value: unknown) => void;
  onDraft: (raw: string) => void;
  onBlur: () => void;
};

export function QuestionField({ q, value, draft, error, onAnswer, onDraft, onBlur }: QuestionFieldProps) {
  const base = `q-${q.id}`;
  const describedBy = [q.help ? `${base}-help` : null, error ? `${base}-error` : null].filter(Boolean).join(" ") || undefined;
  const aria = { "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": q.required || undefined };
  const grouped = q.type === "yes_no" || q.type === "choice" || q.type === "multi";

  const label = (
    <>
      {q.label}
      {!q.required ? <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span> : null}
    </>
  );
  const after = (
    <>
      {q.help ? (
        <p id={`${base}-help`} className="text-sm text-pretty text-muted-foreground">
          {q.help}
        </p>
      ) : null}
      {error ? (
        <p id={`${base}-error`} className="flex items-start gap-1.5 text-sm text-danger-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </>
  );

  if (grouped) {
    return (
      <fieldset data-question={q.id} className="grid min-w-0 gap-3">
        <legend id={`${base}-label`} className="mb-3 text-base font-medium text-balance md:text-sm">
          {label}
        </legend>
        {q.type === "multi" ? (
          <div role="group" aria-labelledby={`${base}-label`} {...aria} className="grid gap-2">
            {q.options.map((o) => {
              const list = (value as string[] | undefined) ?? [];
              const checked = list.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent has-data-[state=checked]:border-primary has-data-[state=checked]:bg-brand-subtle max-md:text-base"
                >
                  <Checkbox
                    checked={checked}
                    onBlur={onBlur}
                    onCheckedChange={(c) => onAnswer(c ? [...list, o.value] : list.filter((x) => x !== o.value))}
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        ) : (
          <RadioGroup
            aria-labelledby={`${base}-label`}
            {...aria}
            value={q.type === "yes_no" ? (value === undefined ? "" : value ? "yes" : "no") : ((value as string | undefined) ?? "")}
            onValueChange={(v) => onAnswer(q.type === "yes_no" ? v === "yes" : v)}
            className={cn("gap-2", q.type === "yes_no" && "grid-cols-2")}
          >
            {(q.type === "yes_no" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : q.options).map((o) => (
              <RadioCard key={o.value} value={o.value}>
                {o.label}
              </RadioCard>
            ))}
          </RadioGroup>
        )}
        {after}
      </fieldset>
    );
  }

  const input = { id: base, value: draft, onBlur, ...aria, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onDraft(e.target.value) };
  return (
    <div data-question={q.id} className="grid min-w-0 gap-2">
      <label htmlFor={base} className="text-base font-medium text-balance md:text-sm">
        {label}
      </label>
      {q.type === "text" ? (
        <Textarea {...input} rows={3} maxLength={2000} className="min-h-24" />
      ) : q.type === "money" ? (
        <div className="relative max-w-xs">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            $
          </span>
          <Input {...input} inputMode="decimal" autoComplete="off" className="pl-7 tabular-nums max-md:h-11" placeholder="0.00" />
        </div>
      ) : (
        <Input {...input} type="date" className="max-w-xs max-md:h-11" />
      )}
      {after}
    </div>
  );
}

// ── SectionStep ───────────────────────────────────────────────────────────────────────────────────────

// One section of the questionnaire as a step (portal 09/10). A follow-up appears under the answer that
// asks for it, indented and eased in; an answer it hides is kept but no longer counts. `sections` is the whole
// questionnaire, so a follow-up whose question lives in another section still knows when to show.
export type SectionStepProps = {
  sections: readonly Section[];
  section: Section;
  answers: Answers;
  drafts: Drafts;
  errors: Record<string, string | null>;
  onAnswer: (q: Question, value: unknown) => void;
  onDraft: (q: Question, raw: string) => void;
  onBlur: (q: Question) => void;
};

export function SectionStep(props: SectionStepProps) {
  const { section, answers } = props;
  const isVisible = visibleIn(props.sections);
  const node = (q: Question, nested: boolean) => {
    if (!isVisible(q, answers)) return null;
    const follow = followUpsOf(section, q.id).filter((f) => isVisible(f, answers));
    return (
      <div
        key={q.id}
        className={cn(
          "grid gap-6",
          nested && "border-l-2 border-border pl-4 animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-enter motion-reduce:animate-none",
        )}
      >
        <QuestionField
          q={q}
          value={answers[q.id]}
          draft={props.drafts[q.id] ?? ""}
          error={props.errors[q.id] ?? null}
          onAnswer={(v) => props.onAnswer(q, v)}
          onDraft={(raw) => props.onDraft(q, raw)}
          onBlur={() => props.onBlur(q)}
        />
        {follow.map((f) => node(f, true))}
      </div>
    );
  };
  return <div className="grid gap-8">{rootsOf(section).map((q) => node(q, false))}</div>;
}

// ── MissingAnswers ────────────────────────────────────────────────────────────────────────────────────

// On the review step: what still stands in the way of sending, each one a button back to its question. Takes focus
// (`focusRef`) when Send is pressed too early. Renders nothing when the list is empty.
export function MissingAnswers({ questions, onPick, focusRef }: { questions: readonly Question[]; onPick: (q: Question) => void; focusRef?: React.Ref<HTMLDivElement> }) {
  if (!questions.length) return null;
  return (
    <div ref={focusRef} tabIndex={-1} className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <Banner tone="warning" title={questions.length === 1 ? "One question still needs an answer" : `${questions.length} questions still need an answer`}>
        <ul className="mt-1 grid gap-1">
          {questions.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className="inline-flex min-h-11 items-start gap-1.5 py-2 text-left underline underline-offset-4 md:min-h-0 md:py-0.5"
                onClick={() => onPick(q)}
              >
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {q.label}
              </button>
            </li>
          ))}
        </ul>
      </Banner>
    </div>
  );
}

// ── AnswerSummary ─────────────────────────────────────────────────────────────────────────────────────

// Every answer in words, grouped by section (portal 12-intake-intake-review). With onEdit each section
// links back to its step; without it this is the read-only copy shown once the return is past questions.
export function AnswerSummary({ sections, answers, onEdit }: { sections: readonly Section[]; answers: Answers; onEdit?: (sectionIndex: number) => void }) {
  const isVisible = visibleIn(sections);
  return (
    <Card className="gap-0 divide-y py-0">
      {sections.map((s, i) => (
        <section key={s.id} aria-labelledby={`review-${s.id}`} className="grid gap-4 px-4 py-5 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`review-${s.id}`} className="font-semibold text-balance">
              {s.title}
            </h2>
            {onEdit ? (
              <Button variant="ghost" className="-my-2 -mr-3 min-h-11 text-primary hover:text-primary" onClick={() => onEdit(i)}>
                Edit<span className="sr-only"> {s.title.toLowerCase()}</span>
              </Button>
            ) : null}
          </div>
          <dl className="grid gap-4">
            {s.questions
              .filter((q) => isVisible(q, answers))
              .map((q) => {
                const v = answers[q.id];
                const empty = v === undefined || (Array.isArray(v) && v.length === 0);
                return (
                  <div key={q.id} className="grid gap-1">
                    <dt className="text-sm text-pretty text-muted-foreground">{q.label}</dt>
                    <dd className="text-pretty break-words whitespace-pre-line">
                      {!empty ? (
                        inWords(q, v)
                      ) : q.required ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-danger-foreground">
                          <CircleAlert aria-hidden="true" className="size-4 shrink-0" /> Still to answer
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not answered</span>
                      )}
                    </dd>
                  </div>
                );
              })}
          </dl>
        </section>
      ))}
    </Card>
  );
}

// ── StepNav ───────────────────────────────────────────────────────────────────────────────────────────

// The buttons under every step: Back (from step 2), the main action (Continue, Save and review, Send to …), and
// Save and finish later.
export function StepNav({
  onBack,
  nextLabel,
  onNext,
  nextDisabled,
  onLater,
  laterLabel = "Save and finish later",
  backLabel = "Back",
}: {
  onBack?: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  onLater: () => void;
  laterLabel?: string;
  backLabel?: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex gap-3">
        {onBack ? (
          <Button variant="outline" className="h-11 px-6 text-base md:h-10 md:text-sm" onClick={onBack}>
            {backLabel}
          </Button>
        ) : null}
        <Button className="h-11 flex-1 text-base md:h-10 md:text-sm" disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
      <Button variant="ghost" className="h-11 text-base md:text-sm" onClick={onLater}>
        {laterLabel}
      </Button>
    </div>
  );
}

// ── IntakeLoading ─────────────────────────────────────────────────────────────────────────────────────

export function IntakeLoading() {
  return (
    <div aria-label="Loading" className="grid gap-6">
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

// ── IntakeSent ────────────────────────────────────────────────────────────────────────────────────────

// After the answers are sent, or once the return is past the questionnaire: what happens next. Sent answers aren't
// shown back (ticket 52, send-only portal): the preparer has them, and a stolen login can't read them. Only the
// preparer can reopen them. `renderDocumentsLink` draws the "Go to Documents" link (a router link in the app).
export type IntakeSentProps = {
  sections: readonly Section[];
  answers: Answers;
  submittedAt: string | null;
  preparer: string;
  replyTo?: string;
  renderDocumentsLink: (children: React.ReactNode) => React.ReactElement;
};

export function IntakeSent({ sections, answers, submittedAt, preparer, replyTo, renderDocumentsLink }: IntakeSentProps) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        {submittedAt ? (
          <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
            <CheckCircle2 aria-hidden="true" className="size-6" />
          </span>
        ) : null}
        <div className="grid gap-2">
          <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight text-balance outline-none">
            {submittedAt ? `Your answers are with ${preparer}` : "Your answers"}
          </h1>
          <p className="text-pretty text-muted-foreground">
            {submittedAt
              ? `Sent ${formatDateTime(submittedAt)}. Thank you, that's the biggest part done.`
              : "This return is past the questions stage, so the answers can't be changed here."}
          </p>
        </div>
      </div>

      {submittedAt ? (
        <section aria-labelledby="next" className="grid gap-3">
          <h2 id="next" className="font-semibold">
            What happens next
          </h2>
          <ol className="grid list-decimal gap-2 pl-5 text-pretty marker:text-muted-foreground">
            <li>{preparer} reads through your answers, usually within a few days.</li>
            <li>Anything we need from you shows up under Documents, with a note saying why.</li>
            <li>We'll message you if a question needs a closer look.</li>
          </ol>
          <Button asChild className="mt-2 w-full sm:w-auto max-md:h-11 max-md:text-base">
            {renderDocumentsLink(
              <>
                <FolderOpen aria-hidden="true" /> Go to Documents
              </>,
            )}
          </Button>
        </section>
      ) : null}

      <Banner tone="info" title="Need to change something?">
        {replyTo ? (
          <a className="font-medium underline underline-offset-4" href={`mailto:${replyTo}`}>
            Email {preparer}
          </a>
        ) : (
          `Tell ${preparer}`
        )}{" "}
        if something's wrong or missing. {preparer} can reopen your answers for you.
      </Banner>

      {submittedAt ? (
        <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          For your privacy, answers aren't shown here once they're sent. {preparer} has them.
        </p>
      ) : (
        <AnswerSummary sections={sections} answers={answers} />
      )}
    </div>
  );
}
