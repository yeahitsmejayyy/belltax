import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { linkFor } from "./auth/auth";
import { clearPending, RECOVERY_CODES } from "./auth/mfa";
import { useRuntime } from "./db/client";
import { clearOutbox, outboxMessages } from "./email/email";
import { resetSignInThrottle } from "./rest/auth";
import { appCode, softPasskey } from "./test-auth";
import { demoWorld } from "./test-harness";

// Ticket 05b: MFA for everyone. Passkeys first (a software authenticator stands in for the phone), an authenticator app
// as the fallback, the preparer's recovery codes, and self-serve recovery by email.

const HERE = "http://localhost:5175"; // passkeys need a host name; 127.0.0.1 can't have them
let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => {
  useRuntime({ db: w.db, storage: w.storage, mode: "demo", links: { portal: HERE, admin: "http://localhost:5174" } });
  resetSignInThrottle();
  clearPending();
  clearOutbox();
});
afterAll(() => w.cleanup());

type Surface = "portal" | "admin";
const app = (s: Surface) => (s === "portal" ? w.portal : w.handler);
const originOf = (s: Surface) => (s === "portal" ? HERE : "http://localhost:5174");
const post = (s: Surface, path: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  app(s)(new Request(`${originOf(s)}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: originOf(s), ...headers }, body: JSON.stringify(body) }));
const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;
const cookieFrom = (r: Response) => r.headers.get("set-cookie")?.split(";")[0] ?? "";
const trpc = async (s: Surface, cookie: string, path: string, input?: unknown, kind: "query" | "mutation" = "query") => {
  const url = `${originOf(s)}/trpc/${path}`;
  const res = await app(s)(
    kind === "query"
      ? new Request(input === undefined ? url : `${url}?input=${encodeURIComponent(JSON.stringify(input))}`, { headers: { cookie } })
      : new Request(url, { method: "POST", headers: { cookie, "content-type": "application/json", origin: originOf(s) }, body: JSON.stringify(input ?? {}) }),
  );
  const b = (await res.json()) as { result?: { data: unknown }; error?: { message: string; data?: { code: string } } };
  return { status: res.status, data: b.result?.data, error: b.error };
};
const whoAmI = async (s: Surface, cookie: string) => ((await trpc(s, cookie, "auth.state")).data as { user: { id: string } | null }).user;

let n = 0;
function newLogin(role: "client" | "preparer" = "client") {
  const id = Bun.randomUUIDv7();
  const email = `mfa-test-${++n}@example.test`;
  let person: string | null = null;
  if (role === "client") {
    person = Bun.randomUUIDv7();
    const household = w.get<{ id: string }>("SELECT id FROM households LIMIT 1").id;
    w.db.run("INSERT INTO people (id, household_id, first_name, last_name, created_at) VALUES (?, ?, 'Pat', 'Invented', ?)", [person, household, new Date().toISOString()]);
  }
  w.db.run("INSERT INTO users (id, role, email, person_id, created_at) VALUES (?, ?, ?, ?, ?)", [id, role, email, person, new Date().toISOString()]);
  return { id, email };
}
const tokenOf = (url: string) => url.split("/invite/")[1]!;
type Options = { passkey: { challenge: string; user: { id: string }; rp: { id: string } } | null; totp: { secret: string; uri: string } };

/** A client who set up with a passkey from their invite. */
async function clientWithPasskey() {
  const c = newLogin();
  const token = tokenOf(linkFor(c.id, "invite", w.preparerId).url);
  const opts = await json<Options>(post("portal", `/api/auth/link/${token}/options`));
  const key = await softPasskey(HERE);
  const res = await post("portal", `/api/auth/link/${token}`, { passkey: await key.create(opts.passkey!) }, { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" });
  expect(res.status).toBe(204);
  return { ...c, key, cookie: cookieFrom(res) };
}
async function signInWithPasskey(s: Surface, key: Awaited<ReturnType<typeof softPasskey>>) {
  const opts = await json<{ challenge: string }>(post(s, "/api/auth/passkey/options"));
  return post(s, "/api/auth/passkey", { response: await key.get(opts) });
}

describe("a client's invite", () => {
  test("sets up a passkey and nothing else: no password, signed in, the passkey named for the phone", async () => {
    const c = await clientWithPasskey();
    expect(await whoAmI("portal", c.cookie)).toMatchObject({ id: c.id });
    expect(w.get<{ p: string | null }>("SELECT password_hash AS p FROM users WHERE id = ?", c.id).p).toBeNull();
    const k = w.get<{ name: string; rp_id: string; backed_up: number }>("SELECT name, rp_id, backed_up FROM passkeys WHERE user_id = ?", c.id);
    expect(k).toEqual({ name: "iPhone", rp_id: "localhost", backed_up: 1 });
    expect(JSON.parse(w.eventsOf("auth.invite_accepted", c.id)[0]!.data)).toMatchObject({ passkey: true, authenticator_app: false });
  });

  test("offers the passkey for this host, and an authenticator app as the fallback", async () => {
    const c = newLogin();
    const token = tokenOf(linkFor(c.id, "invite", w.preparerId).url);
    const opts = await json<Options & { passkey: { authenticatorSelection: { userVerification: string; residentKey: string } } }>(post("portal", `/api/auth/link/${token}/options`));
    expect(opts.passkey!.rp.id).toBe("localhost");
    expect(opts.passkey!.authenticatorSelection).toMatchObject({ userVerification: "required", residentKey: "required" });
    expect(opts.totp.uri).toStartWith(`otpauth://totp/Bell%20Tax%3A${encodeURIComponent(c.email)}?secret=${opts.totp.secret}`);
  });

  test("on 127.0.0.1, where browsers refuse passkeys, offers only the app", async () => {
    const c = newLogin();
    const token = tokenOf(linkFor(c.id, "invite", w.preparerId).url);
    const at = "http://127.0.0.1:3000";
    const opts = await json<Options>(w.portal(new Request(`${at}/api/auth/link/${token}/options`, { method: "POST", headers: { origin: at } })));
    expect(opts.passkey).toBeNull();
    expect(opts.totp.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect((await w.portal(new Request(`${at}/api/auth/passkey/options`, { method: "POST", headers: { origin: at } }))).status).toBe(400);
  });

  test("refuses a passkey made for another site, or answering someone else's challenge", async () => {
    const c = newLogin();
    const token = tokenOf(linkFor(c.id, "invite", w.preparerId).url);
    const opts = await json<Options>(post("portal", `/api/auth/link/${token}/options`));
    const elsewhere = await softPasskey("https://evil.example");
    expect((await post("portal", `/api/auth/link/${token}`, { passkey: await elsewhere.create(opts.passkey!) })).status).toBe(400);
    const key = await softPasskey(HERE);
    expect((await post("portal", `/api/auth/link/${token}`, { passkey: await key.create({ ...opts.passkey!, challenge: "bm90LXRoZS1jaGFsbGVuZ2U" }) })).status).toBe(400);
    expect((await post("portal", `/api/auth/link/${token}`, { passkey: await key.create(opts.passkey!) })).status).toBe(204); // the link still works
  });
});

