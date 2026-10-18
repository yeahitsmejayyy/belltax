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

export const SignInInput = z.object({ email: z.string().trim().max(254), password: z.string().max(PASSWORD_MAX) });
export const SetPasswordInput = z.object({ password: z.string().max(PASSWORD_MAX) });

// Who is signed in on this surface: enough for the screens, nothing more.
export const AuthUser = z.object({ id: z.string(), role: z.enum(["client", "preparer"]), email: z.string() });
export const AuthState = z.object({ user: AuthUser.nullable(), demo: z.boolean() });

// What an invite or reset link shows before a password is set.
export const InviteInfo = z.object({ purpose: z.enum(["invite", "reset"]), email: z.string(), firstName: z.string().nullable(), practiceName: z.string(), preparerName: z.string() });

// The preparer's link to hand a client (or themselves): shown once, never stored.
export const InviteLinkInput = z.object({ userId: z.string(), purpose: z.enum(["invite", "reset"]) });
export const InviteLink = z.object({ url: z.url(), expiresAt: z.string(), emailed: z.boolean() }); // emailed: the practice sent it (ticket 51)
export const UserRefInput = z.object({ userId: z.string() });
