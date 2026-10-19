import { createHmac } from "node:crypto";

// Time-based one-time passwords (RFC 6238, on HOTP, RFC 4226), hand-rolled so there's nothing to audit but this file.
// 30-second steps, 6 digits, HMAC-SHA1: what every authenticator app expects from an otpauth:// QR code.

export const STEP_SECONDS = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of clean) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("Not base32.");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** HOTP (RFC 4226): the code for one counter value. */
export function hotp(key: Uint8Array, counter: number, digits = 6, algorithm: "sha1" | "sha256" | "sha512" = "sha1"): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algorithm, key).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS);

/** A new shared secret: 20 random bytes (160 bits, RFC 4226's recommendation), as base32. */
export const newTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

/** What the QR code holds. The label shows in the app's list as "Issuer (account)". */
export function otpauthUri(secret: string, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

/**
 * The step a code belongs to, or null. Accepts the current step and one either side (clocks drift), and never a step
 * at or before `after`, so a code that's been used can't be used again.
 */
export function matchTotp(secret: string, code: string, at = Date.now(), after = 0): number | null {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const key = base32Decode(secret);
  const now = stepAt(at);
  for (const step of [now - 1, now, now + 1]) {
    if (step <= after) continue;
    if (timingSafeEqual(hotp(key, step), digits)) return step;
  }
  return null;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
