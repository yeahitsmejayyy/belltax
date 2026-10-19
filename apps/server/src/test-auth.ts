import { base32Decode, hotp, stepAt } from "./auth/totp";

// Test helpers for sign-in (ticket 05b): a software passkey that answers WebAuthn the way a phone would (ES256, "none"
// attestation), and authenticator-app codes. Tests only; nothing here runs in the app.

const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const sha256 = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(b)));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

// Just enough CBOR (RFC 8949) for an attestation object and a COSE key: ints, text, bytes, maps.
type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;
function head(major: number, n: number) {
  if (n < 24) return new Uint8Array([(major << 5) | n]);
  if (n < 256) return new Uint8Array([(major << 5) | 24, n]);
  if (n < 65536) return new Uint8Array([(major << 5) | 25, n >> 8, n & 255]);
  return new Uint8Array([(major << 5) | 26, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}
function cbor(v: Cbor): Uint8Array {
  if (typeof v === "number") return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === "string") {
    const b = new TextEncoder().encode(v);
    return concat(head(3, b.length), b);
  }
  if (v instanceof Uint8Array) return concat(head(2, v.length), v);
  return concat(head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)]));
}

// WebCrypto signs ECDSA as r||s; WebAuthn wants DER.
function der(raw: Uint8Array) {
  const int = (x: Uint8Array) => {
    let i = 0;
    while (i < x.length - 1 && x[i] === 0) i++;
    let v = x.slice(i);
    if (v[0]! & 0x80) v = concat(new Uint8Array([0]), v);
    return concat(new Uint8Array([2, v.length]), v);
  };
  const body = concat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return concat(new Uint8Array([0x30, body.length]), body);
}

export type SoftPasskey = Awaited<ReturnType<typeof softPasskey>>;

/** A passkey on an imaginary phone. `create` answers registration options; `get` answers a sign-in. */
export async function softPasskey(origin: string) {
  const rpId = new URL(origin).hostname;
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const credId = crypto.getRandomValues(new Uint8Array(32));
  let counter = 0;
  let userHandle = "";
  const flags = (attested: boolean) => 0x01 | 0x04 | 0x08 | 0x10 | (attested ? 0x40 : 0); // present, verified, backed up (synced)
  const count = () => new Uint8Array([(counter >>> 24) & 255, (counter >>> 16) & 255, (counter >>> 8) & 255, counter & 255]);

  return {
    id: b64url(credId),
    async create(options: { challenge: string; user: { id: string } }, at = origin) {
      userHandle = options.user.id;
      const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: at, crossOrigin: false }));
      const cose = cbor(new Map<Cbor, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, raw.slice(1, 33)], [-3, raw.slice(33)]]));
      const authData = concat(await sha256(new TextEncoder().encode(rpId)), new Uint8Array([flags(true)]), count(), new Uint8Array(16), new Uint8Array([0, credId.length]), credId, cose);
      const attestation = cbor(new Map<Cbor, Cbor>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]));
      return {
        id: b64url(credId),
        rawId: b64url(credId),
        type: "public-key" as const,
        response: { clientDataJSON: b64url(clientData), attestationObject: b64url(attestation), transports: ["internal", "hybrid"] },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },
    async get(options: { challenge: string }, at = origin) {
      counter++;
      const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin: at, crossOrigin: false }));
      const authData = concat(await sha256(new TextEncoder().encode(rpId)), new Uint8Array([flags(false)]), count());
      const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, concat(authData, await sha256(clientData))));
      return {
        id: b64url(credId),
        rawId: b64url(credId),
        type: "public-key" as const,
        response: { clientDataJSON: b64url(clientData), authenticatorData: b64url(authData), signature: b64url(der(sig)), userHandle },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },
  };
}

/** The authenticator app's code right now (or `steps` away). */
export const appCode = (secret: string, steps = 0, at = Date.now()) => hotp(base32Decode(secret), stepAt(at) + steps);
