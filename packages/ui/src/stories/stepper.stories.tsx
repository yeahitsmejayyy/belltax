import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, within } from "storybook/test";

import { Button } from "../components/button";
import { Field } from "../components/field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/sheet";
import { StepFooter, Stepper } from "../components/stepper";

const meta: Meta = { title: "Product/Stepper" };
export default meta;
type Story = StoryObj;

export const Steps: Story = { render: () => <Stepper className="w-full max-w-sm" steps={["Your household", "Who you support", "Your income", "Review"]} current={1} /> };

// Portal 11-intake-add-someone: a multi-step sheet, one question group at a time.
const STEPS = ["Who is it?", "How are they related?", "Review"];
function AddSomeone() {
  const [step, setStep] = useState(0);
  return (
    <Sheet>
      <SheetTrigger asChild><Button>Add someone</Button></SheetTrigger>
      <SheetContent side="bottom" className="gap-4 rounded-t-2xl p-5">
        <SheetHeader className="p-0">
          <SheetTitle>Add someone you support</SheetTitle>
          <SheetDescription>A child, a parent, anyone who lived with you.</SheetDescription>
        </SheetHeader>
        <Stepper steps={STEPS} current={step} />
        {step === 0 ? <Field label="First name" /> : step === 1 ? <Field label="Relationship" placeholder="Daughter" /> : <p className="text-sm">Looks right? You can change it later.</p>}
        <StepFooter onBack={step > 0 ? () => setStep(step - 1) : undefined} onNext={() => setStep(Math.min(step + 1, STEPS.length - 1))} nextLabel={step === STEPS.length - 1 ? "Add" : "Continue"} />
      </SheetContent>
    </Sheet>
  );
}

export const AddSomeoneSheet: Story = {
  name: "Multi-step sheet (portal)",
  render: () => <AddSomeone />
};
export const AddSomeoneSheetTest: Story = {
  ...AddSomeoneSheet,
  name: "Multi-step sheet (portal) · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add someone" }));
    const sheet = within(await screen.findByRole("dialog"));
    await expect(sheet.getByRole("progressbar")).toHaveAccessibleName("Step 1 of 3: Who is it?");
    await userEvent.click(sheet.getByRole("button", { name: "Continue" }));
    await expect(sheet.getByLabelText("Relationship")).toBeInTheDocument();
    await userEvent.click(sheet.getByRole("button", { name: "Continue" }));
    await expect(sheet.getByRole("button", { name: "Add" })).toBeInTheDocument();
    await userEvent.click(sheet.getByRole("button", { name: "Back" }));
    await expect(sheet.getByText("Step 2 of 3")).toBeInTheDocument();
  },
};

