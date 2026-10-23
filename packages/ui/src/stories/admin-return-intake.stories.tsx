import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { ReturnIntake } from "../components/return-intake";
import { INTAKE_DRAFT, INTAKE_SECTIONS, INTAKE_SUBMITTED } from "./admin-return.fixtures";

// A return's Intake tab (admin 13-return-detail-return-intake), the same component apps/admin/src/pages/return/intake-tab.tsx
// renders: the client's answers, read-only, in the questionnaire's words, only the questions they could see. The admin
// passes INTAKE_V1 as `sections`; these stories pass an invented questionnaire (portal-intake.fixtures).
const meta: Meta<typeof ReturnIntake> = {
  title: "Admin/Return/ReturnIntake",
  component: ReturnIntake,
  parameters: { usage: 'import { ReturnIntake, answerInWords } from "@app/ui/components/return-intake";' },
  args: { sections: INTAKE_SECTIONS },
};
export default meta;
type Story = StoryObj<typeof ReturnIntake>;

export const Submitted: Story = { args: { intake: INTAKE_SUBMITTED } };
export const Draft: Story = { name: "Not submitted yet", args: { intake: INTAKE_DRAFT } };
export const NotStarted: Story = { name: "Not started", args: { intake: null } };

export const SubmittedTest: Story = {
  ...Submitted,
  name: "Submitted · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/^Submitted .* · version 1$/)).toBeInTheDocument();
    await expect(c.getByText("$14,400.00")).toBeInTheDocument();
    await expect(c.getByText("A job (W2), Gig or freelance work")).toBeInTheDocument();
    await expect(c.getByText("Rent")).toBeInTheDocument();
  },
};

export const DraftTest: Story = {
  ...Draft,
  name: "Not submitted yet · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/1 required question still unanswered\./)).toBeInTheDocument();
    await expect(c.getAllByText("Not answered").length).toBeGreaterThan(0);
  },
};
