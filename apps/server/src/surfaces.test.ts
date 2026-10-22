import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Config } from "./config";
import { DEMO_USER_HEADER } from "./identity";
import { adminServerOptions, checkHost, checkTunnelConfig, serverOptions } from "./live/hardening";
import { demoPdf } from "./db/seed/pdf";
import { demoWorld, ORIGIN } from "./test-harness";

// Two listeners: the portal (the only one a tunnel may forward) and the admin (this machine only).
// A preparer credential used on the portal gets no further than a stranger's would.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const anyReturn = () => w.get<{ id: string }>("SELECT id FROM engagements WHERE tax_year = 2025 LIMIT 1").id;
const clientOf = (engagementId: string) =>
  w.get<{ id: string }>("SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'", engagementId).id;

describe("the portal listener", () => {
  test("preparer procedures are 404 there, even with a preparer identity, and look undefined", async () => {
    for (const [path, input, kind] of [
      ["engagement.list", undefined, "query"],
      ["engagement.detail", { engagementId: anyReturn() }, "query"],
      ["household.list", undefined, "query"],
      ["engagement.advanceStage", { engagementId: anyReturn(), to: "intake" }, "mutation"],
    ] as const) {
      const res = await w.call(P(), path, input, kind, "portal");
      expect({ path, status: res.status, message: res.error?.message }).toEqual({ path, status: 404, message: `No procedure found on path "${path}"` });
    }
    const truly = await w.call(P(), "engagement.doesNotExist", undefined, "query", "portal");
    expect(truly.status).toBe(404); // indistinguishable from a path that was never defined
  });

  test("a preparer identity counts for nothing there: client procedures answer 401", async () => {
    const id = anyReturn();
    expect((await w.call(P(), "intake.get", { engagementId: id }, "query", "portal")).status).toBe(401);
    expect((await w.call(P(), "engagement.mine", undefined, "query", "portal")).status).toBe(401);
    const upload = new FormData();
    upload.set("engagementId", id);
    upload.set("kind", "other");
    upload.set("file", new File([demoPdf(["x"])], "x.pdf"));
    const res = await w.portal(new Request(`${ORIGIN}/api/documents`, { method: "POST", headers: { [DEMO_USER_HEADER]: P(), origin: ORIGIN }, body: upload }));
    expect(res.status).toBe(401);
    const doc = w.get<{ id: string }>("SELECT id FROM documents WHERE purged_at IS NULL LIMIT 1").id;
    const dl = await w.portal(new Request(`${ORIGIN}/api/documents/${doc}/file`, { headers: { [DEMO_USER_HEADER]: P() } }));
    expect(dl.status).toBe(401);
  });

  test("no default identity there: the demo-preparer shortcut is an admin convenience only", async () => {
    expect((await w.call(null, "engagement.mine", undefined, "query", "portal")).status).toBe(401);
  });

  test("clients work normally there", async () => {
    const id = anyReturn();
    expect((await w.call(clientOf(id), "request.list", { engagementId: id }, "query", "portal")).status).toBe(200);
  });
});

describe("the admin listener", () => {
  test("preparer procedures work", async () => {
    expect((await w.call(P(), "engagement.list", undefined, "query", "admin")).status).toBe(200);
    expect((await w.call(P(), "engagement.detail", { engagementId: anyReturn() }, "query", "admin")).status).toBe(200);
  });

  test("a client there is still just a client: 403 on preparer procedures, 200 on their own", async () => {
    const id = anyReturn();
    expect((await w.call(clientOf(id), "engagement.list", undefined, "query", "admin")).status).toBe(403);
    expect((await w.call(clientOf(id), "request.list", { engagementId: id }, "query", "admin")).status).toBe(200);
  });
});

