import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { hashToken } from "./auth/auth";
import { useRuntime } from "./db/client";
import { clearOutbox, emailHttp, outboxMessages, send } from "./email/email";
import { appCode } from "./test-auth";
import { demoWorld, ORIGIN } from "./test-harness";

// Ticket 51: outgoing email. The outbox in dev and the demos; Resend (faked here) only in live mode with a key.

let w: Awaited<ReturnType<typeof demoWorld>>;
const LINKS = { portal: "https://portal.example", admin: "http://127.0.0.1:3001" };
const OUTBOX = { driver: "outbox" as const, from: "Bell Tax <hello@belltax.example>" };
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => {
  useRuntime({ db: w.db, storage: w.storage, mode: "demo", links: LINKS, email: OUTBOX });
  clearOutbox();
});
afterAll(() => w.cleanup());

const unactivated = () => w.get<{ id: string; email: string }>("SELECT id, email FROM users WHERE role = 'client' AND activated_at IS NULL LIMIT 1");

describe("invites and resets", () => {
  test("making a link emails it, with the practice's details and nothing about the return", async () => {
    const u = unactivated();
    const r = await w.call(w.preparerId, "login.link", { userId: u.id, purpose: "invite" }, "mutation");
    expect(r.data).toMatchObject({ emailed: true });
    const [m] = outboxMessages();
    expect(m).toMatchObject({ to: u.email, template: "invite", subject: "Set up your Bell Tax account" });
    expect(m!.text).toContain((r.data as { url: string }).url);
    expect(m!.html).toContain("Set up my account");
    expect(m!.text).not.toMatch(/\$|W-2|SSN|refund/);
  });

  test("the event names who and which template, never the link", async () => {
    const u = unactivated();
    const r = await w.call(w.preparerId, "login.link", { userId: u.id, purpose: "reset" }, "mutation");
    const url = (r.data as { url: string }).url;
    const ev = w.eventsOf("email.sent", u.id).at(-1)!;
    expect(JSON.parse(ev.data)).toMatchObject({ to: u.email, template: "reset", driver: "outbox" });
    expect(ev.data).not.toContain(url.split("/invite/")[1]!);
  });

  test("using a reset link tells the address on file that the password changed", async () => {
    const u = unactivated();
    const url = ((await w.call(w.preparerId, "login.link", { userId: u.id, purpose: "invite" }, "mutation")).data as { url: string }).url;
    const setUp = async (token: string, password: string) => {
      const opts = (await (await w.portal(new Request(`${ORIGIN}/api/auth/link/${token}/options`, { method: "POST" }))).json()) as { totp: { secret: string } };
      return w.portal(new Request(`${ORIGIN}/api/auth/link/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, code: appCode(opts.totp.secret) }) }));
    };
    await setUp(url.split("/invite/")[1]!, "an invented long password");
    const reset = ((await w.call(w.preparerId, "login.link", { userId: u.id, purpose: "reset" }, "mutation")).data as { url: string }).url;
    clearOutbox();
    const res = await setUp(reset.split("/invite/")[1]!, "another invented password");
    expect(res.status).toBe(204);
    expect(outboxMessages().map((m) => m.template)).toEqual(["sign-in-changed"]);
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM invites WHERE token_hash = ? AND used_at IS NOT NULL", hashToken(reset.split("/invite/")[1]!)).n).toBe(1);
  });
});

describe("drivers", () => {
  test("Resend: one POST with the key; a failure is an event, not a crash", async () => {
    const calls: { url: string; auth: string | null; body: string }[] = [];
    let ok = true;
    emailHttp.fetch = async (url, init) => {
      calls.push({ url, auth: new Headers(init.headers).get("authorization"), body: String(init.body) });
      return ok ? Response.json({ id: "email_123" }) : Response.json({ message: "Domain not verified" }, { status: 403 });
    };
    useRuntime({ db: w.db, storage: w.storage, mode: "live", links: LINKS, email: { driver: "resend", apiKey: "re_test", from: "Bell Tax <hi@belltax.test>" } });
    const m = { to: "jo@example.test", subject: "Hi", text: "Hi", html: "<p>Hi</p>", template: "test" };
    expect(await send(m, { userId: "u1" })).toEqual({ sent: true, id: "email_123", driver: "resend" });
    expect(calls[0]).toMatchObject({ url: "https://api.resend.com/emails", auth: "Bearer re_test" });
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ from: "Bell Tax <hi@belltax.test>", to: ["jo@example.test"] });
    ok = false;
    expect(await send(m, { userId: "u1" })).toEqual({ sent: false, error: "Domain not verified" });
    expect(w.eventsOf("email.failed", "u1")).toHaveLength(1);
    expect(outboxMessages()).toHaveLength(0); // nothing parked in the outbox when Resend is the driver
  });

  test("the outbox page is for the preparer, and doesn't exist when mail really goes", async () => {
    await send({ to: "jo@example.test", subject: "Hi", text: "Hi", html: "<p>Hi</p>", template: "test" });
    expect(((await w.call(w.preparerId, "email.outbox", undefined)).data as unknown[]).length).toBe(1);
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "email.outbox", undefined)).status).toBe(403);
    // (demo mode only so the test's preparer identity counts; the rule is about the driver)
    useRuntime({ db: w.db, storage: w.storage, mode: "demo", links: LINKS, email: { driver: "resend", apiKey: "re_test", from: "x <x@y.test>" } });
    expect((await w.call(w.preparerId, "email.outbox", undefined)).status).toBe(404);
  });
});
