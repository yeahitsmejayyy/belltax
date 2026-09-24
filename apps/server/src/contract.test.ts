import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The AppRouter contract is what the frontends type themselves against. It must emit as one file with
// no Bun/Node types in it (scripts/emit-types.ts refuses otherwise), and each frontend's committed copy
// must match what the server emits today: a stale copy means `bun run sync:types` wasn't run.
const server = resolve(import.meta.dir, "..");

test("the AppRouter contract emits as one clean file", () => {
  const run = Bun.spawnSync(["bun", "scripts/emit-types.ts"], { cwd: server });
  const output = `${run.stdout}${run.stderr}`;
  expect({ exitCode: run.exitCode, output }).toEqual({ exitCode: 0, output: expect.stringContaining("contract emitted") });
}, 30_000);

test("each frontend's committed contract is current (run `bun run sync:types` if this fails)", () => {
  Bun.spawnSync(["bun", "scripts/emit-types.ts"], { cwd: server });
  const emitted = readFileSync(resolve(server, "dist/types/appRouter.d.ts"), "utf8");
  for (const app of ["portal", "admin"]) {
    const committed = readFileSync(resolve(server, `../${app}/src/lib/app-router.d.ts`), "utf8");
    expect({ app, current: committed.endsWith(emitted) }).toEqual({ app, current: true });
  }
}, 30_000);
