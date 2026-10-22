import { describe, expect, test } from "bun:test";
import { lockedPackages } from "./audit";

// The audit's fallback reads every installed package from bun.lock; make sure it reads them all, and only them.

describe("lockedPackages", () => {
  test("reads name@version for plain, scoped and nested entries, skipping workspaces", () => {
    const lock = `{
  "packages": {
    "@adobe/css-tools": ["@adobe/css-tools@4.5.0", "", {}, "sha512-x"],
    "@app/ui": ["@app/ui@workspace:packages/ui"],
    "storybook": ["storybook@10.6.3", "", {}, "sha512-y"],
    "vitest/vite": ["vite@7.3.7", "", {}, "sha512-z"],
    "local": ["local@file:../local"],
  }
}`;
    expect(lockedPackages(lock)).toEqual([
      { name: "@adobe/css-tools", version: "4.5.0" },
      { name: "storybook", version: "10.6.3" },
      { name: "vite", version: "7.3.7" },
    ]);
  });

  test("finds every package in the real lockfile, including the ones that matter most", async () => {
    const pkgs = lockedPackages(await Bun.file(new URL("../bun.lock", import.meta.url)).text());
    expect(pkgs.length).toBeGreaterThan(300);
    const names = new Set(pkgs.map((p) => p.name));
    for (const n of ["react", "vite", "storybook", "zod", "@trpc/server", "@simplewebauthn/server"]) expect(names.has(n)).toBe(true);
  });
});
