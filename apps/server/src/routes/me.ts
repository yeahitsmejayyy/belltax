import { TRPCError } from "@trpc/server";
import { MyAccount, MyContactInput, MyRemindersInput, now, ReminderKind, type ReminderPref } from "@app/schema";
import type { Database } from "bun:sqlite";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import type { SessionUser } from "../identity";
import { authedProcedure, router } from "../trpc";

// The portal's Settings (portal 21-settings): a client's own contact details and reminder choices. Only ever
// their own person and login; the legal name stays with the preparer. Every change is an event on the
// household, so the preparer sees it in Activity and the household page shows the new details.
// Changing the sign-in email has no confirmation step yet: that arrives with real sign-in (ticket 05).

const clientOnly = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "client" || !ctx.user.personId) throw new TRPCError({ code: "FORBIDDEN", message: "Clients only." });
  return next({ ctx: { user: ctx.user as SessionUser & { personId: string } } });
});

const DEFAULT = { email: true, text: false };

type Me = { first_name: string; middle_name: string | null; last_name: string; suffix: string | null; household_id: string | null; email: string; phone: string | null; activated_at: string | null };

function me(db: Database, user: SessionUser & { personId: string }): Me {
  return db
    .query<Me, [string]>(
      `SELECT p.first_name, p.middle_name, p.last_name, p.suffix, p.household_id, u.email, p.phone, u.activated_at
         FROM users u JOIN people p ON p.id = u.person_id WHERE u.id = ?`,
    )
    .get(user.id)!;
}

function reminders(db: Database, userId: string): ReminderPref[] {
  const saved = new Map(
    db
      .query<{ kind: string; by_email: number; by_text: number }, [string]>("SELECT kind, by_email, by_text FROM reminder_preferences WHERE user_id = ?")
      .all(userId)
      .map((r) => [r.kind, { email: !!r.by_email, text: !!r.by_text }]),
  );
  return ReminderKind.options.map((kind) => ({ kind, ...(saved.get(kind) ?? DEFAULT) }));
}

function account(db: Database, user: SessionUser & { personId: string }): MyAccount {
  const m = me(db, user);
  const name = [m.first_name, m.middle_name ? `${m.middle_name[0]}.` : null, m.last_name, m.suffix].filter(Boolean).join(" ");
  return {
    personId: user.personId,
    name,
    email: m.email,
    phone: m.phone,
    reminders: reminders(db, user.id),
    signIn: { method: runtime().mode === "demo" ? "demo" : "password", activatedAt: m.activated_at },
  };
}

export const meRouter = router({
  get: clientOnly.output(MyAccount).query(({ ctx }) => account(runtime().db, ctx.user)),

  updateContact: clientOnly
    .input(MyContactInput)
    .output(MyAccount)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const before = me(db, ctx.user);
      const phone = input.phone ?? null;
      const emailChanged = input.email.toLowerCase() !== before.email.toLowerCase();
      if (emailChanged && db.query("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id <> ?").get(input.email, ctx.user.id)) {
        throw new TRPCError({ code: "CONFLICT", message: "That email is already used by another login." });
      }
      if (!emailChanged && input.email === before.email && phone === before.phone) return account(db, ctx.user);
      db.transaction(() => {
        db.run("UPDATE users SET email = ? WHERE id = ?", [input.email, ctx.user.id]);
        db.run("UPDATE people SET email = ?, phone = ? WHERE id = ?", [input.email, phone, ctx.user.personId]);
        // Ids and which fields changed only: the values themselves stay out of the log (R33).
        appendEvent(db, {
          actor: ctx.user,
          type: "person.contact_updated",
          subjectType: "person",
          subjectId: ctx.user.personId,
          householdId: before.household_id,
          data: { email: emailChanged, phone: phone !== before.phone },
        });
      })();
      return account(db, ctx.user);
    }),

  setReminders: clientOnly
    .input(MyRemindersInput)
    .output(MyAccount)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const m = me(db, ctx.user);
      if (!m.phone && input.reminders.some((r) => r.text)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Add a mobile phone to get reminders by text." });
      }
      const at = now();
      db.transaction(() => {
        for (const r of input.reminders) {
          db.run(
            `INSERT INTO reminder_preferences (user_id, kind, by_email, by_text, updated_at) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (user_id, kind) DO UPDATE SET by_email = excluded.by_email, by_text = excluded.by_text, updated_at = excluded.updated_at`,
            [ctx.user.id, r.kind, r.email ? 1 : 0, r.text ? 1 : 0, at],
          );
        }
        appendEvent(db, { actor: ctx.user, type: "person.reminders_updated", subjectType: "person", subjectId: ctx.user.personId, householdId: m.household_id });
      })();
      return account(db, ctx.user);
    }),
});
