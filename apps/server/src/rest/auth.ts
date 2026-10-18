import { SetPasswordInput, SignInInput } from "@app/schema";
import { describeLink, revokeSession, SESSION_MAX_MS, sessionCookie, signIn, useLink } from "../auth/auth";
import { runtime } from "../db/client";
import { emailSignInChanged } from "../email/notify";
import type { Surface } from "../identity";

// Sign-in over REST (ticket 05): these set and clear the session cookie, which tRPC's handlers can't do cleanly.
//   POST /api/auth/sign-in        {email, password}   → 204 + cookie | 401 | 423 locked | 429 too many from here
//   POST /api/auth/sign-out                           → 204, cookie cleared, session revoked
//   GET  /api/auth/link/:token                        → what the invite/reset page shows | 410
//   POST /api/auth/link/:token    {password}          → 204 + cookie (signed in) | 400 | 410
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
const signedIn = (surface: Surface, token: string) => new Response(null, { status: 204, headers: { "Set-Cookie": cookieFor(surface, token), "Cache-Control": "no-store" } });

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
    const r = await signIn(input.data.email, input.data.password, surface, client);
    if (!r.ok) {
      miss(client.ip);
      return fail(r.status, r.message);
    }
    return signedIn(surface, r.token);
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
  if (link && req.method === "POST") {
    const input = SetPasswordInput.safeParse(await req.json().catch(() => null));
    if (!input.success) return fail(400, "Create a password.");
    const r = await useLink(link[1]!, input.data.password, surface, clientOf(req, ip));
    if (!r.ok) return fail(r.status, r.message);
    // A reset changed how they sign in: tell the address on file, so an unexpected change gets noticed (ticket 51).
    if (r.purpose === "reset") await emailSignInChanged(r.user.id, "Your password was changed");
    return signedIn(surface, r.token);
  }
  return null;
}
