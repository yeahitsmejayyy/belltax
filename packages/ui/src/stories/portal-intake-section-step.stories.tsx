import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { SectionStep, type Answers, type Drafts } from "../components/intake";
import { fnSource } from "./fixtures";
import { DEMO_ANSWERS, DEMO_SECTIONS } from "./portal-intake.fixtures";
import raw from "./portal-intake-section-step.stories?raw";

// One section of the questionnaire as a step. A follow-up appears under the answer that asks for it, indented and
// eased in. The portal passes INTAKE_V1 as `sections`; these stories pass an invented one (portal-intake.fixtures).
const meta: Meta<typeof SectionStep> = {
  title: "Portal/Intake/SectionStep",
  component: SectionStep,
  args: { sections: DEMO_SECTIONS, section: DEMO_SECTIONS[0]!, answers: {}, drafts: {}, errors: {}, onAnswer: () => {}, onDraft: () => {}, onBlur: () => {} },
  decorators: [(Story) => <div className="w-full max-w-2xl">{Story()}</div>],
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { SectionStep } from "@app/ui/components/intake";' };
export default meta;
type Story = StoryObj<typeof SectionStep>;

export const Empty: Story = { name: "Nothing answered" };
export const WithFollowUps: Story = { name: "With follow-ups", args: { answers: DEMO_ANSWERS, drafts: { moved_on: "2025-06-14", rent_paid: "14400" } } };
export const WithErrors: Story = { name: "With errors", args: { errors: { moved: "Choose yes or no.", home_type: "Choose an answer." } } };

// State for the story only; the portal's page also autosaves and checks each answer.
function Step() {
  const [answers, setAnswers] = useState<Answers>({});
  const [drafts, setDrafts] = useState<Drafts>({});
  return (
    <SectionStep
      sections={DEMO_SECTIONS}
      section={DEMO_SECTIONS[0]!}
      answers={answers}
      drafts={drafts}
      errors={{}}
      onAnswer={(q, v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
      onDraft={(q, raw) => {
        setDrafts((d) => ({ ...d, [q.id]: raw }));
        setAnswers((a) => ({ ...a, [q.id]: raw.trim() || undefined }));
      }}
      onBlur={() => {}}
    />
  );
}

export const Interactive: Story = { render: () => <Step />, parameters: { docs: { source: { code: fnSource(raw, "Step") } } } };
export const InteractiveTest: Story = {
  ...Interactive,
  name: "Interactive · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByLabelText("When did you move?")).toBeNull();
    await userEvent.click(c.getByRole("radio", { name: "Yes" }));
    await expect(await c.findByLabelText("When did you move?")).toBeInTheDocument();
    await userEvent.click(c.getByRole("radio", { name: "Rent" }));
    await expect(await c.findByLabelText(/About how much rent/)).toBeInTheDocument();
    await userEvent.click(c.getByRole("radio", { name: "Own" }));
    await expect(c.queryByLabelText(/About how much rent/)).toBeNull();
    await userEvent.click(c.getByRole("radio", { name: "No" }));
    await expect(c.queryByLabelText("When did you move?")).toBeNull();
  },
};
