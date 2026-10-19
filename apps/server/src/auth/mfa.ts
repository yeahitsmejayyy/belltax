import type { Database } from "bun:sqlite";
import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { now } from "@app/schema";
import { runtime } from "../db/client";
import type { Surface } from "../identity";
import { base32Encode, matchTotp } from "./totp";

// MFA for everyone (ticket 05b). Passkeys (WebAuthn, via @simplewebauthn/server), authenticator-app codes (totp.ts) and
// the preparer's recovery codes. What each person needs is decided in auth.ts; this file keeps the credentials.

export type RelyingParty = { id: string; origin: string; name: string };
export type NewPasskey = { credentialId: string; publicKey: Uint8Array; counter: number; transports: string[]; backedUp: boolean };

// Who the passkey belongs to: the host the page was served from. localhost in dev, the tunnel's domain live, the Render
// host on the public demo. The Origin header has already passed the cross-site check (fromOurPages). Browsers refuse
// passkeys on a bare IP address, so 127.0.0.1 gets null and the screens say to use localhost.
export function relyingParty(req: Request): RelyingParty | null {
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return null;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return null;
  const name = runtime().db.query<{ practice_name: string }, []>("SELECT practice_name FROM practice_settings WHERE id = 1").get()?.practice_name ?? "Bell Tax";
  return { id: host, origin: new URL(origin).origin, name };
}

// ---------- Challenges ----------
// A WebAuthn challenge (and, during setup, the authenticator secret being confirmed) lives here for a few minutes:
// one process, nothing worth keeping across a restart.

type Pending = { challenge: string; rp: RelyingParty | null; surface: Surface; expires: number; userId?: string; totpSecret?: string };
const pending = new Map<string, Pending>();
const SIGN_IN_MS = 5 * 60_000;
export const SETUP_MS = 15 * 60_000;

function remember(key: string, p: Pending) {
  const t = Date.now();
  for (const [k, v] of pending) if (v.expires <= t) pending.delete(k);
  pending.set(key, p);
}
export function peekPending(key: string) {
  const p = pending.get(key);
  return p && p.expires > Date.now() ? p : null;
}
export function takePending(key: string) {
  const p = peekPending(key);
  pending.delete(key);
  return p;
}
export const clearPending = () => pending.clear();

// ---------- Passkeys ----------

type PasskeyRow = { id: string; user_id: string; credential_id: string; public_key: Uint8Array; counter: number; transports: string | null; rp_id: string };

export const passkeyIdsOf = (db: Database, userId: string) =>
  db.query<{ credential_id: string; transports: string | null }, [string]>("SELECT credential_id, transports FROM passkeys WHERE user_id = ?").all(userId);

/** Options for making a passkey. `key` is where the challenge waits (a link, or a signed-in user adding another). */
export async function registrationOptions(
  key: string,
  user: { id: string; email: string },
  rp: RelyingParty,
  surface: Surface,
  extra: { totpSecret?: string; ttl?: number; exclude?: boolean } = {},
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { db } = runtime();
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: user.email,
    userDisplayName: user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: extra.exclude === false ? [] : passkeyIdsOf(db, user.id).map((p) => ({ id: p.credential_id, transports: p.transports?.split(",") ?? undefined })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    timeout: 120_000,
  });
  remember(key, { challenge: options.challenge, rp, surface, userId: user.id, expires: Date.now() + (extra.ttl ?? SETUP_MS), totpSecret: extra.totpSecret });
  return options;
}

/** Remember a setup that has no passkey part (an authenticator secret only, when passkeys aren't possible here). */
export function rememberSetup(key: string, surface: Surface, userId: string, totpSecret: string) {
  remember(key, { challenge: "", rp: null, surface, userId, totpSecret, expires: Date.now() + SETUP_MS });
}

/** Check a new passkey against its challenge. Null if it doesn't verify. */
export async function verifyNewPasskey(response: RegistrationResponseJSON, p: Pending): Promise<NewPasskey | null> {
  if (!p.rp || !p.challenge) return null;
  try {
    const r = await verifyRegistrationResponse({ response, expectedChallenge: p.challenge, expectedOrigin: p.rp.origin, expectedRPID: p.rp.id, requireUserVerification: true });
    if (!r.verified) return null;
    const c = r.registrationInfo.credential;
    return { credentialId: c.id, publicKey: c.publicKey, counter: c.counter, transports: c.transports ?? [], backedUp: r.registrationInfo.credentialBackedUp };
  } catch {
    return null;
  }
}

// A name a person recognises in Settings, from the browser that made it. Whether it syncs shows as its own badge.
export function deviceName(userAgent: string | undefined) {
  const ua = userAgent ?? "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android phone"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows PC"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux computer"
                : "Passkey";
  return device;
}

