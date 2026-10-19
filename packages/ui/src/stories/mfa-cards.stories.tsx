import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { AuthenticatorSetup, CodeStep, LostPasskey, PasskeyList, PasskeySetup, RecoveryCodes } from "../components/mfa-cards";
import { LinkSetupSteps, SignInSteps } from "../components/sign-in-flows";

// MFA for everyone (ticket 05b): a passkey first; a password and an authenticator app where a device can't make one;
// the preparer's recovery codes; "Lost your passkey?"; passkeys in Settings. The secret and codes are the RFCs' public
// examples and invented strings, never real ones.
const meta: Meta = { title: "Admin/Auth/MFA" };
export default meta;
type Story = StoryObj;

const EMAIL = "m@example.com";
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const URI = `otpauth://totp/Bell%20Tax%3A${encodeURIComponent(EMAIL)}?secret=${SECRET}&issuer=Bell%20Tax&algorithm=SHA1&digits=6&period=30`;
const CODES = ["abcde-fghij", "klmno-pqrst", "uvwxy-z2345", "67abc-defgh", "ijklm-nopqr", "stuvw-xyz23", "4567a-bcdef", "ghijk-lmnop", "qrstu-vwxyz", "23456-7abcd"];
const PASSKEYS = [
  { id: "k1", name: "iPhone", createdAt: "2026-10-02T17:00:00.000Z", lastUsedAt: "2026-10-17T15:20:00.000Z", synced: true },
  { id: "k2", name: "Mac", createdAt: "2026-10-05T19:00:00.000Z", lastUsedAt: null, synced: true },
];

// ---------- Set up ----------

const created = fn();
const fallback = fn();
export const SetUpPasskey: Story = { name: "Set up a passkey", render: () => <PasskeySetup available onCreate={async () => created()} onFallback={fallback} /> };
export const SetUpPasskeyTest: Story = {
  ...SetUpPasskey,
  name: "Set up a passkey · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Sign in with your face or fingerprint" })).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Set up a passkey" }));
    await expect(created).toHaveBeenCalledOnce();
    await userEvent.click(c.getByRole("button", { name: "My device can't do this" }));
    await expect(fallback).toHaveBeenCalledOnce();
  },
};
export const SetUpPasskeyCancelled: Story = {
  name: "Set up a passkey · cancelled",
  render: () => (
    <PasskeySetup
      available
      onCreate={async () => {
        throw new Error("Cancelled, or your device didn't answer. Try again when you're ready.");
      }}
      onFallback={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Set up a passkey" }));
  },
};
export const SetUpPasskeyReset: Story = { name: "Set up a new passkey (lost one)", render: () => <PasskeySetup purpose="reset" available onCreate={fn()} onFallback={fn()} /> };
export const SetUpPasskeyUnavailable: Story = { name: "Set up · this browser can't", render: () => <PasskeySetup available={false} onCreate={fn()} onFallback={fn()} /> };
export const SetUpPasskeyPreparer: Story = { name: "Set up · preparer, step 1", render: () => <PasskeySetup available step="Step 1 of 3" onCreate={fn()} /> };

const appCode = fn();
export const AuthenticatorApp: Story = { name: "Add an authenticator app", render: () => <AuthenticatorSetup secret={SECRET} uri={URI} step="Step 2 of 2" onSubmit={async (c) => appCode(c)} /> };
export const AuthenticatorAppTest: Story = {
  ...AuthenticatorApp,
  name: "Add an authenticator app · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("img", { name: "QR code for your authenticator app" })).toBeInTheDocument();
    await expect(c.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Finish setting up" }));
    await expect(await c.findByText("Enter the 6-digit code from the app.")).toBeInTheDocument();
    await userEvent.type(c.getByLabelText("6-digit code"), "12a3456");
    await expect(c.getByLabelText("6-digit code")).toHaveValue("123456"); // letters never land
    await userEvent.click(c.getByRole("button", { name: "Finish setting up" }));
    await waitFor(() => expect(appCode).toHaveBeenCalledWith("123456"));
  },
};

// ---------- Signing in ----------

const code = fn();
export const EnterCode: Story = { name: "Sign in · the app's code", render: () => <CodeStep email={EMAIL} onSubmit={async (c) => code(c)} onBack={fn()} /> };
export const EnterCodePreparer: Story = { name: "Sign in · code or recovery code", render: () => <CodeStep email={EMAIL} recoveryCodes onSubmit={async (c) => code(c)} onBack={fn()} /> };
export const EnterCodePreparerTest: Story = {
  ...EnterCodePreparer,
  name: "Sign in · code or recovery code · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "No phone? Use a recovery code" }));
    await expect(c.getByRole("heading", { name: "Use a recovery code" })).toBeInTheDocument();
    await userEvent.type(c.getByLabelText("Recovery code"), "abcde-fghij");
    await userEvent.click(c.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(code).toHaveBeenCalledWith("abcde-fghij"));
  },
};

const lostSent = fn();
export const Lost: Story = { name: "Lost your passkey?", render: () => <LostPasskey onSubmit={async (e) => lostSent(e)} onBack={fn()} /> };
export const LostTest: Story = {
  ...Lost,
  name: "Lost your passkey? · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Email me a link" }));
    await expect(await c.findByText("Enter your email.")).toBeInTheDocument();
    await userEvent.type(c.getByLabelText("Email"), EMAIL);
    await userEvent.click(c.getByRole("button", { name: "Email me a link" }));
    await expect(await c.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    await expect(c.getByText(/removes your old passkeys/)).toBeInTheDocument();
    await expect(lostSent).toHaveBeenCalledWith(EMAIL);
  },
};

