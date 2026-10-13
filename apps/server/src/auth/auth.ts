import type { Database } from "bun:sqlite";
import { now, passwordProblem } from "@app/schema";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import type { SessionUser, Surface } from "../identity";

// Sign-in (ticket 05): one-time links that set a password, sessions, and lockout. Tokens are 32 random bytes; only
// their SHA-256 is stored, so the database alone can't sign anyone in. Passwords are argon2id (Bun.password).

export const SESSION_IDLE_MS = 30 * 60_000; // 30 minutes without a request
export const SESSION_MAX_MS = 12 * 3_600_000; // 12 hours however active
export const INVITE_TTL_MS = 7 * 24 * 3_600_000; // an invite works for a week
export const RESET_TTL_MS = 24 * 3_600_000; // a reset for a day
export const LOCK_AFTER = 10; // failures in a row
export const LOCK_MS = 15 * 60_000;
const SEEN_EVERY_MS = 60_000; // write last_seen_at at most once a minute

export const sessionCookie = (surface: Surface) => `btp_session_${surface}`;
export const hashToken = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex");
export const newToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string) => Date.parse(s);
const roleFor = (surface: Surface) => (surface === "admin" ? "preparer" : "client");

type UserRow = { id: string; role: "client" | "preparer"; email: string; person_id: string | null; password_hash: string | null; failed_sign_ins: number; locked_until: string | null; household_id: string | null };
const userBy = (db: Database, where: "id" | "email", value: string) =>
  db
    .query<UserRow, [string]>(
      `SELECT u.id, u.role, u.email, u.person_id, u.password_hash, u.failed_sign_ins, u.locked_until, p.household_id
         FROM users u LEFT JOIN people p ON p.id = u.person_id WHERE ${where === "id" ? "u.id = ?" : "u.email = ? COLLATE NOCASE"}`,
    )
    .get(value);
const asSession = (u: UserRow): SessionUser => ({ id: u.id, role: u.role, personId: u.person_id });

// ---------- Sessions ----------

export function createSession(userId: string, surface: Surface, client: { ip?: string; userAgent?: string } = {}) {
  const { db } = runtime();
  const token = newToken();
  const at = Date.now();
  db.run(
    "INSERT INTO sessions (id, token_hash, user_id, surface, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [Bun.randomUUIDv7(), hashToken(token), userId, surface, iso(at), iso(at), iso(at + SESSION_MAX_MS), client.ip ?? null, client.userAgent?.slice(0, 500) ?? null],
  );
  return token;
}

/** The user a session token belongs to on this surface, or null if it's unknown, revoked, idle too long or past its limit. */
export function userForSession(token: string, surface: Surface, at = Date.now()): SessionUser | null {
  const { db } = runtime();
  const s = db
    .query<{ id: string; user_id: string; last_seen_at: string; expires_at: string; revoked_at: string | null }, [string, string]>(
      "SELECT id, user_id, last_seen_at, expires_at, revoked_at FROM sessions WHERE token_hash = ? AND surface = ?",
    )
    .get(hashToken(token), surface);
  if (!s || s.revoked_at || at >= ms(s.expires_at) || at - ms(s.last_seen_at) >= SESSION_IDLE_MS) return null;
  const u = userBy(db, "id", s.user_id);
  if (!u || u.role !== roleFor(surface)) return null;
  if (at - ms(s.last_seen_at) >= SEEN_EVERY_MS) db.run("UPDATE sessions SET last_seen_at = ? WHERE id = ?", [iso(at), s.id]);
  return asSession(u);
}

export function revokeSession(token: string) {
  runtime().db.run("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", [now(), hashToken(token)]);
}

/** Sign a login out everywhere. Returns how many sessions ended. */
export function revokeAllSessions(userId: string) {
  return runtime().db.run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", [now(), userId]).changes;
}

// ---------- Signing in ----------

export const SIGN_IN_FAILED = "That email and password don't match.";
export const SIGN_IN_LOCKED = "Too many tries. Wait 15 minutes, then try again.";
// Hashed once, used to spend the same time on an unknown email as on a wrong password.
let decoy: Promise<string> | null = null;

export type SignInResult = { ok: true; user: SessionUser; token: string } | { ok: false; message: string; status: 401 | 423 };

