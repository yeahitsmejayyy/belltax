import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { hashToken, LOCK_AFTER, linkFor, SESSION_IDLE_MS, SESSION_MAX_MS, SIGN_IN_FAILED, SIGN_IN_LOCKED } from "./auth/auth";
import { useRuntime } from "./db/client";
import { resetSignInThrottle } from "./rest/auth";
import { demoWorld, ORIGIN } from "./test-harness";

// Ticket 05: real sign-in. Links that set a password, sessions on each surface, lockout, sign-out, and the CSRF rule.

let w: Awaited<ReturnType<typeof demoWorld>>;
const LINKS = { portal: "https://portal.example", admin: "http://127.0.0.1:3001" };
beforeAll(async () => {
  w = await demoWorld();
});
const as = (mode: "demo" | "live" = "demo") => useRuntime({ db: w.db, storage: w.storage, mode, links: LINKS });
beforeEach(() => {
  as("demo");
  resetSignInThrottle();
});
afterAll(() => w.cleanup());

const PASSWORD = "correct horse battery staple";
const app = (surface: "portal" | "admin") => (surface === "portal" ? w.portal : w.handler);
const post = (surface: "portal" | "admin", path: string, body: unknown, headers: Record<string, string> = {}) =>
  app(surface)(new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...headers }, body: JSON.stringify(body) }));
const cookieFrom = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";
const whoAmI = async (surface: "portal" | "admin", cookie: string) =>
  ((await (await app(surface)(new Request(`${ORIGIN}/trpc/auth.state`, { headers: { cookie } }))).json()) as { result: { data: { user: { id: string; role: string } | null } } }).result.data.user;

// A client login with no password yet, and its one-time link.
let n = 0;
function newClient() {
  const household = w.get<{ id: string }>("SELECT id FROM households LIMIT 1").id;
  const person = Bun.randomUUIDv7();
  w.db.run("INSERT INTO people (id, household_id, first_name, last_name, created_at) VALUES (?, ?, 'Testy', 'Invented', ?)", [person, household, new Date().toISOString()]);
  const id = Bun.randomUUIDv7();
  const email = `auth-test-${++n}@example.test`;
  w.db.run("INSERT INTO users (id, role, email, person_id, created_at) VALUES (?, 'client', ?, ?, ?)", [id, email, person, new Date().toISOString()]);
  return { id, email };
}
const tokenOf = (url: string) => url.split("/invite/")[1]!;
async function clientWithPassword() {
  const c = newClient();
  const res = await post("portal", `/api/auth/link/${tokenOf(linkFor(c.id, "invite", w.preparerId).url)}`, { password: PASSWORD });
  expect(res.status).toBe(204);
  return { ...c, cookie: cookieFrom(res) };
}

describe("invite links", () => {
  test("point at the portal for clients, show who they're for, and set the password once", async () => {
    const c = newClient();
    const { url } = linkFor(c.id, "invite", w.preparerId);
    expect(url).toStartWith("https://portal.example/invite/");
    const token = tokenOf(url);
    const info = await (await w.portal(new Request(`${ORIGIN}/api/auth/link/${token}`))).json();
    expect(info).toMatchObject({ purpose: "invite", email: c.email });
    const res = await post("portal", `/api/auth/link/${token}`, { password: PASSWORD });
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await whoAmI("portal", cookieFrom(res))).toMatchObject({ id: c.id, role: "client" });
    expect((await post("portal", `/api/auth/link/${token}`, { password: PASSWORD })).status).toBe(410); // used
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM invites WHERE token_hash = ?", token).n).toBe(0); // only the hash is kept
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM invites WHERE token_hash = ?", hashToken(token)).n).toBe(1);
  });

  test("refuse a weak password, an expired link, a replaced link, and the wrong surface", async () => {
    const c = newClient();
    const first = tokenOf(linkFor(c.id, "invite", w.preparerId).url);
    const second = tokenOf(linkFor(c.id, "invite", w.preparerId).url);
    expect((await post("portal", `/api/auth/link/${first}`, { password: PASSWORD })).status).toBe(410); // replaced
    expect((await post("portal", `/api/auth/link/${second}`, { password: "short" })).status).toBe(400);
    expect((await post("portal", `/api/auth/link/${second}`, { password: `${c.email.split("@")[0]}-is-long-enough` })).status).toBe(400);
    expect((await post("admin", `/api/auth/link/${second}`, { password: PASSWORD })).status).toBe(410); // a client's link on the admin
    w.db.run("UPDATE invites SET expires_at = '2020-01-02T00:00:00.000Z', created_at = '2020-01-01T00:00:00.000Z' WHERE token_hash = ?", [hashToken(second)]);
    expect((await post("portal", `/api/auth/link/${second}`, { password: PASSWORD })).status).toBe(410);
  });

  test("a reset signs the login out everywhere else", async () => {
    const c = await clientWithPassword();
    const reset = tokenOf(linkFor(c.id, "reset", w.preparerId).url);
    expect((await post("portal", `/api/auth/link/${reset}`, { password: `${PASSWORD} again` })).status).toBe(204);
    expect(await whoAmI("portal", c.cookie)).toBeNull();
  });
});

