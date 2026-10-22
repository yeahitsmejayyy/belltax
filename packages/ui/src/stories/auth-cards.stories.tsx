import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { InviteWelcome, LinkGone, SessionExpired, SetPasswordForm, SignInForm } from "../components/auth-cards";
import { CopyLink } from "../components/copy-link";
import { Button } from "../components/button";
import { fnSource } from "./fixtures";
import raw from "./auth-cards.stories?raw";

// The way in (portal 01-access-invite, 02-access-setpw, 04-access-expired; wired by ticket 05): sign in, an invite or
// reset link, a link that no longer works, and the one-time link the preparer copies. Invented people only.
const meta: Meta = { title: "Admin/Auth" };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { InviteWelcome, LinkGone, SessionExpired, SetPasswordForm, SignInForm } from \"@app/ui/components/auth-cards\";\nimport { CopyLink } from \"@app/ui/components/copy-link\";\nimport { Button } from \"@app/ui/components/button\";" };
export default meta;
type Story = StoryObj;

const EMAIL = "m@example.com";

const accepted = fn();
const signIn = fn();
export const Invite: Story = {
  name: "Invite",
  render: () => <InviteWelcome preparerName="Morgan Hale" practiceName="Bell Tax" email={EMAIL} onAccept={accepted} onSignIn={signIn} />,
};
export const InviteTest: Story = {
  ...Invite,
  name: "Invite · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Morgan Hale invited you to set up your account" })).toBeInTheDocument();
    await expect(c.getByText(EMAIL)).toBeInTheDocument();
    await expect(c.getByText(/only Morgan can see them/)).toBeInTheDocument();
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
  tags: ["!dev", "!autodocs"],
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
  tags: ["!dev", "!autodocs"],
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
export const SignedOut: Story = { name: "Signed out", render: () => <Expired />, parameters: { docs: { source: { code: fnSource(raw, "Expired") } } } };
export const SignedOutTest: Story = {
  ...SignedOut,
  name: "Signed out · test",
  tags: ["!dev", "!autodocs"],
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

const signedIn = fn();
export const SignIn: Story = {
  render: () => (
    <SignInForm
      description="See where your return stands and what's needed from you."
      onSubmit={async (email, password) => {
        signedIn(email, password);
        if (password !== "correct horse battery staple") throw new Error("That email and password don't match.");
      }}
    />
  ),
};
export const SignInTest: Story = {
  ...SignIn,
  name: "Sign in · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Sign in" }));
    await expect(await c.findByText("Enter your email and password.")).toBeInTheDocument();
    await userEvent.type(c.getByLabelText("Email"), EMAIL);
    await userEvent.type(c.getByLabelText("Password"), "wrong password");
    await userEvent.click(c.getByRole("button", { name: "Sign in" }));
    await expect(await c.findByText("That email and password don't match.")).toBeInTheDocument();
    await expect(signedIn).toHaveBeenCalledWith(EMAIL, "wrong password");
  },
};

export const LinkNoLongerWorks: Story = { render: () => <LinkGone preparerName="Morgan Hale" onSignIn={fn()} /> };
export const LinkNoLongerWorksTest: Story = {
  ...LinkNoLongerWorks,
  name: "Link no longer works · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "This link no longer works" })).toBeInTheDocument();
    await expect(c.getByText(/Ask Morgan for a new link/)).toBeInTheDocument();
  },
};

const URL_ = "https://portal.example/invite/q1Xw3m5zJ7xk2p9rT4vB8nC0dF6hL2sY";
export const OneTimeLink: Story = {
  render: () => (
    <div className="max-w-md">
      <CopyLink url={URL_} label="Invite link for jo@example.test" note="Send it to them yourself. It works once, for 7 days." />
    </div>
  ),
};
export const OneTimeLinkTest: Story = {
  ...OneTimeLink,
  name: "One-time link · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByLabelText("Invite link for jo@example.test")).toHaveValue(URL_);
    await userEvent.click(c.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(c.getByLabelText("Invite link for jo@example.test")).toHaveFocus());
  },
};

