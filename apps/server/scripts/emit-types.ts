// Emits the backend's public contract — the AppRouter type — as one declaration file that
// skelly-admin copies in with `bun run sync:types`. Refuses to ship a contract that leaks
// server runtime types or spills across files, because either one breaks a standalone admin.
import { $ } from "bun";
import { readFileSync } from "node:fs";

const out = "dist/types/appRouter.d.ts";

await $`bunx tsc -p tsconfig.types.json`;

const text = readFileSync(out, "utf8");

const leaks = text.match(/(?:import\(|from )"(?:bun|node)(?::|")/g);
if (leaks) {
  console.error(`✖ ${out} leaks server runtime types: ${[...new Set(leaks)].join(", ")}`);
  console.error("  Keep the tRPC context free of Bun/Node types; routes import what they need directly.");
  process.exit(1);
}

const spills = text.match(/(?:import\(|from )"\.\.?\//g);
if (spills) {
  console.error(`✖ ${out} references other files: ${[...new Set(spills)].join(", ")}`);
  console.error("  The contract must be a single file. Inline the type, or extend scripts/emit-types.ts to bundle.");
  process.exit(1);
}

console.log(`✔ contract emitted: ${out}`);
