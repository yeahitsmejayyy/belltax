import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { QuestionField } from "../components/intake";
import { fnSource } from "./fixtures";
import { demoQuestion } from "./portal-intake.fixtures";
import raw from "./portal-intake-question.stories?raw";

// One question, drawn by its type: yes/no and choices as whole-row cards, several-of as checkbox rows, typed answers
// as fields. The question is data (a Question from @app/schema); the value comes in, every change goes out.
const meta: Meta<typeof QuestionField> = {
  title: "Portal/Intake/QuestionField",
  component: QuestionField,
  args: { value: undefined, draft: "", error: null, onAnswer: () => {}, onDraft: () => {}, onBlur: () => {} },
  decorators: [(Story) => <div className="w-full max-w-2xl">{Story()}</div>],
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { QuestionField } from "@app/ui/components/intake";' };
export default meta;
type Story = StoryObj<typeof QuestionField>;

export const YesNo: Story = { name: "Yes or no", args: { q: demoQuestion("moved"), value: true } };
export const Choice: Story = { args: { q: demoQuestion("home_type"), value: "rent" } };
export const SeveralOf: Story = { name: "Several of", args: { q: demoQuestion("income"), value: ["job"] } };
export const Money: Story = { name: "Money (optional, with help)", args: { q: demoQuestion("rent_paid"), draft: "14,400" } };
export const DateField: Story = { name: "Date", args: { q: demoQuestion("moved_on"), draft: "2025-06-14" } };
export const Text: Story = { args: { q: demoQuestion("notes"), draft: "I started a second job in November." } };
export const WithError: Story = { name: "With an error", args: { q: demoQuestion("home_type"), error: "Choose an answer." } };

// Holding the value the way the portal's page does: choices answer at once, typed fields keep the draft.
function Answering() {
  const [moved, setMoved] = useState<unknown>(undefined);
  const [notes, setNotes] = useState("");
  return (
    <div className="grid gap-8">
      <QuestionField q={demoQuestion("moved")} value={moved} draft="" error={null} onAnswer={setMoved} onDraft={() => {}} onBlur={() => {}} />
      <QuestionField q={demoQuestion("notes")} value={notes || undefined} draft={notes} error={null} onAnswer={() => {}} onDraft={setNotes} onBlur={() => {}} />
      <output data-testid="answers">{JSON.stringify({ moved, notes })}</output>
    </div>
  );
}

export const AnsweringStory: Story = { name: "Answering", render: () => <Answering />, parameters: { docs: { source: { code: fnSource(raw, "Answering") } } } };
export const AnsweringTest: Story = {
  ...AnsweringStory,
  name: "Answering · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("radio", { name: "No" }));
    await expect(c.getByRole("radio", { name: "No" })).toHaveAttribute("data-state", "checked");
    await userEvent.type(c.getByLabelText(/Anything else we should know/), "New baby");
    await expect(c.getByTestId("answers")).toHaveTextContent('{"moved":false,"notes":"New baby"}');
  },
};
