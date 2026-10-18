import { runtime } from "../db/client";
import { send, type SendResult } from "./email";
import { inviteEmail, resetEmail, signInChangedEmail } from "./templates";

// The practice's sign-in messages (ticket 51), addressed from the login's own details. Sending never blocks the
// action that caused it: a failed send is an event, and the preparer can still copy the link.

function recipient(userId: string) {
  const { db } = runtime();
  const u = db
    .query<{ email: string; first_name: string | null; household_id: string | null }, [string]>(
      "SELECT u.email, p.first_name, p.household_id FROM users u LEFT JOIN people p ON p.id = u.person_id WHERE u.id = ?",
    )
    .get(userId);
  const p = db.query<{ practice_name: string; preparer_name: string }, []>("SELECT practice_name, preparer_name FROM practice_settings WHERE id = 1").get()!;
  return u ? { ...u, practice: { practiceName: p.practice_name, preparerName: p.preparer_name } } : null;
}

export async function emailLink(userId: string, purpose: "invite" | "reset", url: string): Promise<SendResult> {
  const r = recipient(userId);
  if (!r) return { sent: false, error: "No such login." };
  const m = purpose === "invite" ? inviteEmail(r.email, r.first_name, r.practice, url, 7) : resetEmail(r.email, r.first_name, r.practice, url, 24);
  return send(m, { userId, householdId: r.household_id });
}

export async function emailSignInChanged(userId: string, what: string): Promise<SendResult> {
  const r = recipient(userId);
  if (!r) return { sent: false, error: "No such login." };
  return send(signInChangedEmail(r.email, r.first_name, r.practice, what), { userId, householdId: r.household_id });
}
