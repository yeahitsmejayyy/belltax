import type { Database } from "bun:sqlite";
import type { RunMode } from "@app/schema";
import type { Links, StripeConfig } from "../config";
import type { Storage } from "../storage";

// The running server's database, storage and mode, set once at boot (or per test).
// Routes read it from here rather than from the tRPC context: the context is part of the AppRouter
// type the web app imports, and a bun:sqlite handle there would leak Bun types into a browser build.

// dataDir: where the database and uploads live (exports must go elsewhere). publicDemo: the hosted demo, where uploads are off.
type Runtime = { db: Database; storage: Storage; mode: RunMode; dataDir?: string; publicDemo?: boolean; stripe?: StripeConfig | null; links?: Links };
let current: Runtime | null = null;

export function useRuntime(runtime: Runtime) {
  current = runtime;
}

export function runtime(): Runtime {
  if (!current) throw new Error("runtime not initialised: call useRuntime() at boot");
  return current;
}
