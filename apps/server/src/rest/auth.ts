import { LinkSetupInput, PasskeyResponseInput, RecoverInput, SignInInput } from "@app/schema";
import { describeLink, finishLink, linkFor, linkOptions, loginForRecovery, revokeSession, SESSION_MAX_MS, sessionCookie, signIn, signInWithPasskey } from "../auth/auth";
import { authenticationOptions, deviceName, registrationOptions, relyingParty, savePasskey, takePending, verifyNewPasskey, verifyPasskeySignIn } from "../auth/mfa";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { emailLink, emailSignInChanged } from "../email/notify";
import { resolveUser, type Surface } from "../identity";

// Sign-in over REST (tickets 05, 05b): these set and clear the session cookie, which tRPC's handlers can't do cleanly.
//   POST /api/auth/sign-in            {email, password, code?} → 204 + cookie | 202 {next:"code"|"setup"} | 401 | 423 | 429
//   POST /api/auth/passkey/options                             → options for the browser's passkey prompt | 400 no passkeys here
//   POST /api/auth/passkey            {response}               → 204 + cookie | 401
//   POST /api/auth/recover            {email}                  → 202, always ("Lost your passkey?": emails a reset link)
//   POST /api/auth/sign-out                                    → 204, cookie cleared, session revoked
//   GET  /api/auth/link/:token                                 → what the invite/reset page shows | 410
//   POST /api/auth/link/:token/options                         → passkey options + an authenticator secret | 410
//   POST /api/auth/link/:token        {passkey?, password?, code?} → 204 + cookie | 200 {recoveryCodes} (preparer) | 400 | 410
//   POST /api/auth/passkeys/options   (signed in)              → options to add another passkey
//   POST /api/auth/passkeys           {response} (signed in)   → 204, added
// A client signs in on the portal, the preparer on the admin; the wrong one gets the same answer as a wrong password.

const json = (status: number, body: unknown) => Response.json(body, { status });
const fail = (status: number, message: string) => json(status, { error: message });

