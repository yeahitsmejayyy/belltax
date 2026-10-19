import type { Database } from "bun:sqlite";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { now, passwordProblem } from "@app/schema";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import type { SessionUser, Surface } from "../identity";
import {
  checkTotp,
  clearFactors,
  deviceName,
  factorsOf,
  newRecoveryCodes,
  peekPending,
  registrationOptions,
  rememberSetup,
  type RelyingParty,
  saveTotp,
  savePasskey,
  takePending,
  useRecoveryCode,
  verifyNewPasskey,
} from "./mfa";
import { matchTotp, newTotpSecret, otpauthUri } from "./totp";

// Sign-in (tickets 05, 05b): one-time links, sessions, lockout, and a second factor for everyone. Tokens are 32 random
// bytes; only their SHA-256 is stored, so the database alone can't sign anyone in. Passwords are argon2id.
//
// Who needs what (05b):
//   client    a passkey (enough on its own), or, where the device can't make one, a password + an authenticator app.
//   preparer  a passkey, and a password + an authenticator app, and recovery codes (any one stands in for the app).
// A link (invite, or a reset the preparer sends or the person asks for) is how either is set up; a reset removes the old
// passkeys and app first, so a lost phone stops being a way in.

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

export const CODE_FAILED = "That code didn't work. Check the app and try again.";
export const USE_PASSKEY = "This account signs in with a passkey. Use the passkey button, or “Lost your passkey?”.";

export type SignInResult =
  | { ok: true; user: SessionUser; token: string }
  | { ok: false; message: string; status: 401 | 423 }
  | { ok: false; next: "code"; recoveryCodes: boolean } // the password was right; now the app's code (or a recovery code)
  | { ok: false; next: "setup"; token: string }; // right password, no second factor yet (a login from before 05b): set one up

export async function signIn(
  email: string,
  password: string,
  surface: Surface,
  client: { ip?: string; userAgent?: string } = {},
  code?: string,
): Promise<SignInResult> {
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
  const f = ok ? factorsOf(db, u.id) : null;
  const canCode = !!f && (f.totp || (u.role === "preparer" && f.recoveryCodesLeft > 0));
  if (ok && f && !canCode) {
    // A password alone is never enough. With a passkey, use it; with nothing at all (a login from before 05b), the right
    // password earns a fresh setup link, used straight away.
    if (f.passkeys > 0) return { ok: false, message: USE_PASSKEY, status: 401 };
    ev("auth.setup_required");
    return { ok: false, next: "setup", token: linkFor(u.id, "invite", null).token };
  }
  if (ok && !code) return { ok: false, next: "code", recoveryCodes: u.role === "preparer" };
  const codeOk = ok && !!code && (checkTotp(db, u.id, code) || (u.role === "preparer" && useRecoveryCode(db, u.id, code)));
  if (!codeOk) {
    const failures = u.failed_sign_ins + 1;
    const lock = failures >= LOCK_AFTER;
    db.transaction(() => {
      db.run("UPDATE users SET failed_sign_ins = ?, locked_until = ? WHERE id = ?", [lock ? 0 : failures, lock ? iso(Date.now() + LOCK_MS) : u.locked_until, u.id]);
      ev(lock ? "auth.locked" : ok ? "auth.code_failed" : "auth.sign_in_failed", { failures });
    })();
    return lock ? { ok: false, message: SIGN_IN_LOCKED, status: 423 } : { ok: false, message: ok ? CODE_FAILED : SIGN_IN_FAILED, status: 401 };
  }
  return { ok: true, user: asSession(u), token: startSession(u, surface, client, "password") };
}

function startSession(u: UserRow, surface: Surface, client: { ip?: string; userAgent?: string }, method: "password" | "passkey") {
  const { db } = runtime();
  return db.transaction(() => {
    db.run("UPDATE users SET failed_sign_ins = 0, locked_until = NULL, last_sign_in_at = ? WHERE id = ?", [now(), u.id]);
    const t = createSession(u.id, surface, client);
    appendEvent(db, { actor: "system", type: "auth.signed_in", subjectType: "user", subjectId: u.id, householdId: u.household_id, data: { surface, method } });
    return t;
  })();
}

/** A passkey already checked (mfa.verifyPasskeySignIn): sign in, if it's the right kind of login for this surface. */
export function signInWithPasskey(userId: string, surface: Surface, client: { ip?: string; userAgent?: string } = {}): SignInResult {
  const u = userBy(runtime().db, "id", userId);
  if (!u || u.role !== roleFor(surface)) return { ok: false, message: "That passkey isn't for this sign-in.", status: 401 };
  if (u.locked_until && Date.now() < ms(u.locked_until)) return { ok: false, message: SIGN_IN_LOCKED, status: 423 };
  return { ok: true, user: asSession(u), token: startSession(u, surface, client, "passkey") };
}

/** The login behind an email on this surface, for "Lost your passkey?". Null when there isn't one. */
export function loginForRecovery(email: string, surface: Surface) {
  const u = userBy(runtime().db, "email", email.trim());
  return u && u.role === roleFor(surface) ? u.id : null;
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
  return { url: `${base}/invite/${token}`, expiresAt, token };
}

