import { isVisible, type Question, type Section } from "@app/schema";

import { cn } from "@app/ui/utils";

import { QuestionField } from "./question";
import { followUpsOf, rootsOf, type Answers, type Drafts } from "./rules";

// One section of the questionnaire as a step (portal 09/10). A follow-up appears under the answer that
// asks for it, indented and eased in; an answer it hides is kept but no longer counts.

type Props = {
  section: Section;
  answers: Answers;
  drafts: Drafts;
  errors: Record<string, string | null>;
  onAnswer: (q: Question, value: unknown) => void;
  onDraft: (q: Question, raw: string) => void;
  onBlur: (q: Question) => void;
};

export function SectionStep(props: Props) {
  const { section, answers } = props;
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
