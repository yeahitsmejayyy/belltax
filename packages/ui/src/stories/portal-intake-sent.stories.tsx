import type { Meta, StoryObj } from "@storybook/react-vite";

import { IntakeSent } from "../components/intake";
import { DEMO_ANSWERS_DONE, DEMO_SECTIONS } from "./portal-intake.fixtures";

// After the answers are sent, or once the return is past the questionnaire. Sent answers aren't shown back (send-only
// portal); past the questions stage they're shown read-only. The Documents link comes from `renderDocumentsLink`
// (a router Link in the portal, a plain anchor here).
const meta: Meta<typeof IntakeSent> = {
  title: "Portal/Intake/IntakeSent",
  component: IntakeSent,
  args: {
    sections: DEMO_SECTIONS,
    answers: DEMO_ANSWERS_DONE,
    submittedAt: "2026-10-20T18:05:00.000Z",
    preparer: "Morgan",
    replyTo: "hello@example.test",
    renderDocumentsLink: (children) => (
      <a href="#documents" onClick={(e) => e.preventDefault()}>
        {children}
      </a>
    ),
  },
  decorators: [(Story) => <div className="w-full max-w-2xl">{Story()}</div>],
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { IntakeSent } from "@app/ui/components/intake";' };
export default meta;
type Story = StoryObj<typeof IntakeSent>;

export const Sent: Story = {};
export const NoReplyTo: Story = { name: "Sent, no reply-to email", args: { replyTo: undefined } };
export const PastQuestions: Story = { name: "Past the questions stage", args: { submittedAt: null } };
export const Phone: Story = { name: "Phone (402)", globals: { viewport: { value: "phone", isRotated: false } } };
