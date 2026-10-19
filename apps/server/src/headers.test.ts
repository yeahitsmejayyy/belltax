import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEMO_USER_HEADER } from "./identity";
import { createFetchHandler } from "./http";
import { demoWorld, ORIGIN } from "./test-harness";

// What every response carries, on both listeners: the SPA, tRPC, the file endpoints, /health and the misses.

let w: Awaited<ReturnType<typeof demoWorld>>;
const dist = mkdtempSync(join(tmpdir(), "btp-headers-"));
beforeAll(async () => {
  w = await demoWorld();
  mkdirSync(join(dist, "assets"), { recursive: true });
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>app</title>");
  writeFileSync(join(dist, "assets", "app.js"), "console.log('app')");
});
afterAll(() => {
  w.cleanup();
  rmSync(dist, { recursive: true, force: true });
});

const surfaces = {
  admin: createFetchHandler({ surface: "admin", webDist: dist }),
  portal: createFetchHandler({ surface: "portal", webDist: dist }),
} as const;

const clientDoc = () =>
  w.get<{ id: string; user: string }>(
    `SELECT d.id, u.id AS user FROM documents d
     JOIN return_people rp ON rp.engagement_id = d.engagement_id AND rp.role = 'primary'
     JOIN users u ON u.person_id = rp.person_id
     WHERE d.purged_at IS NULL AND d.storage_key IS NOT NULL LIMIT 1`,
  );

// [label, request builder, is it API (no-store)?]
const requests = (): [string, () => Request, boolean][] => {
  const doc = clientDoc();
  return [
    ["spa index", () => new Request(`${ORIGIN}/`), false],
    ["spa client route", () => new Request(`${ORIGIN}/returns/abc`), false],
    ["spa asset", () => new Request(`${ORIGIN}/assets/app.js`), false],
    ["trpc", () => new Request(`${ORIGIN}/trpc/demo.users`), true],
    ["trpc denied", () => new Request(`${ORIGIN}/trpc/engagement.mine`), true],
    ["rest download", () => new Request(`${ORIGIN}/api/documents/${doc.id}/file`, { headers: { [DEMO_USER_HEADER]: doc.user } }), true],
    ["rest upload denied", () => new Request(`${ORIGIN}/api/documents`, { method: "POST", headers: { origin: ORIGIN }, body: new FormData() }), true],
    ["api miss", () => new Request(`${ORIGIN}/api/nope`), true],
    ["health", () => new Request(`${ORIGIN}/health`), true],
    ["method not allowed", () => new Request(`${ORIGIN}/`, { method: "DELETE" }), false],
  ];
};

describe("security headers", () => {
  for (const mode of ["demo", "live"] as const) {
    for (const surface of ["admin", "portal"] as const) {
      test(`${surface} in ${mode}: every response is hardened`, async () => {
        w.use(mode);
        for (const [label, make, api] of requests()) {
          const res = await surfaces[surface](make());
          const h = (name: string) => res.headers.get(name);
          const csp = h("Content-Security-Policy") ?? "";
          expect({ label, csp: csp.length > 0 }).toEqual({ label, csp: true });
          const frame = label === "rest download" ? "frame-ancestors 'self'" : "frame-ancestors 'none'"; // the viewer frames files
          for (const directive of ["default-src 'self'", "script-src 'self'", frame, "object-src 'none'", "base-uri 'none'"]) {
            expect({ label, directive, has: csp.includes(directive) }).toEqual({ label, directive, has: true });
          }
          expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
          expect({ label, v: h("X-Content-Type-Options") }).toEqual({ label, v: "nosniff" });
          expect({ label, v: h("Referrer-Policy") }).toEqual({ label, v: "no-referrer" });
          expect({ label, v: h("Permissions-Policy") }).toEqual({ label, v: "camera=(), microphone=(), geolocation=()" });
          expect({ label, v: h("Cross-Origin-Opener-Policy") }).toEqual({ label, v: "same-origin" });
          expect({ label, hsts: h("Strict-Transport-Security") }).toEqual({
            label,
            hsts: mode === "live" ? "max-age=31536000; includeSubDomains" : null,
          });
          if (api) expect({ label, noStore: h("Cache-Control")?.includes("no-store") }).toEqual({ label, noStore: true });
        }
      });
    }
  }

  test("the app shell and its hashed assets keep their own caching", async () => {
    w.use("demo");
    expect((await surfaces.portal(new Request(`${ORIGIN}/`))).headers.get("Cache-Control")).toBe("no-cache");
    expect((await surfaces.portal(new Request(`${ORIGIN}/assets/app.js`))).headers.get("Cache-Control")).toContain("immutable");
  });

  test("the download reached the file, so its headers were tested on a real response", async () => {
    w.use("demo");
    const doc = clientDoc();
    const res = await surfaces.admin(new Request(`${ORIGIN}/api/documents/${doc.id}/file`, { headers: { [DEMO_USER_HEADER]: w.preparerId } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("the marketing site reads public prices and practice details from the portal", () => {
  const acao = async (surface: "admin" | "portal", path: string, init?: RequestInit) =>
    (await surfaces[surface](new Request(`${ORIGIN}${path}`, { ...init, headers: { origin: "https://site.example.test" } }))).headers.get("Access-Control-Allow-Origin");

  test("pricing.public and practice.public, alone or batched, are readable by any origin, without credentials", async () => {
    w.use("demo");
    for (const path of ["/trpc/pricing.public", "/trpc/practice.public", "/trpc/practice.public,pricing.public?batch=1&input=%7B%7D"]) {
      expect({ path, acao: await acao("portal", path) }).toEqual({ path, acao: "*" });
    }
    const res = await surfaces.portal(new Request(`${ORIGIN}/trpc/pricing.public`, { headers: { origin: "https://site.example.test" } }));
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  test("nothing else: not a batch that sneaks in another procedure, not the admin, not a mutation", async () => {
    w.use("demo");
    expect(await acao("portal", "/trpc/pricing.public,engagement.mine?batch=1&input=%7B%7D")).toBeNull();
    expect(await acao("portal", "/trpc/engagement.mine")).toBeNull();
    expect(await acao("admin", "/trpc/pricing.public")).toBeNull();
    expect(await acao("portal", "/trpc/pricing.public", { method: "POST", body: "{}" })).toBeNull();
  });
});
