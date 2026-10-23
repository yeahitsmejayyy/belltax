import { INTAKE_V1, QUESTIONS, missingRequired, type Question } from "@app/schema";
import { FileText } from "lucide-react";
import { parseAsBoolean, parseAsInteger, useQueryState } from "nuqs";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { EmptyState } from "@app/ui/components/empty-state";
import {
  AnswerSummary,
  IntakeLoading,
  IntakeSent,
  MissingAnswers,
  SectionStep,
  StepHeader,
  StepIntro,
  StepNav,
  type Answers,
  type Drafts,
} from "@app/ui/components/intake";

import { draftFrom, isTyped, parseDraft, problemWith, sectionOf } from "@/components/intake/rules";
import { useAutosave } from "@/components/intake/use-autosave";
import { useReturn, usePageTitle, type MyReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The questionnaire (portal 09-12): one step per section of intake v1, saved as a draft while you go,
// then a review that sends it to the preparer. Once sent it's read-only (the server locks it).

const OPEN_STAGES = ["invited", "intake", "documents"];
const TOTAL = INTAKE_V1.length + 1; // the sections, then the review

export default function Questions() {
  usePageTitle("Questions");
  const { current, loading } = useReturn();
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-1">
      {loading ? (
        <IntakeLoading />
      ) : current ? (
        <Intake key={current.engagementId} ret={current} />
      ) : (
        <EmptyState icon={FileText} title="No questions yet" description="Your questions appear here once your preparer opens your return." />
      )}
    </div>
  );
}

function Intake({ ret }: { ret: MyReturn }) {
  const intake = trpc.intake.get.useQuery({ engagementId: ret.engagementId });
  const practice = trpc.practice.public.useQuery(undefined, { staleTime: Infinity }).data;
  const preparer = practice?.preparerName.split(/\s+/)[0] ?? "your preparer";

  if (intake.isLoading) return <IntakeLoading />;
  if (intake.isError)
    return (
      <Banner tone="danger" title="Your questions didn't load" action={<Button variant="outline" onClick={() => intake.refetch()}>Try again</Button>}>
        Check your connection, then try again.
      </Banner>
    );
  const view = intake.data;
  if (view?.submittedAt || !OPEN_STAGES.includes(ret.stage)) {
    return (
      <IntakeSent
        sections={INTAKE_V1}
        answers={view?.answers ?? {}}
        submittedAt={view?.submittedAt ?? null}
        preparer={preparer}
        replyTo={practice?.replyToEmail}
        renderDocumentsLink={(children) => <Link to="/documents">{children}</Link>}
      />
    );
  }
  return <Flow engagementId={ret.engagementId} initial={view?.answers ?? {}} preparer={preparer} />;
}

function focusQuestion(id: string) {
  const el = document.querySelector(`[data-question="${id}"]`);
  const target = el?.querySelector<HTMLElement>("[role=radio][data-state=checked], textarea, input, [role=radio], [role=checkbox]");
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
  target?.focus({ preventScroll: true });
}

