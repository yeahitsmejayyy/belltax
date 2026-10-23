import type { ReminderPref } from "@app/schema";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { RemindersCard } from "../components/client-settings";
import { fnSource } from "./fixtures";
import { REMINDERS } from "./portal-settings.fixtures";
import raw from "./reminders-card.stories?raw";

// Settings · Reminders (portal 21-…-settings): email and text for each kind, saved as each switch flips. Texts need a
// mobile phone: without one the text switches are off limits and a note says why.
const meta: Meta<typeof RemindersCard> = { title: "Portal/Settings/RemindersCard", component: RemindersCard };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { RemindersCard } from "@app/ui/components/client-settings";' };
export default meta;
type Story = StoryObj<typeof RemindersCard>;

const changed = fn();

// The page's side: hold the choices and save each change.
function Reminders({ canText = true }: { canText?: boolean }) {
  const [reminders, setReminders] = useState<ReminderPref[]>(REMINDERS);
  return (
    <RemindersCard
      reminders={reminders}
      canText={canText}
      onChange={(next) => {
        changed(next);
        setReminders(next);
      }}
    />
  );
}

export const Default: Story = { name: "Reminders", render: () => <Reminders />, parameters: { docs: { source: { code: fnSource(raw, "Reminders") } } } };
export const NoPhone: Story = { name: "No phone: email only", render: () => <Reminders canText={false} />, parameters: { docs: { source: { code: fnSource(raw, "Reminders") } } } };
export const SaveFailed: Story = { name: "Save failed", args: { reminders: REMINDERS, error: "Your reminders didn't save. Try again.", onChange: fn() } };

export const RemindersCardTest: Story = {
  ...Default,
  name: "Reminders · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    changed.mockClear();
    const c = within(canvasElement);
    const invoiceEmail = c.getByRole("switch", { name: "Email", checked: false });
    await userEvent.click(invoiceEmail);
    await expect(changed).toHaveBeenLastCalledWith([REMINDERS[0], REMINDERS[1], { kind: "invoice", email: true, text: false }]);
    await expect(invoiceEmail).toBeChecked();
    await expect(c.queryByText("Add a mobile phone above to get reminders by text.")).not.toBeInTheDocument();
  },
};

export const NoPhoneTest: Story = {
  ...NoPhone,
  name: "No phone · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Add a mobile phone above to get reminders by text.")).toBeInTheDocument();
    for (const s of c.getAllByRole("switch", { name: "Text" })) await expect(s).toBeDisabled();
    for (const s of c.getAllByRole("switch", { name: "Email" })) await expect(s).toBeEnabled();
  },
};
