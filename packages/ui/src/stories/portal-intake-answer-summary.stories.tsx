import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { AnswerSummary } from "../components/intake";
import { fnSource } from "./fixtures";
import { DEMO_ANSWERS, DEMO_ANSWERS_DONE, DEMO_SECTIONS } from "./portal-intake.fixtures";
import raw from "./portal-intake-answer-summary.stories?raw";

// Every answer in words, grouped by section. With onEdit each section links back to its step; without it, it's the
// read-only copy. The questionnaire is a prop (`sections`; the portal passes INTAKE_V1).
const meta: Meta<typeof AnswerSummary> = {
  title: "Portal/Intake/AnswerSummary",
  component: AnswerSummary,
  args: { sections: DEMO_SECTIONS, answers: DEMO_ANSWERS_DONE },
  decorators: [(Story) => <div className="w-full max-w-2xl">{Story()}</div>],
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { AnswerSummary } from "@app/ui/components/intake";' };
export default meta;
type Story = StoryObj<typeof AnswerSummary>;

export const ReadOnly: Story = { name: "Read-only" };
export const Editable: Story = { args: { onEdit: () => {} } };
export const StillToAnswer: Story = { name: "Still to answer", args: { answers: DEMO_ANSWERS, onEdit: () => {} } };

// Edit goes out as the section's index; the page turns that into a step.
function EditFromSummary() {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="grid gap-4">
      <AnswerSummary sections={DEMO_SECTIONS} answers={DEMO_ANSWERS} onEdit={(i) => setEditing(DEMO_SECTIONS[i]!.title)} />
      <p data-testid="editing">{editing ? `Editing: ${editing}` : "Not editing"}</p>
    </div>
  );
}

export const Edit: Story = { name: "Edit a section", render: () => <EditFromSummary />, parameters: { docs: { source: { code: fnSource(raw, "EditFromSummary") } } } };
export const EditTest: Story = {
  ...Edit,
  name: "Edit a section · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Still to answer")).toBeInTheDocument();
    await expect(c.getByText("$14,400.00")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Edit your work" }));
    await expect(c.getByTestId("editing")).toHaveTextContent("Editing: Your work");
  },
};
