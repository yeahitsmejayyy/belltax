import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "../components/button";
import { Field, useFieldValidation, type Validate } from "../components/field";

const meta: Meta<typeof Field> = { title: "Primitives/Field", component: Field, parameters: { layout: "padded" } };
export default meta;
type Story = StoryObj<typeof Field>;

export const Default: Story = { args: { label: "Email", type: "email", placeholder: "you@example.com" } };
export const WithHint: Story = { args: { label: "Last four of your SSN", hint: "We never ask for the full number.", inputMode: "numeric" } };
export const WithError: Story = { args: { label: "Last four of your SSN", error: "Enter the 4 digits.", defaultValue: "12" } };
export const Disabled: Story = { args: { label: "Email", disabled: true, defaultValue: "dana@example.test" } };

// Rule 10: on blur, then live while typing, then on submit.
const lastFour: Validate = (v) => (/^\d{4}$/.test(v) ? null : "Enter the 4 digits.");

function Demo() {
  const f = useFieldValidation(lastFour);
  return (
    <form
      noValidate
      className="grid max-w-sm gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        f.validateNow();
      }}
    >
      <Field label="Last four of your SSN" inputMode="numeric" error={f.error} {...f.inputProps} />
      <Field label="Nickname (optional)" />
      <Button type="submit" size="touch">Continue</Button>
    </form>
  );
}

export const ValidationTiming: Story = {
  name: "Validation timing",
  render: () => <Demo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Last four of your SSN");

    await step("no error while typing the first time", async () => {
      await userEvent.type(input, "12");
      await expect(canvas.queryByRole("alert")).toBeNull();
    });
    await step("leaving the field checks it", async () => {
      await userEvent.click(canvas.getByLabelText("Nickname (optional)"));
      await expect(canvas.getByRole("alert")).toHaveTextContent("Enter the 4 digits.");
      await expect(input).toHaveAttribute("aria-invalid", "true");
    });
    await step("once shown, it clears the moment it's fixed", async () => {
      await userEvent.type(input, "34");
      await expect(canvas.queryByRole("alert")).toBeNull();
      await expect(input).not.toHaveAttribute("aria-invalid");
    });
    await step("submit checks again", async () => {
      await userEvent.clear(input);
      await userEvent.click(canvas.getByRole("button", { name: "Continue" }));
      await expect(canvas.getByRole("alert")).toHaveTextContent("Enter the 4 digits.");
      await expect(input).toHaveAccessibleDescription("Enter the 4 digits.");
    });
  },
};