// The whole sign-in, against an invented server: "correct horse battery staple" then 123456.
const done = fn();
export const SignInWithMfa: Story = {
  name: "Sign in · passkey or password + code",
  render: () => (
    <SignInSteps
      description="See where your return stands and what's needed from you."
      signIn={async (_email, password, c) => {
        if (password !== "correct horse battery staple") throw new Error("That email and password don't match.");
        if (!c) return { done: false, next: "code", recoveryCodes: false };
        if (c !== "123456") throw new Error("That code didn't work. Check the app and try again.");
        return { done: true };
      }}
      onPasskey={async () => undefined}
      recover={async () => undefined}
      onDone={done}
      onSetup={fn()}
    />
  ),
};
export const SignInWithMfaTest: Story = {
  ...SignInWithMfa,
  name: "Sign in · passkey or password + code · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await step("The passkey comes first", async () => {
      await expect(c.getAllByRole("button")[0]).toHaveAccessibleName("Sign in with a passkey");
    });
    await step("A right password asks for the code; a wrong code says so", async () => {
      await userEvent.type(c.getByLabelText("Email"), EMAIL);
      await userEvent.type(c.getByLabelText("Password"), "correct horse battery staple");
      await userEvent.click(c.getByRole("button", { name: "Continue" }));
      await expect(await c.findByRole("heading", { name: "Enter your code" })).toBeInTheDocument();
      await userEvent.type(c.getByLabelText("6-digit code"), "000000");
      await userEvent.click(c.getByRole("button", { name: "Sign in" }));
      await expect(await c.findByText("That code didn't work. Check the app and try again.")).toBeInTheDocument();
    });
    await step("The right code signs in", async () => {
      await userEvent.clear(c.getByLabelText("6-digit code"));
      await userEvent.type(c.getByLabelText("6-digit code"), "123456");
      await userEvent.click(c.getByRole("button", { name: "Sign in" }));
      await waitFor(() => expect(done).toHaveBeenCalledOnce());
    });
  },
};

// ---------- Setting up from a link ----------

const INFO = { purpose: "invite" as const, email: EMAIL, practiceName: "Bell Tax", preparerName: "Morgan Hale" };
const linkDone = fn();
const finished = fn();
export const ClientLink: Story = {
  name: "Invite link · client",
  render: () => (
    <LinkSetupSteps
      info={{ ...INFO, role: "client" }}
      passkeysSupported
      loadOptions={async () => ({ passkey: { challenge: "x" }, totp: { secret: SECRET, uri: URI } })}
      makePasskey={async () => ({ id: "invented-passkey" })}
      finish={async (s) => {
        finished(s);
        return {};
      }}
      onDone={linkDone}
    />
  ),
};
export const ClientLinkTest: Story = {
  ...ClientLink,
  name: "Invite link · client · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Set up my account" }));
    await userEvent.click(await c.findByRole("button", { name: "Set up a passkey" }));
    await waitFor(() => expect(linkDone).toHaveBeenCalledOnce());
    await expect(finished).toHaveBeenCalledWith({ passkey: { id: "invented-passkey" } }); // nothing else: no password
  },
};

export const PreparerLink: Story = {
  name: "Invite link · preparer",
  render: () => (
    <LinkSetupSteps
      info={{ ...INFO, role: "preparer" }}
      passkeysSupported
      loadOptions={async () => ({ passkey: { challenge: "x" }, totp: { secret: SECRET, uri: URI } })}
      makePasskey={async () => ({ id: "invented-passkey" })}
      finish={async () => ({ recoveryCodes: CODES })}
      onDone={fn()}
    />
  ),
};

export const SaveRecoveryCodes: Story = { name: "Recovery codes", render: () => <RecoveryCodes codes={CODES} onDone={fn()} /> };
export const SaveRecoveryCodesTest: Story = {
  ...SaveRecoveryCodes,
  name: "Recovery codes · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getAllByRole("listitem")).toHaveLength(10);
    const go = c.getByRole("button", { name: "Continue" });
    await expect(go).toBeDisabled();
    await userEvent.click(c.getByRole("checkbox"));
    await expect(go).toBeEnabled();
  },
};

// ---------- Settings ----------

const removed = fn();
export const Passkeys: Story = { name: "Settings · passkeys", render: () => <PasskeyList passkeys={PASSKEYS} onAdd={async () => undefined} onRemove={async (id) => removed(id)} /> };
export const PasskeysTest: Story = {
  ...Passkeys,
  name: "Settings · passkeys · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Remove Mac" }));
    await expect(await screen.findByRole("alertdialog", { name: "Remove this passkey?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removed).toHaveBeenCalledWith("k2"));
  },
};
export const OnePasskey: Story = { name: "Settings · one passkey", render: () => <PasskeyList passkeys={PASSKEYS.slice(0, 1)} onAdd={async () => undefined} onRemove={fn()} /> };
export const NoPasskeys: Story = { name: "Settings · none, can't add here", render: () => <PasskeyList passkeys={[]} canAdd={false} onAdd={async () => undefined} onRemove={fn()} /> };
