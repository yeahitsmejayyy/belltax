import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";

// Signing in over REST (tickets 05, 05b), shared by both apps: the server sets and clears an httpOnly session cookie,
// so these are plain fetches, not tRPC. Errors come back as { error } written for the person. `at` maps a path to where
// the app is served (the admin lives under /admin/ on the public demo).

export type AuthResult<T = Record<string, unknown>> = { ok: true; status: number; body: T } | { ok: false; status: number; error: string };
export type LinkInfo = { purpose: "invite" | "reset"; email: string; firstName: string | null; practiceName: string; preparerName: string; role: "client" | "preparer" };
export type LinkOptions = { passkey: Parameters<typeof startRegistration>[0]["optionsJSON"] | null; totp: { secret: string; uri: string } };
export type SignInStep = { done: true } | { done: false; next: "code"; recoveryCodes: boolean } | { done: false; next: "setup"; token: string };

// The browser's own WebAuthn errors, in words.
function passkeyError(err: unknown): Error {
  const name = (err as { name?: string; cause?: { name?: string } })?.cause?.name ?? (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") return new Error("Cancelled, or your device didn't answer. Try again when you're ready.");
  if (name === "InvalidStateError") return new Error("This device already has a passkey for this account.");
  if (name === "SecurityError") return new Error("Passkeys don't work on this address. Open it at localhost or on its real web address.");
  return err instanceof Error ? err : new Error("That didn't work. Try again.");
}

export function makeAuthClient(at: (path: string) => string = (p) => p) {
  async function authPost<T = Record<string, unknown>>(path: string, body: unknown = {}): Promise<AuthResult<T>> {
    const res = await fetch(at(path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" }).catch(() => null);
    if (!res) return { ok: false, status: 0, error: "Can't reach the server. Check your connection and try again." };
    const b = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (res.ok) return { ok: true, status: res.status, body: (b ?? {}) as T };
    return { ok: false, status: res.status, error: b?.error ?? "That didn't work. Try again." };
  }
  const must = async <T>(r: Promise<AuthResult<T>>) => {
    const x = await r;
    if (!x.ok) throw new Error(x.error);
    return x.body;
  };

  return {
    authPost,
    signOut: () => authPost("/api/auth/sign-out"),
    passkeysSupported: () => browserSupportsWebAuthn(),

    async linkInfo(token: string): Promise<LinkInfo | null> {
      const res = await fetch(at(`/api/auth/link/${token}`)).catch(() => null);
      return res?.ok ? ((await res.json()) as LinkInfo) : null;
    },
    linkOptions: (token: string) => must(authPost<LinkOptions>(`/api/auth/link/${token}/options`)),

    /** Make a passkey from registration options. Returns the browser's answer, to send with the rest of the setup. */
    async makePasskey(optionsJSON: NonNullable<LinkOptions["passkey"]>) {
      try {
        return await startRegistration({ optionsJSON });
      } catch (err) {
        throw passkeyError(err);
      }
    },

    /** Finish a link's setup. The preparer gets recovery codes back. */
    finishLink: (token: string, setup: { passkey?: unknown; password?: string; code?: string }) =>
      must(authPost<{ recoveryCodes?: string[] }>(`/api/auth/link/${token}`, setup)),

    /** Email and password, then (once asked) the code. */
    async signIn(email: string, password: string, code?: string): Promise<SignInStep> {
      const body = await must(authPost<{ next?: "code" | "setup"; recoveryCodes?: boolean; token?: string }>("/api/auth/sign-in", { email, password, code }));
      if (body.next === "code") return { done: false, next: "code", recoveryCodes: !!body.recoveryCodes };
      if (body.next === "setup") return { done: false, next: "setup", token: body.token! };
      return { done: true };
    },

    /** Sign in with whichever passkey the browser offers for this site. */
    async signInWithPasskey() {
      const optionsJSON = await must(authPost<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/auth/passkey/options"));
      let response;
      try {
        response = await startAuthentication({ optionsJSON });
      } catch (err) {
        throw passkeyError(err);
      }
      await must(authPost("/api/auth/passkey", { response }));
    },

    /** Add another passkey to the signed-in login (Settings). */
    async addPasskey() {
      const optionsJSON = await must(authPost<NonNullable<LinkOptions["passkey"]>>("/api/auth/passkeys/options"));
      let response;
      try {
        response = await startRegistration({ optionsJSON });
      } catch (err) {
        throw passkeyError(err);
      }
      await must(authPost("/api/auth/passkeys", { response }));
    },

    /** "Lost your passkey?": the server answers the same whether or not the email has an account. */
    recover: (email: string) => must(authPost("/api/auth/recover", { email })).then(() => undefined),
  };
}
