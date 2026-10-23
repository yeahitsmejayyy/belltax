import type { Question, Section } from "@app/schema";

import type { Answers } from "../components/intake";

// A small invented questionnaire for the Portal/Intake stories: the same shape as INTAKE_V1 (@app/schema), with every
// question type and follow-ups that appear under the answer that asks for them. Nothing here is real.
export const DEMO_SECTIONS: readonly Section[] = [
  {
    id: "home",
    title: "Your home this year",
    questions: [
      { id: "moved", type: "yes_no", label: "Did you move this year?", required: true },
      { id: "moved_on", type: "date", label: "When did you move?", required: true, showIf: { question: "moved", equals: true } },
      {
        id: "home_type",
        type: "choice",
        label: "Do you rent or own where you live now?",
        required: true,
        options: [
          { value: "rent", label: "Rent" },
          { value: "own", label: "Own" },
          { value: "other", label: "Something else" },
        ],
      },
      { id: "rent_paid", type: "money", label: "About how much rent did you pay in total?", help: "A rough figure is fine.", required: false, showIf: { question: "home_type", equals: "rent" } },
    ],
  },
  {
    id: "work",
    title: "Your work",
    intro: "Tell us where your money came from this year.",
    questions: [
      {
        id: "income",
        type: "multi",
        label: "Which of these did you have?",
        required: true,
        options: [
          { value: "job", label: "A job (W2)" },
          { value: "gig", label: "Gig or freelance work" },
          { value: "pension", label: "A pension" },
        ],
      },
      { id: "gig_kind", type: "text", label: "What kind of gig work?", required: true, showIf: { question: "income", includes: "gig" } },
    ],
  },
  {
    id: "anything_else",
    title: "Anything else",
    questions: [{ id: "notes", type: "text", label: "Anything else we should know?", required: false }],
  },
];

const ALL = DEMO_SECTIONS.flatMap((s) => s.questions);
export const demoQuestion = (id: string): Question => ALL.find((q) => q.id === id)!;

// Partway through: moved, renting, a job and gig work, the gig question not answered yet.
export const DEMO_ANSWERS: Answers = { moved: true, moved_on: "2025-06-14", home_type: "rent", rent_paid: 14400, income: ["job", "gig"] };
// Everything answered.
export const DEMO_ANSWERS_DONE: Answers = { ...DEMO_ANSWERS, gig_kind: "Weekend food delivery", notes: "I started a second job in November." };
