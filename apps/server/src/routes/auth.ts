import { TRPCError } from "@trpc/server";
import { AuthState, InviteLink, InviteLinkInput, UserRefInput } from "@app/schema";
import { z } from "zod";
import { linkFor, revokeAllSessions } from "../auth/auth";
import { outboxMessages } from "../email/email";
import { emailLink } from "../email/notify";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { preparerProcedure, publicProcedure, router } from "../trpc";

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