describe("configuration and the tunnel check", () => {
  const config: Config = { mode: "live", port: 3000, adminPort: 3001, dataDir: "/tmp/btp-surfaces-not-used", publicDemo: null };

  test("both listeners bind to 127.0.0.1, on different ports", () => {
    expect(serverOptions(config)).toEqual({ hostname: "127.0.0.1", port: 3000 });
    expect(adminServerOptions(config)).toEqual({ hostname: "127.0.0.1", port: 3001 });
  });

  test("only the hosted public demo binds a public interface, and live never does", () => {
    const demo: Config = { ...config, mode: "demo", publicDemo: { resetHours: 6 } };
    expect(serverOptions(demo).hostname).toBe("0.0.0.0");
    expect(adminServerOptions(demo).hostname).toBe("127.0.0.1");
    expect(serverOptions({ ...config, publicDemo: { resetHours: 6 } }).hostname).toBe("127.0.0.1");
  });

  test("the tunnel must forward the portal, never the admin", () => {
    const tunnel = (port?: number) => checkHost(config, { probe: () => "on", tunnelTargetPort: port }).find((c) => c.name === "tunnel target")!;
    expect(tunnel(3000).status).toBe("ok");
    expect(tunnel(3001)).toMatchObject({ status: "fail", detail: expect.stringContaining("never the admin") });
    expect(tunnel(undefined).status).toBe("warn");
  });

  // Ticket 25: the real cloudflared config, read from disk, decides; every route must reach the portal only.
  test("the cloudflared config: portal only, everything else refused", () => {
    const check = (yaml: string, origin?: string) => checkTunnelConfig(yaml, config, origin);
    const good = `tunnel: belltax-live
credentials-file: /Users/pj/.cloudflared/abc.json
ingress:
  - hostname: portal.belltaxprep.com
    service: http://127.0.0.1:${config.port}
  - service: http_status:404
`;
    expect(check(good, "https://portal.belltaxprep.com")).toMatchObject({ status: "ok", detail: expect.stringContaining("portal.belltaxprep.com") });
    expect(check(good.replace("127.0.0.1", "localhost")).status).toBe("ok");
    expect(check(good.replace(`:${config.port}`, `:${config.adminPort}`))).toMatchObject({ status: "fail", detail: expect.stringContaining("admin") });
    expect(check(good.replace(`http://127.0.0.1:${config.port}`, "http://192.168.1.20:3000")).status).toBe("fail"); // another machine
    expect(check(good.replace("  - service: http_status:404\n", "  - service: http://127.0.0.1:" + config.port + "\n")).detail).toContain("http_status:404"); // no catch-all refusal
    expect(check("ingress: []").status).toBe("fail");
    expect(check("ingress: [nope").status).toBe("fail");
    expect(check(good, "https://portal.example.com").status).toBe("warn"); // PUBLIC_ORIGIN doesn't match
    // In checkHost, the config file wins over TUNNEL_TARGET_PORT.
    const viaHost = checkHost(config, { probe: () => "on", tunnelTargetPort: config.port, tunnelConfig: { path: "/tmp/config.yml", text: good.replace(`:${config.port}`, `:${config.adminPort}`) } });
    expect(viaHost.find((c) => c.name === "tunnel target")!.status).toBe("fail");
  });
});

describe("the demo sign-in picker", () => {
  const users = async (surface: "portal" | "admin") =>
    (await w.call(null, "demo.users", undefined, "query", surface)).data as { role: string; email: string }[];

  test("lists clients on the portal and the preparer on the admin", async () => {
    const portal = await users("portal");
    expect(portal.length).toBeGreaterThan(20);
    expect(portal.every((u) => u.role === "client" && u.email.endsWith(".test"))).toBe(true);
    expect((await users("admin")).map((u) => u.role)).toEqual(["preparer"]);
  });

  test("doesn't exist in live mode", async () => {
    w.use("live");
    expect((await w.call(null, "demo.users", undefined, "query", "portal")).status).toBe(404);
  });
});

describe("demo identity cookies", () => {
  test("each listener reads only its own cookie, so the portal's client can't leak into the admin", async () => {
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    const onAdmin = await w.handler(new Request(`${ORIGIN}/trpc/engagement.list`, { headers: { cookie: `btp_demo_portal=${client}` } }));
    expect(onAdmin.status).toBe(200); // the portal cookie is ignored; the admin's demo-preparer default applies
    const onPortal = await w.portal(new Request(`${ORIGIN}/trpc/engagement.mine`, { headers: { cookie: `btp_demo_portal=${client}` } }));
    expect(onPortal.status).toBe(200);
    const adminCookieOnPortal = await w.portal(new Request(`${ORIGIN}/trpc/engagement.mine`, { headers: { cookie: `btp_demo_admin=${client}` } }));
    expect(adminCookieOnPortal.status).toBe(401);
  });
});

