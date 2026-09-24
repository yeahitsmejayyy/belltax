import { expect, test } from "bun:test";

// The AppRouter contract is what apps/web types itself against. It must emit as one file with no
// Bun/Node types in it; scripts/emit-types.ts refuses otherwise, and this keeps that check in CI.
test("the AppRouter contract emits as one clean file", () => {
  const run = Bun.spawnSync(["bun", "scripts/emit-types.ts"], { cwd: `${import.meta.dir}/..` });
  const output = `${run.stdout}${run.stderr}`;
  expect({ exitCode: run.exitCode, output }).toEqual({ exitCode: 0, output: expect.stringContaining("contract emitted") });
}, 30_000);
