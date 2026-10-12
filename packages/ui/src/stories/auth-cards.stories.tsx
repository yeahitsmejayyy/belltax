import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { InviteWelcome, SessionExpired, SetPasswordForm } from "../components/auth-cards";
import { Button } from "../components/button";

// Portal 01-access-invite, 02-access-setpw, 04-access-expired: the way in, before real sign-in (ticket 05) wires
// them to routes. Invented people only.
const meta: Meta = { title: "Admin/Auth" };
export default meta;
type Story = StoryObj;

const EMAIL = "m@example.com";

const accepted = fn();
const signIn = fn();
export const Invite: Story = {
  name: "Invite",
  render: () => <InviteWelcome preparerName="Patrick J. Bell" practiceName="Bell Tax" email={EMAIL} onAccept={accepted} onSignIn={signIn} />,
};
export const InviteTest: Story = {
  ...Invite,
  name: "Invite · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Patrick J. Bell invited you to set up your account" })).toBeInTheDocument();
    await expect(c.getByText(EMAIL)).toBeInTheDocument();
    await expect(c.getByText(/only Patrick can see them/)).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Set up my account" }));
    await expect(accepted).toHaveBeenCalledOnce();
    await userEvent.click(c.getByRole("button", { name: "Sign in" }));
    await expect(signIn).toHaveBeenCalledOnce();
  },
};

const created = fn();
export const SetPassword: Story = {
  name: "Create a password",
  render: () => <SetPasswordForm email={EMAIL} onSubmit={created} />,
};
export const SetPasswordTest: Story = {
  ...SetPassword,
  name: "Create a password · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const pw = () => c.getByLabelText("Password");
    const again = () => c.getByLabelText("Type it again");
    const rule = (name: string) => c.getByText(name).closest("li")!;

    await step("Submitting empty shows what's missing, under each field", async () => {
      await userEvent.click(c.getByRole("button", { name: "Create account" }));
      await expect(c.getByText("Create a password.")).toBeInTheDocument();
      await expect(c.getByText("Type your password again.")).toBeInTheDocument();
      await expect(created).not.toHaveBeenCalled();
    });

    await step("Too short: the error stays until it's fixed, and clears as you type", async () => {
      await userEvent.type(pw(), "short");
      await expect(c.getByText("Use at least 12 characters.")).toBeInTheDocument();
      await expect(rule("At least 12 characters")).toHaveAttribute("data-ok", "false");
      await userEvent.type(pw(), "-and-longer");
      await expect(c.queryByText("Use at least 12 characters.")).toBeNull();
      await expect(rule("At least 12 characters")).toHaveAttribute("data-ok", "true");
    });

    await step("Your email doesn't count as a password", async () => {
      await userEvent.clear(pw());
      await userEvent.type(pw(), "m@example.com!!");
      await expect(c.getByText("Don't use your email address in your password.")).toBeInTheDocument();
      await expect(rule("Not your email address")).toHaveAttribute("data-ok", "false");
      await userEvent.clear(pw());
      await userEvent.type(pw(), "copper-lantern-river");
    });

    await step("Show reveals both fields", async () => {
      await userEvent.click(c.getByRole("button", { name: "Show password" }));
      await expect(pw()).toHaveAttribute("type", "text");
      await expect(again()).toHaveAttribute("type", "text");
      await userEvent.click(c.getByRole("button", { name: "Hide password" }));
      await expect(pw()).toHaveAttribute("type", "password");
    });

    await step("They must match, then it submits the password", async () => {
      await userEvent.type(again(), "copper-lantern");
      await userEvent.click(c.getByRole("button", { name: "Create account" }));
      await expect(c.getByText("The passwords don't match.")).toBeInTheDocument();
      await userEvent.type(again(), "-river");
      await expect(c.queryByText("The passwords don't match.")).toBeNull();
      await expect(rule("Both passwords match")).toHaveAttribute("data-ok", "true");
      await userEvent.click(c.getByRole("button", { name: "Create account" }));
      await expect(created).toHaveBeenLastCalledWith("copper-lantern-river");
    });
  },
};

export const SetPasswordFails: Story = {
  name: "When creating the account fails",
  render: () => (
    <SetPasswordForm
      email={EMAIL}
      onSubmit={async () => {
        await new Promise((r) => setTimeout(r, 300));
        throw new Error("This invite link has already been used. Ask your preparer for a new one.");
      }}
    />
  ),
};
export const SetPasswordFailsTest: Story = {
  ...SetPasswordFails,
  name: "When creating the account fails · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText("Password"), "copper-lantern-river");
    await userEvent.type(c.getByLabelText("Type it again"), "copper-lantern-river");
    await userEvent.click(c.getByRole("button", { name: "Create account" }));
    await expect(await c.findByRole("button", { name: "Creating your account…" })).toBeDisabled();
    await waitFor(() => expect(c.getByText(/already been used/)).toBeInTheDocument());
    await expect(c.getByRole("button", { name: "Create account" })).toBeEnabled();
  },
};

const signInAgain = fn();
function Expired() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Expire the session
      </Button>
      <SessionExpired
        open={open}
        onSignIn={() => {
          signInAgain();
          setOpen(false);
        }}
      />
    </>
  );
}
export const SignedOut: Story = { name: "Signed out", render: () => <Expired /> };
export const SignedOutTest: Story = {
  ...SignedOut,
  name: "Signed out · test",
  tags: ["!dev"],
  play: async () => {
    const d = within(await screen.findByRole("alertdialog"));
    await expect(d.getByRole("heading", { name: "You've been signed out" })).toBeInTheDocument();
    await expect(d.getByText(/Everything you entered is saved/)).toBeInTheDocument();
    await userEvent.keyboard("{Escape}"); // no way out but signing in
    await expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.click(d.getByRole("button", { name: "Sign in again" }));
    await expect(signInAgain).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  },
};