describe("signing in with a passkey", () => {
  test("needs no password; the session is the client's, on the portal only", async () => {
    const c = await clientWithPasskey();
    const res = await signInWithPasskey("portal", c.key);
    expect(res.status).toBe(204);
    expect(await whoAmI("portal", cookieFrom(res))).toMatchObject({ id: c.id });
    expect(JSON.parse(w.eventsOf("auth.signed_in", c.id).at(-1)!.data)).toMatchObject({ method: "passkey" });
    expect((await signInWithPasskey("admin", c.key)).status).toBe(401); // a client's passkey on the admin
  });

  test("a challenge works once, and a passkey nobody set up gets nowhere", async () => {
    const c = await clientWithPasskey();
    const opts = await json<{ challenge: string }>(post("portal", "/api/auth/passkey/options"));
    const answer = await c.key.get(opts);
    expect((await post("portal", "/api/auth/passkey", { response: answer })).status).toBe(204);
    expect((await post("portal", "/api/auth/passkey", { response: answer })).status).toBe(401); // replayed
    const stranger = await softPasskey(HERE);
    expect((await signInWithPasskey("portal", stranger)).status).toBe(401);
  });

  test("a password alone never signs in: with a passkey on the account, it says to use it", async () => {
    const c = await clientWithPasskey();
    w.db.run("UPDATE users SET password_hash = ? WHERE id = ?", [await Bun.password.hash("an old invented password"), c.id]);
    const r = await post("portal", "/api/auth/sign-in", { email: c.email, password: "an old invented password" });
    expect(r.status).toBe(401);
    expect((await json<{ error: string }>(r)).error).toContain("passkey");
  });

  test("a login from before MFA, with only a password, is sent to set one up", async () => {
    const c = newLogin();
    w.db.run("UPDATE users SET password_hash = ? WHERE id = ?", [await Bun.password.hash("an old invented password"), c.id]);
    const r = await post("portal", "/api/auth/sign-in", { email: c.email, password: "an old invented password" });
    expect(r.status).toBe(202);
    const { next, token } = await json<{ next: string; token: string }>(r);
    expect(next).toBe("setup");
    expect(r.headers.get("set-cookie")).toBeNull();
    const opts = await json<Options>(post("portal", `/api/auth/link/${token}/options`));
    expect((await post("portal", `/api/auth/link/${token}`, { passkey: await (await softPasskey(HERE)).create(opts.passkey!) })).status).toBe(204);
  });
});

