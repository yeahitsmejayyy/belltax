import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { StepHeader, type SaveState } from "../components/intake";
import { fnSource } from "./fixtures";
import raw from "./portal-intake-step-header.stories?raw";

// "Step 2 of 4" with the quiet save state beside it and the bar underneath. The portal passes its autosave's state in.
const meta: Meta<typeof StepHeader> = {
  title: "Portal/Intake/StepHeader",
  component: StepHeader,
  args: { step: 2, total: 4, title: "Your work", save: { status: "idle" }, onRetry: () => {} },
  decorators: [(Story) => <div className="w-full max-w-2xl">{Story()}</div>],
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { StepHeader } from "@app/ui/components/intake";' };
export default meta;
type Story = StoryObj<typeof StepHeader>;

export const Idle: Story = {};
export const Saving: Story = { args: { save: { status: "saving" } } };
export const Saved: Story = { args: { save: { status: "saved", at: new Date("2026-10-22T15:42:00") } } };
export const NotSaved: Story = { name: "Not saved", args: { save: { status: "error" } } };

// A save that fails once, then goes through on Try again.
function RetrySave() {
  const [save, setSave] = useState<SaveState>({ status: "error" });
  return (
    <StepHeader
      step={2}
      total={4}
      title="Your work"
      save={save}
      onRetry={() => {
        setSave({ status: "saving" });
        setTimeout(() => setSave({ status: "saved", at: new Date("2026-10-22T15:42:00") }), 300);
      }}
    />
  );
}

export const Retry: Story = { name: "Try again", render: () => <RetrySave />, parameters: { docs: { source: { code: fnSource(raw, "RetrySave") } } } };
export const RetryTest: Story = {
  ...Retry,
  name: "Try again · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("progressbar")).toHaveAccessibleName("Step 2 of 4: Your work");
    await expect(c.getByText("Not saved yet")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Try again" }));
    await expect(c.getByText("Saving…")).toBeInTheDocument();
    await expect(await c.findByText(/Saved \d/)).toBeInTheDocument();
  },
};
