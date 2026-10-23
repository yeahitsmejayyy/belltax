import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ContactCard, type ContactValues } from "../components/client-settings";
import { fnSource } from "./fixtures";
import { CLIENT, PREPARER, TAKEN_EMAIL } from "./portal-settings.fixtures";
import raw from "./contact-card.stories?raw";

// Settings · Contact (portal 21-…-settings): the legal name is read-only; the email and mobile phone are the client's.
// The fields check themselves like a person (principles.md rule 10); the page saves and says why a save failed.
const meta: Meta<typeof ContactCard> = { title: "Portal/Settings/ContactCard", component: ContactCard };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { ContactCard } from "@app/ui/components/client-settings";' };
export default meta;
type Story = StoryObj<typeof ContactCard>;

const saved = fn();

// The page's side: a save that takes a moment, and an email another login already uses.
function Contact() {
  const [pending, setPending] = useState(false);
  const [taken, setTaken] = useState<string | null>(null);
  const [values, setValues] = useState<ContactValues>();
  return (
    <ContactCard
      name={CLIENT.name}
      email={CLIENT.email}
      phone={CLIENT.phone}
      preparer={PREPARER}
      pending={pending}
      emailError={taken}
      saved={values}
      onSave={(next) => {
        saved(next);
        if (next.email === TAKEN_EMAIL) return setTaken("Another account already uses that email.");
        setPending(true);
        setTimeout(() => {
          setPending(false);
          setValues(next);
        }, 300);
      }}
      onClearError={(which) => which === "email" && setTaken(null)}
    />
  );
}

export const Default: Story = { name: "Contact", render: () => <Contact />, parameters: { docs: { source: { code: fnSource(raw, "Contact") } } } };
export const NoPhone: Story = { name: "No phone yet", args: { name: CLIENT.name, email: CLIENT.email, phone: null, preparer: PREPARER, onSave: fn() } };
export const Saving: Story = { name: "Saving", args: { name: CLIENT.name, email: CLIENT.email, phone: CLIENT.phone, preparer: PREPARER, pending: true, onSave: fn() } };
export const SaveFailed: Story = {
  name: "Save failed",
  args: { name: CLIENT.name, email: CLIENT.email, phone: CLIENT.phone, preparer: PREPARER, error: "That didn't save. Check your connection and try again.", onSave: fn() },
};

export const ContactCardTest: Story = {
  ...Default,
  name: "Contact · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    saved.mockClear();
    const c = within(canvasElement);
    const email = c.getByLabelText("Email");
    const phone = c.getByLabelText("Mobile phone");
    // A bad phone stops the save and says what to do.
    await userEvent.clear(phone);
    await userEvent.type(phone, "555");
    await userEvent.click(c.getByRole("button", { name: "Save changes" }));
    await expect(await c.findByText("Enter a 10-digit US number, or leave it blank.")).toBeInTheDocument();
    await expect(saved).not.toHaveBeenCalled();
    // An email someone else uses shows under the field and clears on the next keystroke.
    await userEvent.clear(phone);
    await userEvent.clear(email);
    await userEvent.type(email, TAKEN_EMAIL);
    await userEvent.click(c.getByRole("button", { name: "Save changes" }));
    await expect(await c.findByText("Another account already uses that email.")).toBeInTheDocument();
    await userEvent.type(email, "x");
    await expect(c.queryByText("Another account already uses that email.")).not.toBeInTheDocument();
    // A good save sends trimmed values and waits.
    await userEvent.clear(email);
    await userEvent.type(email, "  renata.new@example.test ");
    await userEvent.type(phone, "(555) 010-0199");
    await userEvent.click(c.getByRole("button", { name: "Save changes" }));
    await expect(saved).toHaveBeenLastCalledWith({ email: "renata.new@example.test", phone: "(555) 010-0199" });
    await expect(c.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await waitFor(() => expect(c.getByRole("button", { name: "Save changes" })).toBeEnabled());
    await expect(email).toHaveValue("renata.new@example.test");
  },
};
