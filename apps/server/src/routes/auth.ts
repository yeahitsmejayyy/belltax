import { TRPCError } from "@trpc/server";
import { AuthState, InviteLink, InviteLinkInput, PasskeyRefInput, SignInMethods, UserRefInput } from "@app/schema";
import { z } from "zod";
import { linkFor, revokeAllSessions } from "../auth/auth";
import { factorsOf, newRecoveryCodes } from "../auth/mfa";
import { outboxMessages } from "../email/email";
import { emailLink } from "../email/notify";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { emailSignInChanged } from "../email/notify";
import { authedProcedure, preparerProcedure, publicProcedure, router } from "../trpc";

// Sign-in state and the preparer's controls over other logins (ticket 05). Signing in and out themselves are REST
// (rest/auth.ts), because they set cookies.
export const authRouter = router({
  // Who's signed in on this surface, if anyone. The screens use it to decide between the app and the sign-in page.
  state: publicProcedure.output(AuthState).query(({ ctx }) => {
    const { db, mode } = runtime();
    const email = ctx.user ? db.query<{ email: string }, [string]>("SELECT email FROM users WHERE id = ?").get(ctx.user.id)?.email ?? "" : "";
    return { user: ctx.user ? { id: ctx.user.id, role: ctx.user.role, email } : null, demo: mode === "demo" };
  }),
});

const loginOf = (userId: string) => {
  const u = runtime()
    .db.query<{ id: string; role: string; household_id: string | null }, [string]>("SELECT u.id, u.role, p.household_id FROM users u LEFT JOIN people p ON p.id = u.person_id WHERE u.id = ?")
    .get(userId);
  if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Login not found." });
  return u;
};

export const loginLinkRouter = router({
  // A one-time link that sets the password: hand it to the client yourself. Shown once; a newer one replaces it.
  link: preparerProcedure
    .input(InviteLinkInput)
    .output(InviteLink)
    .mutation(async ({ ctx, input }) => {
      loginOf(input.userId);
      const link = linkFor(input.userId, input.purpose, ctx.user.id);
      const sent = await emailLink(input.userId, input.purpose, link.url);
      return { ...link, emailed: sent.sent };
    }),

  // Sign a login out of every browser, now.
  signOutEverywhere: preparerProcedure
    .input(UserRefInput)
    .output(z.object({ ended: z.int() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const u = loginOf(input.userId);
      const ended = db.transaction(() => {
        const n = revokeAllSessions(u.id);
        appendEvent(db, { actor: ctx.user, type: "auth.signed_out_everywhere", subjectType: "user", subjectId: u.id, householdId: u.household_id, data: { sessions_ended: n } });
        return n;
      })();
      return { ended };
    }),
});

// The outbox (ticket 51): what the practice would have emailed, in dev and the demos, where nothing is sent. Live mode
// with Resend has no outbox; there, mail really goes and the path doesn't exist.
const OutboxEntry = z.object({ id: z.string(), at: z.string(), to: z.string(), from: z.string(), subject: z.string(), text: z.string(), html: z.string(), template: z.string() });
export const emailRouter = router({
  outbox: preparerProcedure.output(z.array(OutboxEntry)).query(({ path }) => {
    if (runtime().email?.driver === "resend") throw new TRPCError({ code: "NOT_FOUND", message: `No procedure found on path "${path}"` });
    return [...outboxMessages()];
  }),
});

// How you sign in (ticket 05b), for Settings in both apps: your own login only. Adding a passkey is REST
// (rest/auth.ts), because the browser's prompt needs a challenge from the server first.
export const mfaRouter = router({
  methods: authedProcedure.output(SignInMethods).query(({ ctx }) => {
    const { db } = runtime();
    const f = factorsOf(db, ctx.user.id);
    const passkeys = db
      .query<{ id: string; name: string; created_at: string; last_used_at: string | null; backed_up: number }, [string]>(
        "SELECT id, name, created_at, last_used_at, backed_up FROM passkeys WHERE user_id = ? ORDER BY created_at",
      )
      .all(ctx.user.id)
      .map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at, lastUsedAt: p.last_used_at, synced: p.backed_up === 1 }));
    return { passkeys, authenticatorApp: f.totp, password: f.password, recoveryCodesLeft: ctx.user.role === "preparer" ? f.recoveryCodesLeft : null };
  }),

  // Remove a passkey, unless it's the last way in: a client keeps a passkey or a password + app; the preparer keeps a passkey.
  removePasskey: authedProcedure
    .input(PasskeyRefInput)
    .output(z.object({ removed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = runtime();
      const k = db.query<{ id: string; name: string }, [string, string]>("SELECT id, name FROM passkeys WHERE id = ? AND user_id = ?").get(input.passkeyId, ctx.user.id);
      if (!k) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey not found." });
      const f = factorsOf(db, ctx.user.id);
      const left = f.passkeys - 1;
      if (left === 0 && (ctx.user.role === "preparer" || !(f.password && f.totp)))
        throw new TRPCError({ code: "BAD_REQUEST", message: "This is your only passkey. Add another before removing it, so you can still sign in." });
      const u = loginOf(ctx.user.id);
      db.transaction(() => {
        db.run("DELETE FROM passkeys WHERE id = ?", [k.id]);
        appendEvent(db, { actor: ctx.user, type: "auth.passkey_removed", subjectType: "user", subjectId: u.id, householdId: u.household_id, data: { passkey: k.id, name: k.name } });
      })();
      await emailSignInChanged(ctx.user.id, `A passkey (${k.name}) was removed`);
      return { removed: true };
    }),

  // A new set of recovery codes, shown once; the old set stops working.
  newRecoveryCodes: preparerProcedure.output(z.object({ codes: z.array(z.string()) })).mutation(async ({ ctx }) => {
    const { db } = runtime();
    const codes = db.transaction(() => {
      const c = newRecoveryCodes(db, ctx.user.id);
      appendEvent(db, { actor: ctx.user, type: "auth.recovery_codes_replaced", subjectType: "user", subjectId: ctx.user.id, householdId: null, data: {} });
      return c;
    })();
    await emailSignInChanged(ctx.user.id, "New recovery codes were made");
    return { codes };
  }),
});