describe("the preparer", () => {
  async function preparerSetUp() {
    const p = newLogin("preparer");
    const token = tokenOf(linkFor(p.id, "invite", null).url);
    const opts = await json<Options>(post("admin", `/api/auth/link/${token}/options`));
    const key = await softPasskey("http://localhost:5174");
    return { ...p, token, opts, key };
  }

  test("sets up a passkey AND a password with an authenticator app, and gets recovery codes once", async () => {
    const p = await preparerSetUp();
    const passkey = await p.key.create(p.opts.passkey!);
    expect((await post("admin", `/api/auth/link/${p.token}`, { passkey })).status).toBe(400); // the passkey alone
    expect((await post("admin", `/api/auth/link/${p.token}`, { password: "an invented long password", code: appCode(p.opts.totp.secret) })).status).toBe(400); // the app alone
    const res = await post("admin", `/api/auth/link/${p.token}`, { passkey, password: "an invented long password", code: appCode(p.opts.totp.secret) });
    expect(res.status).toBe(200);
    const { recoveryCodes } = await json<{ recoveryCodes: string[] }>(res);
    expect(recoveryCodes).toHaveLength(RECOVERY_CODES);
    expect(recoveryCodes[0]).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
    expect(w.all("SELECT code_hash FROM recovery_codes WHERE user_id = ?", p.id).map((r) => (r as { code_hash: string }).code_hash)).not.toContain(recoveryCodes[0]); // only hashes kept
    expect(await whoAmI("admin", cookieFrom(res))).toMatchObject({ id: p.id });
  });

  test("signs in with the password and the app, or a recovery code, each code once", async () => {
    const p = await preparerSetUp();
    const res = await post("admin", `/api/auth/link/${p.token}`, { passkey: await p.key.create(p.opts.passkey!), password: "an invented long password", code: appCode(p.opts.totp.secret) });
    const { recoveryCodes } = await json<{ recoveryCodes: string[] }>(res);
    const half = await post("admin", "/api/auth/sign-in", { email: p.email, password: "an invented long password" });
    expect(await json<unknown>(half)).toEqual({ next: "code", recoveryCodes: true });
    expect((await post("admin", "/api/auth/sign-in", { email: p.email, password: "an invented long password", code: appCode(p.opts.totp.secret, 1) })).status).toBe(204);
    expect((await post("admin", "/api/auth/sign-in", { email: p.email, password: "an invented long password", code: appCode(p.opts.totp.secret, 1) })).status).toBe(401); // used
    const code = recoveryCodes[3]!.toUpperCase().replace("-", " ");
    expect((await post("admin", "/api/auth/sign-in", { email: p.email, password: "an invented long password", code })).status).toBe(204);
    expect((await post("admin", "/api/auth/sign-in", { email: p.email, password: "an invented long password", code })).status).toBe(401);
    expect((await signInWithPasskey("admin", p.key)).status).toBe(204);
    expect((await signInWithPasskey("portal", p.key)).status).toBe(401); // the preparer's passkey is for the admin
  });
});