function Flow({ engagementId, initial, preparer }: { engagementId: string; initial: Answers; preparer: string }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [stepParam, setStep] = useQueryState("step", parseAsInteger.withOptions({ history: "push" }));
  const [editing, setEditing] = useQueryState("edit", parseAsBoolean);
  const [answers, setAnswers] = React.useState<Answers>(initial);
  const [drafts, setDrafts] = React.useState<Drafts>(() => Object.fromEntries(QUESTIONS.filter(isTyped).map((q) => [q.id, draftFrom(initial[q.id])])));
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});
  const live = React.useRef(new Set<string>()); // questions that have shown an error re-check as you go
  const focusNext = React.useRef<string | null>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const missingRef = React.useRef<HTMLDivElement>(null);
  const { state, queue, flush } = useAutosave(engagementId);

  // With no step in the URL, pick up where they left off.
  const [resume] = React.useState(() => {
    const first = missingRequired(initial)[0];
    return first ? sectionOf(first.id) + 1 : Object.keys(initial).length ? TOTAL : 1;
  });
  const step = Math.min(Math.max(stepParam ?? resume, 1), TOTAL);
  const section = step < TOTAL ? INTAKE_V1[step - 1]! : null;

  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = focusNext.current;
    focusNext.current = null;
    if (id) requestAnimationFrame(() => focusQuestion(id));
    else {
      window.scrollTo({ top: 0 });
      heading.current?.focus({ preventScroll: true });
    }
  }, [step]);

  const go = (n: number) => {
    void flush();
    if (n === TOTAL) void setEditing(null);
    void setStep(n);
  };

  const recheck = (q: Question, a: Answers, d: Drafts) => {
    if (live.current.has(q.id)) setErrors((e) => ({ ...e, [q.id]: problemWith(q, a, d) }));
  };

  const onAnswer = (q: Question, raw: unknown) => {
    const v = Array.isArray(raw) && raw.length === 0 ? undefined : raw;
    const next = { ...answers, [q.id]: v };
    setAnswers(next);
    queue({ [q.id]: v });
    recheck(q, next, drafts);
  };

  const onDraft = (q: Question, raw: string) => {
    const { value, error } = parseDraft(q, raw);
    const nextDrafts = { ...drafts, [q.id]: raw };
    const next = { ...answers, [q.id]: error ? undefined : value };
    setDrafts(nextDrafts);
    setAnswers(next);
    if (!error) queue({ [q.id]: value });
    recheck(q, next, nextDrafts);
  };

  const onBlur = (q: Question) => {
    const problem = problemWith(q, answers, drafts);
    if (problem) live.current.add(q.id);
    setErrors((e) => ({ ...e, [q.id]: problem }));
  };

  const onContinue = () => {
    if (!section) return;
    const found = section.questions.flatMap((q) => {
      const p = problemWith(q, answers, drafts);
      return p ? [[q.id, p] as const] : [];
    });
    if (found.length) {
      found.forEach(([id]) => live.current.add(id));
      setErrors((e) => ({ ...e, ...Object.fromEntries(found) }));
      focusQuestion(found[0]![0]);
      return;
    }
    go(editing ? TOTAL : step + 1);
  };

  const later = async () => {
    await flush();
    toast.success("Saved. Pick up where you left off any time.");
    navigate("/");
  };

  // Everything still in the way of sending: unanswered required questions and typed answers that can't be saved.
  const problems = QUESTIONS.filter((q) => problemWith(q, answers, drafts));

  const send = trpc.intake.save.useMutation({
    onSuccess: (view) => {
      utils.intake.get.setData({ engagementId }, view);
      void utils.engagement.mine.invalidate();
      toast.success(`Sent to ${preparer}`);
      void setStep(null);
      void setEditing(null);
      window.scrollTo({ top: 0 });
    },
    onError: (e) => toast.error(e.message),
  });

  const onSend = async () => {
    if (problems.length) {
      missingRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      missingRef.current?.focus({ preventScroll: true });
      return;
    }
    await flush();
    const defined = Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== undefined));
    send.mutate({ engagementId, answers: defined, submit: true });
  };

  const title = section?.title ?? "Check your answers";
  const intro = section
    ? (section.intro ?? (step === 1 ? "Answer what you can. Everything is needed unless it says optional, and we save as you go." : null))
    : `Make sure everything looks right, then send it to ${preparer}.`;

  return (
    <div className="grid grid-cols-1 gap-8">
      <StepHeader step={step} total={TOTAL} title={title} save={state} onRetry={() => void flush()} />

      <StepIntro title={title} intro={intro} headingRef={heading} />

      {section ? (
        <SectionStep sections={INTAKE_V1} section={section} answers={answers} drafts={drafts} errors={errors} onAnswer={onAnswer} onDraft={onDraft} onBlur={onBlur} />
      ) : (
        <>
          <MissingAnswers
            questions={problems}
            focusRef={missingRef}
            onPick={(q) => {
              focusNext.current = q.id;
              void setEditing(true);
              go(sectionOf(q.id) + 1);
            }}
          />
          <AnswerSummary
            sections={INTAKE_V1}
            answers={answers}
            onEdit={(i) => {
              void setEditing(true);
              go(i + 1);
            }}
          />
        </>
      )}

      <StepNav
        onBack={step > 1 ? () => go(step - 1) : undefined}
        nextLabel={section ? (editing ? "Save and review" : "Continue") : send.isPending ? "Sending…" : `Send to ${preparer}`}
        nextDisabled={section ? undefined : send.isPending}
        onNext={section ? onContinue : () => void onSend()}
        onLater={() => void later()}
      />
    </div>
  );
}