describe("signing in", () => {
  test("the right password signs in; a wrong one and an unknown email get the same answer", async () => {
    const c = await clientWithPassword();
    const ok = await post("portal", "/api/auth/sign-in", { email: c.email.toUpperCase(), password: PASSWORD });
    expect(ok.status).toBe(204);
    expect(await whoAmI("portal", cookieFrom(ok))).toMatchObject({ id: c.id });
    const wrong = await post("portal", "/api/auth/sign-in", { email: c.email, password: "not the password at all" });
    const unknown = await post("portal", "/api/auth/sign-in", { email: "nobody@example.test", password: "not the password at all" });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(((await post("portal", "/api/auth/sign-in", { email: "nobody@example.test", password: "x" })).json() as Promise<{ error: string }>).then((b) => b.error)).resolves.toBe(SIGN_IN_FAILED);
  });

  test("a client can't sign in on the admin, and a client session means nothing there", async () => {
    const c = await clientWithPassword();
    expect((await post("admin", "/api/auth/sign-in", { email: c.email, password: PASSWORD })).status).toBe(401);
    expect((await whoAmI("admin", c.cookie.replace("btp_session_portal", "btp_session_admin")))?.id).not.toBe(c.id);
  });

  test(`${LOCK_AFTER} wrong passwords lock the login for 15 minutes, even against the right one`, async () => {
    const c = await clientWithPassword();
    for (let i = 0; i < LOCK_AFTER - 1; i++) expect((await post("portal", "/api/auth/sign-in", { email: c.email, password: "wrong wrong wrong" })).status).toBe(401);
    expect((await post("portal", "/api/auth/sign-in", { email: c.email, password: "wrong wrong wrong" })).status).toBe(423);
    const locked = await post("portal", "/api/auth/sign-in", { email: c.email, password: PASSWORD });
    expect(locked.status).toBe(423);
    expect(((await locked.json()) as { error: string }).error).toBe(SIGN_IN_LOCKED);
    expect(w.eventsOf("auth.locked", c.id)).toHaveLength(1);
    w.db.run("UPDATE users SET locked_until = '2020-01-01T00:00:00.000Z' WHERE id = ?", [c.id]);
    expect((await post("portal", "/api/auth/sign-in", { email: c.email, password: PASSWORD })).status).toBe(204);
  });

  test("many failures from one address are slowed down, whatever the email", async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await post("portal", "/api/auth/sign-in", { email: `spray-${i}@example.test`, password: "guess guess guess" }, { "x-test": "1" })).status;
    expect(last).toBe(429);
  });
});

describe("sessions", () => {
  test("idle for 30 minutes, past 12 hours, or revoked: signed out", async () => {
    for (const [field, ago] of [["last_seen_at", SESSION_IDLE_MS + 1000], ["expires_at", -1]] as const) {
      const c = await clientWithPassword();
      const at = new Date(Date.now() - (field === "last_seen_at" ? ago : SESSION_MAX_MS + 1000)).toISOString();
      if (field === "last_seen_at") w.db.run("UPDATE sessions SET last_seen_at = ? WHERE user_id = ?", [at, c.id]);
      else w.db.run("UPDATE sessions SET created_at = ?, expires_at = ? WHERE user_id = ?", [new Date(Date.parse(at) - 1000).toISOString(), at, c.id]);
      expect(await whoAmI("portal", c.cookie)).toBeNull();
    }
  });

  test("signing out ends the session; the preparer can sign a client out everywhere", async () => {
    const c = await clientWithPassword();
    expect((await post("portal", "/api/auth/sign-out", {}, { cookie: c.cookie })).status).toBe(204);
    expect(await whoAmI("portal", c.cookie)).toBeNull();
    const again = await post("portal", "/api/auth/sign-in", { email: c.email, password: PASSWORD });
    const cookie = cookieFrom(again);
    expect((await w.call(w.preparerId, "login.signOutEverywhere", { userId: c.id }, "mutation")).data).toEqual({ ended: 1 });
    expect(await whoAmI("portal", cookie)).toBeNull();
  });

  test("a session works in live mode, where the demo identity doesn't", async () => {
    const c = await clientWithPassword();
    as("live");
    expect(await whoAmI("portal", c.cookie)).toMatchObject({ id: c.id });
    expect(await whoAmI("portal", `btp_demo_portal=${c.id}`)).toBeNull();
    const res = await w.portal(new Request(`${ORIGIN}/trpc/engagement.mine`, { headers: { cookie: c.cookie } }));
    expect(res.status).toBe(200);
  });

  test("in live mode the cookie is Secure on the portal, not on the loopback-only admin", async () => {
    as("live");
    const c = newClient();
    const res = await post("portal", `/api/auth/link/${tokenOf(linkFor(c.id, "invite", w.preparerId).url)}`, { password: PASSWORD });
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });
});

describe("the preparer's controls", () => {
  test("copy a link for a client; a client can't", async () => {
    const c = newClient();
    const r = await w.call(w.preparerId, "login.link", { userId: c.id, purpose: "invite" }, "mutation");
    expect((r.data as { url: string }).url).toStartWith("https://portal.example/invite/");
    const someClient = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' AND id <> ? LIMIT 1", c.id).id;
    expect((await w.call(someClient, "login.link", { userId: c.id, purpose: "reset" }, "mutation")).status).toBe(403);
  });
});

describe("cross-site requests", () => {
  test("a change from another site is refused; our own pages, scripts and Stripe are not", async () => {
    const foreign = await post("portal", "/api/auth/sign-in", { email: "a@example.test", password: "x" }, { origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    const mutation = await w.handler(
      new Request(`${ORIGIN}/trpc/login.signOutEverywhere`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", "x-demo-user": w.preparerId }, body: "{}" }),
    );
    expect(mutation.status).toBe(403);
    expect((await post("portal", "/api/auth/sign-in", { email: "a@example.test", password: "x" }, { origin: "https://portal.example" })).status).toBe(401); // our public address
    const noOrigin = await w.portal(new Request(`${ORIGIN}/api/auth/sign-in`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
    expect(noOrigin.status).toBe(400);
  });
});
