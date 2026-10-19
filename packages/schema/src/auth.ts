import { z } from "zod";

// Sign-in (ticket 05). Shared by the server, which enforces it, and the screens, which explain it.
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 200;

/** Why a password won't do, or null. The same rules the set-password form shows as you type. */
export function passwordProblem(password: string, email: string): string | null {
  if (!password) return "Create a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (lower.includes(email.toLowerCase()) || (local.length >= 3 && lower.includes(local))) return "Don't use your email address in your password.";
  return null;
}

export const SignInInput = z.object({ email: z.string().trim().max(254), password: z.string().max(PASSWORD_MAX), code: z.string().trim().max(20).optional() });
export const SetPasswordInput = z.object({ password: z.string().max(PASSWORD_MAX) });

// Who is signed in on this surface: enough for the screens, nothing more.
export const AuthUser = z.object({ id: z.string(), role: z.enum(["client", "preparer"]), email: z.string() });
export const AuthState = z.object({ user: AuthUser.nullable(), demo: z.boolean() });

// What an invite or reset link shows before sign-in is set up.
export const InviteInfo = z.object({
  purpose: z.enum(["invite", "reset"]),
  email: z.string(),
  firstName: z.string().nullable(),
  practiceName: z.string(),
  preparerName: z.string(),
  role: z.enum(["client", "preparer"]),
});

// MFA (ticket 05b). A browser's passkey answer is checked by @simplewebauthn/server; here only its outline and size.
const WebAuthnJSON = z.looseObject({
  id: z.string().min(16).max(1400),
  rawId: z.string().max(1400),
  type: z.literal("public-key"),
  response: z.looseObject({ clientDataJSON: z.string().max(20_000) }),
});
export const PasskeyResponseInput = z.object({ response: WebAuthnJSON });
export const LinkSetupInput = z.object({ passkey: WebAuthnJSON.optional(), password: z.string().max(PASSWORD_MAX).optional(), code: z.string().trim().max(20).optional() });
export const RecoverInput = z.object({ email: z.string().trim().max(254) });

// Settings: how this login signs in. Never a secret, never a credential id.
export const PasskeyView = z.object({ id: z.string(), name: z.string(), createdAt: z.string(), lastUsedAt: z.string().nullable(), synced: z.boolean() });
export const SignInMethods = z.object({
  passkeys: z.array(PasskeyView),
  authenticatorApp: z.boolean(),
  password: z.boolean(),
  recoveryCodesLeft: z.int().nullable(), // the preparer only
});
export const PasskeyRefInput = z.object({ passkeyId: z.string() });

// The preparer's link to hand a client (or themselves): shown once, never stored.
export const InviteLinkInput = z.object({ userId: z.string(), purpose: z.enum(["invite", "reset"]) });
export const InviteLink = z.object({ url: z.url(), expiresAt: z.string(), emailed: z.boolean() }); // emailed: the practice sent it (ticket 51)
export const UserRefInput = z.object({ userId: z.string() });