export async function signIn(email: string, password: string, surface: Surface, client: { ip?: string; userAgent?: string } = {}): Promise<SignInResult> {
  const { db } = runtime();
  const u = userBy(db, "email", email.trim());
  const usable = u && u.role === roleFor(surface) && u.password_hash;
  if (!usable) {
    // No such login here: do the same work as a real check, then give the same answer.
    decoy ??= Bun.password.hash("decoy-password-for-timing", { algorithm: "argon2id" });
    await Bun.password.verify(password, await decoy).catch(() => false);
    return { ok: false, message: SIGN_IN_FAILED, status: 401 };
  }
  if (u.locked_until && Date.now() < ms(u.locked_until)) return { ok: false, message: SIGN_IN_LOCKED, status: 423 };

  const ok = await Bun.password.verify(password, u.password_hash!).catch(() => false);
  const ev = (type: string, data: Record<string, string | number | boolean | null> = {}) =>
    appendEvent(db, { actor: "system", type, subjectType: "user", subjectId: u.id, householdId: u.household_id, data: { surface, ...data } });
  if (!ok) {
    const failures = u.failed_sign_ins + 1;
    const lock = failures >= LOCK_AFTER;
    db.transaction(() => {
      db.run("UPDATE users SET failed_sign_ins = ?, locked_until = ? WHERE id = ?", [lock ? 0 : failures, lock ? iso(Date.now() + LOCK_MS) : u.locked_until, u.id]);
      ev(lock ? "auth.locked" : "auth.sign_in_failed", { failures });
    })();
    return lock ? { ok: false, message: SIGN_IN_LOCKED, status: 423 } : { ok: false, message: SIGN_IN_FAILED, status: 401 };
  }
  const token = db.transaction(() => {
    db.run("UPDATE users SET failed_sign_ins = 0, locked_until = NULL, last_sign_in_at = ? WHERE id = ?", [now(), u.id]);
    const t = createSession(u.id, surface, client);
    ev("auth.signed_in");
    return t;
  })();
  return { ok: true, user: asSession(u), token };
}

// ---------- Invite and reset links ----------

export function linkFor(userId: string, purpose: "invite" | "reset", createdBy: string | null) {
  const { db, links } = runtime();
  const u = userBy(db, "id", userId);
  if (!u) throw new Error("No such login.");
  const token = newToken();
  const at = Date.now();
  const expiresAt = iso(at + (purpose === "invite" ? INVITE_TTL_MS : RESET_TTL_MS));
  db.transaction(() => {
    // A newer link replaces any older one still waiting.
    db.run("UPDATE invites SET revoked_at = ? WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL", [iso(at), userId]);
    db.run("INSERT INTO invites (id, user_id, purpose, token_hash, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      Bun.randomUUIDv7(),
      userId,
      purpose,
      hashToken(token),
      createdBy,
      iso(at),
      expiresAt,
    ]);
    appendEvent(db, {
      actor: "system",
      type: purpose === "invite" ? "auth.invite_created" : "auth.reset_created",
      subjectType: "user",
      subjectId: userId,
      householdId: u.household_id,
      data: { by: createdBy },
    });
  })();
  const base = (u.role === "preparer" ? links?.admin : links?.portal) ?? "";
  return { url: `${base}/invite/${token}`, expiresAt };
}

type OpenLink = { id: string; user_id: string; purpose: "invite" | "reset"; expires_at: string; used_at: string | null; revoked_at: string | null };
function openLink(token: string): OpenLink | null {
  const l = runtime().db.query<OpenLink, [string]>("SELECT id, user_id, purpose, expires_at, used_at, revoked_at FROM invites WHERE token_hash = ?").get(hashToken(token));
  return l && !l.used_at && !l.revoked_at && Date.now() < ms(l.expires_at) ? l : null;
}

/** What the link page shows before a password is set, or null when the link is unknown, used, withdrawn or expired. */
export function describeLink(token: string, surface: Surface) {
  const { db } = runtime();
  const l = openLink(token);
  if (!l) return null;
  const u = userBy(db, "id", l.user_id)!;
  if (u.role !== roleFor(surface)) return null;
  const first = u.person_id ? db.query<{ first_name: string }, [string]>("SELECT first_name FROM people WHERE id = ?").get(u.person_id)?.first_name ?? null : null;
  const p = db.query<{ practice_name: string; preparer_name: string }, []>("SELECT practice_name, preparer_name FROM practice_settings WHERE id = 1").get()!;
  return { purpose: l.purpose, email: u.email, firstName: first, practiceName: p.practice_name, preparerName: p.preparer_name };
}

export type UseLinkResult = { ok: true; user: SessionUser; token: string } | { ok: false; message: string; status: 400 | 410 };

/** Set the password from a link, sign every other session out, and sign this browser in. */
export async function useLink(token: string, password: string, surface: Surface, client: { ip?: string; userAgent?: string } = {}): Promise<UseLinkResult> {
  const { db } = runtime();
  const l = openLink(token);
  const u = l ? userBy(db, "id", l.user_id) : null;
  if (!l || !u || u.role !== roleFor(surface)) return { ok: false, message: "This link has expired or was already used. Ask for a new one.", status: 410 };
  const problem = passwordProblem(password, u.email);
  if (problem) return { ok: false, message: problem, status: 400 };
  const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
  const session = db.transaction(() => {
    // Claim the link first: a second use of the same link changes nothing.
    if (db.run("UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL", [now(), l.id]).changes !== 1) return null;
    db.run("UPDATE users SET password_hash = ?, activated_at = COALESCE(activated_at, ?), failed_sign_ins = 0, locked_until = NULL, last_sign_in_at = ? WHERE id = ?", [
      hash,
      now(),
      now(),
      u.id,
    ]);
    const ended = revokeAllSessions(u.id);
    appendEvent(db, {
      actor: "system",
      type: l.purpose === "invite" ? "auth.invite_accepted" : "auth.password_reset",
      subjectType: "user",
      subjectId: u.id,
      householdId: u.household_id,
      data: { sessions_ended: ended },
    });
    return createSession(u.id, surface, client);
  })();
  if (!session) return { ok: false, message: "This link has expired or was already used. Ask for a new one.", status: 410 };
  return { ok: true, user: asSession(u), token: session };
}