type OpenLink = { id: string; user_id: string; purpose: "invite" | "reset"; expires_at: string; used_at: string | null; revoked_at: string | null };
export function openLink(token: string): OpenLink | null {
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
  return { purpose: l.purpose, email: u.email, firstName: first, practiceName: p.practice_name, preparerName: p.preparer_name, role: u.role };
}

const LINK_GONE = "This link has expired or was already used. Ask for a new one.";
const linkKey = (token: string) => `link:${hashToken(token)}`;

/**
 * What setting up from a link needs: passkey options (null where this host can't make passkeys) and an authenticator
 * secret with its QR address. Both wait 15 minutes for finishLink; asking again starts over.
 */
export async function linkOptions(token: string, surface: Surface, rp: RelyingParty | null) {
  const { db } = runtime();
  const l = openLink(token);
  const u = l ? userBy(db, "id", l.user_id) : null;
  if (!l || !u || u.role !== roleFor(surface)) return null;
  const secret = newTotpSecret();
  const issuer = rp?.name ?? db.query<{ practice_name: string }, []>("SELECT practice_name FROM practice_settings WHERE id = 1").get()!.practice_name;
  // A reset is about to remove every old passkey, so they don't need excluding.
  const passkey = rp ? await registrationOptions(linkKey(token), u, rp, surface, { totpSecret: secret, exclude: l.purpose !== "reset" }) : null;
  if (!rp) rememberSetup(linkKey(token), surface, u.id, secret);
  return { passkey, totp: { secret, uri: otpauthUri(secret, u.email, issuer) } };
}

export type LinkSetup = { passkey?: RegistrationResponseJSON; password?: string; code?: string };
export type FinishLinkResult =
  | { ok: true; user: SessionUser; token: string; purpose: "invite" | "reset"; recoveryCodes: string[] | null; passkeysRemoved: number }
  | { ok: false; message: string; status: 400 | 410 };

/** Set up sign-in from a link: check every part first, then in one go use the link, save it all and sign this browser in. */
export async function finishLink(token: string, surface: Surface, setup: LinkSetup, client: { ip?: string; userAgent?: string } = {}): Promise<FinishLinkResult> {
  const { db } = runtime();
  const l = openLink(token);
  const u = l ? userBy(db, "id", l.user_id) : null;
  if (!l || !u || u.role !== roleFor(surface)) return { ok: false, message: LINK_GONE, status: 410 };
  const bad = (message: string) => ({ ok: false as const, message, status: 400 as const });
  const p = peekPending(linkKey(token));
  const preparer = u.role === "preparer";
  const appPart = setup.password !== undefined || setup.code !== undefined;

  if (preparer && !(setup.passkey && appPart)) return bad("Set up a passkey, a password and an authenticator app.");
  if (!preparer && !setup.passkey && !appPart) return bad("Set up a passkey, or a password and an authenticator app.");
  if ((setup.passkey || appPart) && (!p || p.userId !== u.id || p.surface !== surface)) return bad("That took too long. Start again.");

  const passkey = setup.passkey ? await verifyNewPasskey(setup.passkey, p!) : null;
  if (setup.passkey && !passkey) return bad("That passkey didn't work. Try again.");

  let app: { secret: string; step: number } | null = null;
  let hash: string | null = null;
  if (appPart) {
    const problem = passwordProblem(setup.password ?? "", u.email);
    if (problem) return bad(problem);
    const step = p!.totpSecret ? matchTotp(p!.totpSecret, setup.code ?? "") : null;
    if (step === null) return bad("That code didn't match. Check the app shows the right account, then try the new code.");
    app = { secret: p!.totpSecret!, step };
    hash = await Bun.password.hash(setup.password!, { algorithm: "argon2id" });
  }

  const done = db.transaction(() => {
    // Claim the link first: a second use of the same link changes nothing.
    if (db.run("UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL", [now(), l.id]).changes !== 1) return null;
    const removed = l.purpose === "reset" ? clearFactors(db, u.id) : 0;
    if (app) {
      db.run("DELETE FROM recovery_codes WHERE user_id = ?", [u.id]);
      saveTotp(db, u.id, app.secret, app.step);
    }
    // A password only counts beside an app. A reset without one leaves none: the passkey is the way in.
    if (hash || l.purpose === "reset") db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, u.id]);
    db.run("UPDATE users SET activated_at = COALESCE(activated_at, ?), failed_sign_ins = 0, locked_until = NULL, last_sign_in_at = ? WHERE id = ?", [now(), now(), u.id]);
    if (passkey) savePasskey(db, u.id, passkey, p!.rp!.id, deviceName(client.userAgent));
    const codes = preparer ? newRecoveryCodes(db, u.id) : null;
    const ended = revokeAllSessions(u.id);
    appendEvent(db, {
      actor: "system",
      type: l.purpose === "invite" ? "auth.invite_accepted" : "auth.sign_in_reset",
      subjectType: "user",
      subjectId: u.id,
      householdId: u.household_id,
      data: { sessions_ended: ended, passkey: !!passkey, authenticator_app: !!app, passkeys_removed: removed },
    });
    return { session: createSession(u.id, surface, client), codes, removed };
  })();
  if (!done) return { ok: false, message: LINK_GONE, status: 410 };
  takePending(linkKey(token));
  return { ok: true, user: asSession(u), token: done.session, purpose: l.purpose, recoveryCodes: done.codes, passkeysRemoved: done.removed };
}
