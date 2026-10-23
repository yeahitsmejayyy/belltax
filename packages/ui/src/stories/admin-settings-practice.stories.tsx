import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { PracticeSettings, type PracticeDetails } from "../components/admin-settings";
import { PRACTICE } from "./admin-settings.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-settings-practice.stories?raw";

// Settings › Practice (admin 31-settings-settings-practice): the details clients see in the portal, emails and letters,
// then the way into next season. Each field checks itself like a person (principles.md rule 10). Invented data.
const meta: Meta<typeof PracticeSettings> = { title: "Admin/Settings/PracticeSettings", component: PracticeSettings };
meta.parameters = { ...meta.parameters, usage: 'import { PracticeSettings } from "@app/ui/components/admin-settings";' };
export default meta;
type Story = StoryObj<typeof PracticeSettings>;

const saved = fn();
const seasonLink = (children: React.ReactNode) => <a href="#season">{children}</a>;

// The admin's side: a save that takes a moment, then the stored details come back (and the form starts again).
function Practice() {
  const [practice, setPractice] = useState<PracticeDetails>(PRACTICE);
  const [pending, setPending] = useState(false);
  return (
    <PracticeSettings
      practice={practice}
      pending={pending}
      onSave={(values) => {
        saved(values);
        setPending(true);
        setTimeout(() => {
          setPending(false);
          setPractice({ ...values, preparerCredential: values.preparerCredential || null, phone: values.phone || null, city: values.city || null, state: values.state || null, updatedAt: new Date().toISOString() });
        }, 300);
      }}
      renderSeasonLink={(children) => <a href="#season">{children}</a>}
    />
  );
}

export const Default: Story = { name: "Practice", render: () => <Practice />, parameters: { docs: { source: { code: fnSource(raw, "Practice") } } } };
export const Loading: Story = { name: "Loading", args: { onSave: fn(), renderSeasonLink: seasonLink } };
export const LoadFailed: Story = { name: "Couldn't load", args: { loadError: "The server didn't answer.", onSave: fn(), renderSeasonLink: seasonLink } };
export const SaveFailed: Story = { name: "Save failed", args: { practice: PRACTICE, error: "That didn't save. Try again.", onSave: fn(), renderSeasonLink: seasonLink } };

export const PracticeSettingsTest: Story = {
  ...Default,
  name: "Practice · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    saved.mockClear();
    const c = within(canvasElement);
    const state = c.getByLabelText("State");
    // A state that isn't two letters stops the save and says what to do.
    await userEvent.clear(state);
    await userEvent.type(state, "C");
    await userEvent.click(c.getByRole("button", { name: "Save changes" }));
    await expect(await c.findByText("Use the two-letter state, like CA.")).toBeInTheDocument();
    await expect(saved).not.toHaveBeenCalled();
    // A good save sends every field and waits.
    await userEvent.type(state, "A");
    const name = c.getByLabelText("Practice name");
    await userEvent.clear(name);
    await userEvent.type(name, "Bell Tax Prep");
    await userEvent.click(c.getByRole("button", { name: "Save changes" }));
    await expect(saved).toHaveBeenCalledWith({
      practiceName: "Bell Tax Prep",
      preparerName: PRACTICE.preparerName,
      preparerCredential: "CRTP",
      replyToEmail: PRACTICE.replyToEmail,
      phone: PRACTICE.phone,
      city: PRACTICE.city,
      state: "CA",
    });
    await expect(c.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await waitFor(() => expect(c.getByRole("button", { name: "Save changes" })).toBeEnabled());
    await expect(c.getByLabelText("Practice name")).toHaveValue("Bell Tax Prep");
    await expect(c.getByRole("link", { name: "Start next season" })).toHaveAttribute("href", "#season");
  },
};
