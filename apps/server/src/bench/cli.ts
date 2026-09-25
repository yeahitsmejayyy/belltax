import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "../config";
import { DB_FILE, connect } from "../db/open";
import { applySchema } from "../db/schema";
import { useRuntime } from "../db/client";
import { createStorage } from "../storage";
import { benchCases, runBench, table } from "./run";
import { seedBench } from "./world";

// bun run bench:seed [copies]   build data/bench/ (demo data only; default 80 copies ≈ 2,000 households)
// bun run bench                 time the hot paths against it (budget 100 ms each)
// Never live: it refuses to run with RUN_MODE=live, and only ever writes under data/bench/.

const BENCH_DIR = join(REPO_ROOT, "data/bench");
const BUDGET_MS = 100;
const [command, arg] = process.argv.slice(2);

if (process.env.RUN_MODE === "live") throw new Error("the benchmark is demo-only; unset RUN_MODE");

if (command === "seed") {
  const copies = Number(arg ?? 80);
  rmSync(BENCH_DIR, { recursive: true, force: true });
  mkdirSync(BENCH_DIR, { recursive: true });
  const db = connect(join(BENCH_DIR, DB_FILE));
  await applySchema(db);
  const t = performance.now();
  const s = seedBench(db, { storage: createStorage(BENCH_DIR), copies });
  db.close();
  console.log(`✔ bench world in ${BENCH_DIR} (${Math.round((performance.now() - t) / 1000)}s)`);
  console.log(`  ${s.households} households · ${s.returns} returns · ${s.documents} documents · ${s.requests} requests · ${s.invoices} invoices · ${s.events} events`);
} else if (command === "run") {
  const file = join(BENCH_DIR, DB_FILE);
  if (!existsSync(file)) throw new Error("no bench world yet: run `bun run bench:seed` first");
  const db = connect(file);
  useRuntime({ db, storage: createStorage(BENCH_DIR), mode: "demo" });
  const results = await runBench(benchCases(db));
  console.log(table(results, BUDGET_MS));
  const over = results.filter((r) => r.medianMs > BUDGET_MS);
  if (over.length) {
    console.log(`\n${over.length} over the ${BUDGET_MS} ms budget`);
    process.exitCode = 1;
  }
  db.close();
} else {
  throw new Error("usage: seed [copies] | run");
}

