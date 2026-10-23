import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import {
  AnswerSummary,
  IntakeLoading,
  MissingAnswers,
  SectionStep,
  StepHeader,
  StepIntro,
  StepNav,
  visibleIn,
  type Answers,
  type Drafts,
} from "../components/intake";
import { fnSource } from "./fixtures";
import { DEMO_ANSWERS, DEMO_SECTIONS } from "./portal-intake.fixtures";
import raw from "./portal-intake-questionnaire.stories?raw";

// The whole questionnaire as the portal's Questions page lays it out: StepHeader, StepIntro, a SectionStep per section,
// then the review (MissingAnswers + AnswerSummary), with StepNav under every step. The page adds autosave, the server's
// checks and sending; this story keeps answers in state and treats "required and empty" as the only problem.
const meta: Meta = { title: "Portal/Intake/Questionnaire" };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = {
  ...meta.parameters,
  usage: 'import { AnswerSummary, IntakeLoading, MissingAnswers, SectionStep, StepHeader, StepIntro, StepNav } from "@app/ui/components/intake";',
};
export default meta;
type Story = StoryObj;

const isVisible = visibleIn(DEMO_SECTIONS);
const TOTAL = DEMO_SECTIONS.length + 1; // the sections, then the review

function Questionnaire({ initial = {}, start = 1 }: { initial?: Answers; start?: number }) {
  const [step, setStep] = useState(start);
  const [answers, setAnswers] = useState<Answers>(initial);
  const [drafts, setDrafts] = useState<Drafts>(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])));
  const [sent, setSent] = useState(false);
  const section = step < TOTAL ? DEMO_SECTIONS[step - 1]! : null;
  const missing = DEMO_SECTIONS.flatMap((s) => s.questions).filter((q) => q.required && isVisible(q, answers) && answers[q.id] === undefined);
  const title = section?.title ?? "Check your answers";
  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-8">
      <StepHeader step={step} total={TOTAL} title={title} save={{ status: "saved", at: new Date("2026-10-22T15:42:00") }} onRetry={() => {}} />
      <StepIntro title={title} intro={section ? section.intro : "Make sure everything looks right, then send it to Morgan."} />
      {section ? (
        <SectionStep
          sections={DEMO_SECTIONS}
          section={section}
          answers={answers}
          drafts={drafts}
          errors={{}}
          onAnswer={(q, v) => setAnswers((a) => ({ ...a, [q.id]: Array.isArray(v) && !v.length ? undefined : v }))}
          onDraft={(q, raw) => {
            setDrafts((d) => ({ ...d, [q.id]: raw }));
            setAnswers((a) => ({ ...a, [q.id]: raw.trim() || undefined }));
          }}
          onBlur={() => {}}
        />
      ) : (
        <>
          <MissingAnswers questions={missing} onPick={(q) => setStep(DEMO_SECTIONS.findIndex((s) => s.questions.includes(q)) + 1)} />
          <AnswerSummary sections={DEMO_SECTIONS} answers={answers} onEdit={(i) => setStep(i + 1)} />
        </>
      )}
      <StepNav
        onBack={step > 1 ? () => setStep(step - 1) : undefined}
        nextLabel={section ? "Continue" : sent ? "Sent" : "Send to Morgan"}
        nextDisabled={!section && (sent || missing.length > 0)}
        onNext={() => (section ? setStep(step + 1) : setSent(true))}
        onLater={() => {}}
      />
    </div>
  );
}

export const FirstStep: Story = { name: "First step", render: () => <Questionnaire />, parameters: { docs: { source: { code: fnSource(raw, "Questionnaire") } } } };
export const Review: Story = { name: "Review, one still to answer", render: () => <Questionnaire initial={DEMO_ANSWERS} start={TOTAL} /> };
export const Phone: Story = { name: "Phone (402)", render: () => <Questionnaire initial={DEMO_ANSWERS} start={TOTAL} />, globals: { viewport: { value: "phone", isRotated: false } } };
export const Loading: Story = { render: () => <div className="w-full max-w-2xl"><IntakeLoading /></div> };

export const ReviewTest: Story = {
  ...Review,
  name: "Review · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("One question still needs an answer")).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "Send to Morgan" })).toBeDisabled();
    // The missing question takes you back to its step.
    await userEvent.click(c.getByRole("button", { name: "What kind of gig work?" }));
    await expect(c.getByRole("heading", { level: 1, name: "Your work" })).toBeInTheDocument();
    await userEvent.type(c.getByLabelText("What kind of gig work?"), "Dog walking");
    await userEvent.click(c.getByRole("button", { name: "Continue" }));
    await userEvent.click(c.getByRole("button", { name: "Continue" }));
    await expect(c.getByRole("heading", { level: 1, name: "Check your answers" })).toBeInTheDocument();
    await expect(c.queryByText("One question still needs an answer")).toBeNull();
    // Edit from the summary, then back.
    await userEvent.click(c.getByRole("button", { name: "Edit your home this year" }));
    await expect(c.getByText("Step 1 of 4")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Continue" }));
    await userEvent.click(c.getByRole("button", { name: "Continue" }));
    await userEvent.click(c.getByRole("button", { name: "Continue" }));
    await userEvent.click(c.getByRole("button", { name: "Send to Morgan" }));
    await expect(c.getByRole("button", { name: "Sent" })).toBeDisabled();
  },
};
