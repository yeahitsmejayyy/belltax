import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config";

const repo = "/work/belltaxprep";

describe("loadConfig", () => {
  test("defaults to demo with in-repo data dir", () => {
    expect(loadConfig({}, repo)).toEqual({ mode: "demo", port: 3000, adminPort: 3001, dataDir: "/work/belltaxprep/data/demo" });
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
    expect(cfg).toEqual({ mode: "live", port: 3000, adminPort: 3001, dataDir: "/work/belltaxprep-live" });
  });

  test("the admin gets its own port, never the portal's", () => {
    expect(loadConfig({ PORT: "4000" }, repo).adminPort).toBe(4001);
    expect(loadConfig({ PORT: "4000", ADMIN_PORT: "4100" }, repo).adminPort).toBe(4100);
    expect(() => loadConfig({ PORT: "4000", ADMIN_PORT: "4000" }, repo)).toThrow("must differ");
  });
});