export function savePasskey(db: Database, userId: string, k: NewPasskey, rpId: string, name: string) {
  const id = Bun.randomUUIDv7();
  db.run("INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, transports, rp_id, backed_up, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    userId,
    k.credentialId,
    k.publicKey,
    k.counter,
    k.transports.join(",") || null,
    rpId,
    k.backedUp ? 1 : 0,
    name.slice(0, 60),
    now(),
  ]);
  return id;
}

/** Options for signing in with any passkey made for this host (the browser offers the ones it has). */
export async function authenticationOptions(surface: Surface, rp: RelyingParty): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({ rpID: rp.id, userVerification: "required", timeout: 120_000 });
  remember(`sign-in:${options.challenge}`, { challenge: options.challenge, rp, surface, expires: Date.now() + SIGN_IN_MS });
  return options;
}

/** The login a passkey signs in, or null. The challenge is used up either way. */
export async function verifyPasskeySignIn(response: AuthenticationResponseJSON, surface: Surface, rp: RelyingParty): Promise<{ userId: string } | null> {
  const { db } = runtime();
  const row = db.query<PasskeyRow, [string]>("SELECT id, user_id, credential_id, public_key, counter, transports, rp_id FROM passkeys WHERE credential_id = ?").get(response.id ?? "");
  let used: Pending | null = null;
  const expectedChallenge = (c: string) => {
    used = takePending(`sign-in:${c}`);
    return !!used && used.surface === surface && used.rp?.id === rp.id;
  };
  if (!row || row.rp_id !== rp.id) {
    // Still spend the challenge, so it can't be tried again with another credential.
    try {
      const c = JSON.parse(Buffer.from(response.response?.clientDataJSON ?? "", "base64url").toString()).challenge;
      if (typeof c === "string") takePending(`sign-in:${c}`);
    } catch {}
    return null;
  }
  try {
    const r = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      credential: { id: row.credential_id, publicKey: new Uint8Array(row.public_key), counter: row.counter, transports: row.transports?.split(",") },
      requireUserVerification: true,
    });
    if (!r.verified || !used) return null;
    db.run("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?", [r.authenticationInfo.newCounter, now(), row.id]);
    return { userId: row.user_id };
  } catch {
    return null;
  }
}

// ---------- Authenticator app ----------

/** Check a code against the login's authenticator app; a match can't be used again. */
export function checkTotp(db: Database, userId: string, code: string) {
  const t = db.query<{ secret: string; last_step: number }, [string]>("SELECT secret, last_step FROM totp_secrets WHERE user_id = ?").get(userId);
  if (!t) return false;
  const step = matchTotp(t.secret, code, Date.now(), t.last_step);
  if (step === null) return false;
  return db.run("UPDATE totp_secrets SET last_step = ? WHERE user_id = ? AND last_step < ?", [step, userId, step]).changes === 1;
}

export function saveTotp(db: Database, userId: string, secret: string, step: number) {
  db.run("INSERT OR REPLACE INTO totp_secrets (user_id, secret, last_step, created_at) VALUES (?, ?, ?, ?)", [userId, secret, step, now()]);
}

// ---------- Recovery codes (the preparer) ----------

export const RECOVERY_CODES = 10;
const sha256 = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");
const normalise = (code: string) => code.toLowerCase().replace(/[\s-]/g, "");

/** A fresh set, replacing the old one. Returned once, stored hashed. 50 bits each, written xxxxx-xxxxx. */
export function newRecoveryCodes(db: Database, userId: string) {
  const codes = Array.from({ length: RECOVERY_CODES }, () => {
    const s = base32Encode(crypto.getRandomValues(new Uint8Array(7))).slice(0, 10).toLowerCase();
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  db.run("DELETE FROM recovery_codes WHERE user_id = ?", [userId]);
  for (const c of codes) db.run("INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)", [Bun.randomUUIDv7(), userId, sha256(normalise(c)), now()]);
  return codes;
}

export function useRecoveryCode(db: Database, userId: string, code: string) {
  return db.run("UPDATE recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL", [now(), userId, sha256(normalise(code))]).changes === 1;
}

// ---------- What a login has ----------

export function factorsOf(db: Database, userId: string) {
  const one = <T>(sql: string) => db.query<T, [string]>(sql).get(userId)!;
  return {
    passkeys: one<{ n: number }>("SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?").n,
    totp: one<{ n: number }>("SELECT COUNT(*) AS n FROM totp_secrets WHERE user_id = ?").n > 0,
    password: one<{ p: number }>("SELECT password_hash IS NOT NULL AS p FROM users WHERE id = ?").p === 1,
    recoveryCodesLeft: one<{ n: number }>("SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL").n,
  };
}

/** Forget every second factor: a recovery link starts the login over. */
export function clearFactors(db: Database, userId: string) {
  const removed = db.run("DELETE FROM passkeys WHERE user_id = ?", [userId]).changes;
  db.run("DELETE FROM totp_secrets WHERE user_id = ?", [userId]);
  db.run("DELETE FROM recovery_codes WHERE user_id = ?", [userId]);
  return removed;
}
