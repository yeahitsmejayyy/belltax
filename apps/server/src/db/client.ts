import type { Database } from "bun:sqlite";
import type { RunMode } from "@app/schema";
import type { Storage } from "../storage";

// The running server's database, storage and mode, set once at boot (or per test).
// Routes read it from here rather than from the tRPC context: the context is part of the AppRouter
// type the web app imports, and a bun:sqlite handle there would leak Bun types into a browser build.

type Runtime = { db: Database; storage: Storage; mode: RunMode; dataDir?: string }; // dataDir: where the database and uploads live (exports must go elsewhere)
let current: Runtime | null = null;

export function useRuntime(runtime: Runtime) {
  current = runtime;
}

export function runtime(): Runtime {
  if (!current) throw new Error("runtime not initialised: call useRuntime() at boot");
  return current;
}
