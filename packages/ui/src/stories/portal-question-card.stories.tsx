import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { DocumentList, QuestionCard } from "../components/client-documents";
import { QUESTIONS } from "./portal-documents.fixtures";

// A question from the preparer, answered in place on Documents. The card checks there's an answer and shows a failure
// by the field; sending it is the app's business (`onAnswer`). Invented questions.
const meta: Meta<typeof QuestionCard> = {
  title: "Portal/Documents/QuestionCard",
  component: QuestionCard,
  parameters: { usage: 'import { DocumentList, QuestionCard } from "@app/ui/components/client-documents";' },
  args: { title: QUESTIONS[0]!.title, note: QUESTIONS[0]!.note, pending: false, onAnswer: fn() },
  decorators: [(Story) => <div className="w-[36rem] max-w-full"><DocumentList label="Questions"><Story /></DocumentList></div>],
};
export default meta;
type Story = StoryObj<typeof QuestionCard>;

export const Default: Story = {};
export const NoNote: Story = { name: "Without a note", args: { title: QUESTIONS[1]!.title, note: null } };
export const Sending: Story = { args: { pending: true } };

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args, step }) => {
    const c = within(canvasElement);
    const field = c.getByLabelText("Your answer");
    await step("Sending nothing says what's wrong and keeps focus on the field", async () => {
      await userEvent.click(c.getByRole("button", { name: "Send answer" }));
      await expect(c.getByRole("alert")).toHaveTextContent("Write your answer first.");
      await expect(field).toHaveFocus();
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(args.onAnswer).not.toHaveBeenCalled();
    });
    await step("Typing clears it; sending passes the trimmed answer", async () => {
      await userEvent.type(field, "  Yes, on June 1.  ");
      await expect(c.queryByRole("alert")).toBeNull();
      await userEvent.click(c.getByRole("button", { name: "Send answer" }));
      await expect(args.onAnswer).toHaveBeenCalledWith("Yes, on June 1.");
    });
  },
};

export const FailsTest: Story = {
  name: "Fails · test",
  tags: ["!dev", "!autodocs"],
  args: { onAnswer: fn(async () => { throw new Error("That didn't send. Try again."); }) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText("Your answer"), "No");
    await userEvent.click(c.getByRole("button", { name: "Send answer" }));
    await waitFor(() => expect(c.getByRole("alert")).toHaveTextContent("That didn't send. Try again."));
  },
};

export const SendingTest: Story = {
  ...Sending,
  name: "Sending · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Sending…" })).toBeDisabled();
  },
};
