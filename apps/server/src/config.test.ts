import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config";

const repo = "/work/belltaxprep";

describe("loadConfig", () => {
  test("defaults to demo with in-repo data dir", () => {
    expect(loadConfig({}, repo)).toEqual({ mode: "demo", port: 3000, adminPort: 3001, dataDir: "/work/belltaxprep/data/demo", publicDemo: null, stripe: null, links: { portal: "http://localhost:5175", admin: "http://localhost:5174" }, email: { driver: "outbox", from: "Bell Tax <hello@belltax.example>" } });
  });

  test("rejects an unknown mode", () => {
    expect(() => loadConfig({ RUN_MODE: "prod" }, repo)).toThrow('RUN_MODE must be "demo" or "live"');
  });

  test("rejects a bad port", () => {
    expect(() => loadConfig({ PORT: "abc" }, repo)).toThrow("PORT");
  });

  test("live requires LIVE_DATA_DIR", () => {
    expect(() => loadConfig({ RUN_MODE: "live" }, repo)).toThrow("requires LIVE_DATA_DIR");
  });

  test("live rejects a relative data dir", () => {
    expect(() => loadConfig({ RUN_MODE: "live", LIVE_DATA_DIR: "live-data" }, repo)).toThrow("absolute");
  });

  test("live rejects a data dir inside the repo", () => {
    for (const dir of [repo, `${repo}/live-data`, `${repo}/apps/../data`]) {
      expect(() => loadConfig({ RUN_MODE: "live", LIVE_DATA_DIR: dir }, repo)).toThrow("outside the repo");
    }
  });

  test("live accepts a sibling dir that only shares a name prefix", () => {
    const cfg = loadConfig({ RUN_MODE: "live", LIVE_DATA_DIR: "/work/belltaxprep-live" }, repo);
    expect(cfg).toEqual({ mode: "live", port: 3000, adminPort: 3001, dataDir: "/work/belltaxprep-live", publicDemo: null, stripe: null, links: { portal: "http://127.0.0.1:3000", admin: "http://localhost:3001" }, email: { driver: "outbox", from: "Bell Tax <hello@belltax.example>" } });
  });

  test("the admin gets its own port, never the portal's", () => {
    expect(loadConfig({ PORT: "4000" }, repo).adminPort).toBe(4001);
    expect(loadConfig({ PORT: "4000", ADMIN_PORT: "4100" }, repo).adminPort).toBe(4100);
    expect(() => loadConfig({ PORT: "4000", ADMIN_PORT: "4000" }, repo)).toThrow("must differ");
  });

  test("the public demo is opt-in, demo only, and resets on a timer", () => {
    expect(loadConfig({ DEMO_PUBLIC: "1" }, repo).publicDemo).toEqual({ resetHours: 6 });
    expect(loadConfig({ DEMO_PUBLIC: "1", DEMO_RESET_HOURS: "2" }, repo).publicDemo).toEqual({ resetHours: 2 });
    expect(loadConfig({ DEMO_PUBLIC: "0" }, repo).publicDemo).toBeNull();
    expect(() => loadConfig({ DEMO_PUBLIC: "1", DEMO_RESET_HOURS: "0" }, repo)).toThrow("DEMO_RESET_HOURS");
  });

  test("live can never run as the public demo", () => {
    for (const flag of ["1", "true", "yes"]) {
      expect(() => loadConfig({ RUN_MODE: "live", LIVE_DATA_DIR: "/srv/btp", DEMO_PUBLIC: flag }, repo)).toThrow("never be set with RUN_MODE=live");
    }
  });

  test("Stripe takes test keys only, both or neither", () => {
    const keys = { STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_abc" };
    expect(loadConfig(keys, repo).stripe).toEqual({ secretKey: "sk_test_abc", webhookSecret: "whsec_abc", publicOrigin: "http://localhost:5175" });
    expect(loadConfig({ ...keys, PUBLIC_ORIGIN: "https://demo.example/" }, repo).stripe?.publicOrigin).toBe("https://demo.example");
    expect(() => loadConfig({ ...keys, STRIPE_SECRET_KEY: "sk_live_abc" }, repo)).toThrow("live key");
    expect(() => loadConfig({ STRIPE_SECRET_KEY: "sk_test_abc" }, repo)).toThrow("both");
    expect(() => loadConfig({ ...keys, STRIPE_WEBHOOK_SECRET: "nope" }, repo)).toThrow("whsec_");
  });

  test("email sends for real only in live mode with a Resend key and a from address", () => {
    const live = { RUN_MODE: "live", LIVE_DATA_DIR: "/srv/btp" };
    expect(loadConfig({ ...live, RESEND_API_KEY: "re_abc", EMAIL_FROM: "Bell Tax <hi@belltax.test>" }, repo).email).toEqual({ driver: "resend", apiKey: "re_abc", from: "Bell Tax <hi@belltax.test>" });
    expect(() => loadConfig({ ...live, RESEND_API_KEY: "re_abc" }, repo)).toThrow("EMAIL_FROM");
    expect(() => loadConfig({ ...live, RESEND_API_KEY: "sk_abc", EMAIL_FROM: "x <x@y.test>" }, repo)).toThrow("re_");
    expect(loadConfig({ RESEND_API_KEY: "re_abc", EMAIL_FROM: "x <x@y.test>" }, repo).email?.driver).toBe("outbox"); // demo never sends
    expect(loadConfig({ DEMO_PUBLIC: "1", RESEND_API_KEY: "re_abc" }, repo).email?.driver).toBe("outbox");
  });
});