// The cookie: unreadable by scripts, not sent cross-site, and HTTPS-only where the portal faces the internet. The admin
// is this machine (http://127.0.0.1), where Safari won't keep a Secure cookie, and it's never reachable from outside.
function cookieFor(surface: Surface, token: string | null) {
  const secure = runtime().mode === "live" && surface === "portal" ? "; Secure" : "";
  return token
    ? `${sessionCookie(surface)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_MS / 1000}${secure}`
    : `${sessionCookie(surface)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
const signedIn = (surface: Surface, token: string, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status: body === undefined ? 204 : 200,
    headers: { "Set-Cookie": cookieFor(surface, token), "Cache-Control": "no-store", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
  });
const NO_PASSKEYS_HERE = "Passkeys don't work on an address like 127.0.0.1. Open this page at localhost instead.";

// Many wrong passwords from one address, across any number of emails: slow it down (per process, 15 minutes).
const WINDOW_MS = 15 * 60_000;
const PER_ADDRESS = 30;
const misses = new Map<string, { n: number; until: number }>();
export function resetSignInThrottle() {
  misses.clear();
}
function throttled(ip: string) {
  const m = misses.get(ip);
  return !!m && Date.now() < m.until && m.n >= PER_ADDRESS;
}
function miss(ip: string) {
  const m = misses.get(ip);
  if (!m || Date.now() >= m.until) misses.set(ip, { n: 1, until: Date.now() + WINDOW_MS });
  else m.n++;
}

const clientOf = (req: Request, ip?: string) => ({ ip: ip ?? "unknown", userAgent: req.headers.get("user-agent") ?? undefined });

export async function authRoute(req: Request, surface: Surface, pathname: string, ip?: string): Promise<Response | null> {
  if (pathname === "/api/auth/sign-in" && req.method === "POST") {
    const client = clientOf(req, ip);
    if (throttled(client.ip)) return fail(429, "Too many tries from here. Wait 15 minutes, then try again.");
    const input = SignInInput.safeParse(await req.json().catch(() => null));
    if (!input.success) return fail(400, "Enter your email and password.");
    const r = await signIn(input.data.email, input.data.password, surface, client, input.data.code || undefined);
    if (r.ok) return signedIn(surface, r.token);
    if ("next" in r) return json(202, r.next === "code" ? { next: "code", recoveryCodes: r.recoveryCodes } : { next: "setup", token: r.token });
    miss(client.ip);
    return fail(r.status, r.message);
  }

  if (pathname === "/api/auth/passkey/options" && req.method === "POST") {
    const rp = relyingParty(req);
    if (!rp) return fail(400, NO_PASSKEYS_HERE);
    return json(200, await authenticationOptions(surface, rp));
  }

  if (pathname === "/api/auth/passkey" && req.method === "POST") {
    const client = clientOf(req, ip);
    if (throttled(client.ip)) return fail(429, "Too many tries from here. Wait 15 minutes, then try again.");
    const rp = relyingParty(req);
    const input = PasskeyResponseInput.safeParse(await req.json().catch(() => null));
    const found = rp && input.success ? await verifyPasskeySignIn(input.data.response as never, surface, rp) : null;
    const r = found ? signInWithPasskey(found.userId, surface, client) : null;
    if (r?.ok) return signedIn(surface, r.token);
    miss(client.ip);
    return fail(r && "status" in r ? r.status : 401, r && "message" in r ? r.message : "That passkey isn't set up for this sign-in. Try your password, or “Lost your passkey?”.");
  }

  // Self-serve recovery: a reset link to the address on file. The answer never says whether the email has an account.
  if (pathname === "/api/auth/recover" && req.method === "POST") {
    const client = clientOf(req, ip);
    if (throttled(client.ip)) return fail(429, "Too many tries from here. Wait 15 minutes, then try again.");
    miss(client.ip); // every request counts: this sends email
    const input = RecoverInput.safeParse(await req.json().catch(() => null));
    if (!input.success) return fail(400, "Enter your email.");
    const userId = loginForRecovery(input.data.email, surface);
    if (userId) {
      const link = linkFor(userId, "reset", null);
      await emailLink(userId, "reset", link.url);
    }
    return json(202, { sent: true });
  }

  if (pathname === "/api/auth/sign-out" && req.method === "POST") {
    const raw = req.headers.get("cookie")?.split(";").map((c) => c.trim().split("=")).find(([k]) => k === sessionCookie(surface))?.[1];
    if (raw) revokeSession(decodeURIComponent(raw));
    return new Response(null, { status: 204, headers: { "Set-Cookie": cookieFor(surface, null) } });
  }

  const link = pathname.match(/^\/api\/auth\/link\/([A-Za-z0-9_-]{20,100})$/);
  if (link && req.method === "GET") {
    const info = describeLink(link[1]!, surface);
    return info ? json(200, info) : fail(410, "This link has expired or was already used. Ask for a new one.");
  }
  const linkOpts = pathname.match(/^\/api\/auth\/link\/([A-Za-z0-9_-]{20,100})\/options$/);
  if (linkOpts && req.method === "POST") {
    const options = await linkOptions(linkOpts[1]!, surface, relyingParty(req));
    return options ? json(200, options) : fail(410, "This link has expired or was already used. Ask for a new one.");
  }
  if (link && req.method === "POST") {
    const input = LinkSetupInput.safeParse(await req.json().catch(() => null));
    if (!input.success) return fail(400, "Set up a passkey, or a password and an authenticator app.");
    const r = await finishLink(link[1]!, surface, input.data as never, clientOf(req, ip));
    if (!r.ok) return fail(r.status, r.message);
    // A reset changed how they sign in: tell the address on file, so an unexpected change gets noticed (ticket 51).
    if (r.purpose === "reset") await emailSignInChanged(r.user.id, r.passkeysRemoved ? "Your sign-in was set up again and your old passkeys were removed" : "Your sign-in was set up again");
    return signedIn(surface, r.token, r.recoveryCodes ? { recoveryCodes: r.recoveryCodes } : undefined);
  }

  // Adding another passkey, signed in (Settings). The challenge waits under the login's id.
  if (pathname === "/api/auth/passkeys/options" && req.method === "POST") {
    const user = resolveUser(req, surface);
    if (!user) return fail(401, "Sign in first.");
    const rp = relyingParty(req);
    if (!rp) return fail(400, NO_PASSKEYS_HERE);
    const email = runtime().db.query<{ email: string }, [string]>("SELECT email FROM users WHERE id = ?").get(user.id)!.email;
    return json(200, await registrationOptions(`add:${user.id}`, { id: user.id, email }, rp, surface, { ttl: 5 * 60_000 }));
  }
  if (pathname === "/api/auth/passkeys" && req.method === "POST") {
    const user = resolveUser(req, surface);
    if (!user) return fail(401, "Sign in first.");
    const input = PasskeyResponseInput.safeParse(await req.json().catch(() => null));
    const p = takePending(`add:${user.id}`);
    if (!input.success || !p || p.surface !== surface) return fail(400, "That took too long. Try again.");
    const k = await verifyNewPasskey(input.data.response as never, p);
    if (!k) return fail(400, "That passkey didn't work. Try again.");
    const { db } = runtime();
    const household = db.query<{ household_id: string | null }, [string]>("SELECT p.household_id FROM users u LEFT JOIN people p ON p.id = u.person_id WHERE u.id = ?").get(user.id)?.household_id ?? null;
    const name = deviceName(req.headers.get("user-agent") ?? undefined);
    db.transaction(() => {
      const id = savePasskey(db, user.id, k, p.rp!.id, name);
      appendEvent(db, { actor: user, type: "auth.passkey_added", subjectType: "user", subjectId: user.id, householdId: household, data: { passkey: id, name } });
    })();
    await emailSignInChanged(user.id, `A passkey (${name}) was added`);
    return new Response(null, { status: 204 });
  }
  return null;
}