describe("lost your passkey?", () => {
  test("emails a reset link to the address on file, and says the same for an email with no account", async () => {
    const c = await clientWithPasskey();
    const known = await post("portal", "/api/auth/recover", { email: c.email });
    const unknown = await post("portal", "/api/auth/recover", { email: "nobody-here@example.test" });
    expect([known.status, unknown.status]).toEqual([202, 202]);
    expect(await json(known)).toEqual(await json(unknown));
    expect(outboxMessages().map((m) => [m.to, m.template])).toEqual([[c.email, "reset"]]);
    expect((await post("admin", "/api/auth/recover", { email: c.email })).status).toBe(202); // a client's email on the admin: nothing sent
    expect(outboxMessages()).toHaveLength(1);
  });

  test("using it signs out everywhere, removes the old passkeys, needs a new one, and tells the address on file", async () => {
    const c = await clientWithPasskey();
    await post("portal", "/api/auth/recover", { email: c.email });
    const token = tokenOf(outboxMessages()[0]!.text.match(/https?:\/\/\S+\/invite\/\S+/)![0]);
    clearOutbox();
    const opts = await json<Options>(post("portal", `/api/auth/link/${token}/options`));
    const newKey = await softPasskey(HERE);
    expect((await post("portal", `/api/auth/link/${token}`, {})).status).toBe(400); // nothing set up
    const res = await post("portal", `/api/auth/link/${token}`, { passkey: await newKey.create(opts.passkey!) });
    expect(res.status).toBe(204);
    expect(await whoAmI("portal", c.cookie)).toBeNull(); // the old session
    expect((await signInWithPasskey("portal", c.key)).status).toBe(401); // the old passkey
    expect((await signInWithPasskey("portal", newKey)).status).toBe(204);
    expect(JSON.parse(w.eventsOf("auth.sign_in_reset", c.id)[0]!.data)).toMatchObject({ passkeys_removed: 1, sessions_ended: 1 });
    expect(outboxMessages().map((m) => m.template)).toEqual(["sign-in-changed"]);
  });

  test("asking too often from one address is slowed down", async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await post("portal", "/api/auth/recover", { email: `flood-${i}@example.test` })).status;
    expect(last).toBe(429);
  });
});

describe("settings", () => {
  test("list passkeys (never their keys), add another, remove one, never the last way in", async () => {
    const c = await clientWithPasskey();
    const methods = await trpc("portal", c.cookie, "mfa.methods");
    expect(methods.data).toMatchObject({ passkeys: [{ name: "iPhone", synced: true }], authenticatorApp: false, password: false, recoveryCodesLeft: null });
    expect(JSON.stringify(methods.data)).not.toContain(c.key.id);

    const only = (methods.data as { passkeys: { id: string }[] }).passkeys[0]!.id;
    expect((await trpc("portal", c.cookie, "mfa.removePasskey", { passkeyId: only }, "mutation")).status).toBe(400); // the last one

    const opts = await json<{ challenge: string; user: { id: string }; excludeCredentials: { id: string }[] }>(post("portal", "/api/auth/passkeys/options", {}, { cookie: c.cookie }));
    expect(opts.excludeCredentials.map((e) => e.id)).toEqual([c.key.id]); // the phone won't make a second one for the same account
    const laptop = await softPasskey(HERE);
    expect((await post("portal", "/api/auth/passkeys", { response: await laptop.create(opts) }, { cookie: c.cookie, "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)" })).status).toBe(204);
    expect(outboxMessages().map((m) => m.subject)).toEqual(["Your Bell Tax sign-in changed"]);
    expect(((await trpc("portal", c.cookie, "mfa.methods")).data as { passkeys: { name: string }[] }).passkeys.map((p) => p.name)).toEqual(["iPhone", "Mac"]);

    expect((await trpc("portal", c.cookie, "mfa.removePasskey", { passkeyId: only }, "mutation")).data).toEqual({ removed: true });
    expect((await signInWithPasskey("portal", c.key)).status).toBe(401);
    expect((await signInWithPasskey("portal", laptop)).status).toBe(204);
    expect(w.eventsOf("auth.passkey_removed", c.id)).toHaveLength(1);
  });

  test("someone else's passkey can't be removed; adding needs a signed-in login", async () => {
    const a = await clientWithPasskey();
    const b = await clientWithPasskey();
    const theirs = w.get<{ id: string }>("SELECT id FROM passkeys WHERE user_id = ?", b.id).id;
    expect((await trpc("portal", a.cookie, "mfa.removePasskey", { passkeyId: theirs }, "mutation")).status).toBe(404);
    expect((await post("portal", "/api/auth/passkeys/options")).status).toBe(401);
  });

  test("the preparer can make new recovery codes; a client can't", async () => {
    const c = await clientWithPasskey();
    expect((await trpc("portal", c.cookie, "mfa.newRecoveryCodes", {}, "mutation")).status).toBe(404); // not on the portal at all
    const r = await w.call(w.preparerId, "mfa.newRecoveryCodes", {}, "mutation");
    expect((r.data as { codes: string[] }).codes).toHaveLength(RECOVERY_CODES);
  });
});
