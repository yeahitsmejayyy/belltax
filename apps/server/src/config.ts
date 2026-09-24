import { isAbsolute, relative, resolve } from "node:path";
import { RunMode } from "@app/schema";

export const REPO_ROOT = resolve(import.meta.dir, "../../..");

export type Config = {
  mode: RunMode;
  port: number; // the portal listener: the only one a tunnel may forward
  adminPort: number; // the admin listener: this machine only, never forwarded
  dataDir: string;
};

type Env = Record<string, string | undefined>;

export function isInside(parent: string, child: string) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

// Fails loudly at boot rather than letting real data land somewhere it could be committed.
export function loadConfig(env: Env = process.env, repoRoot = REPO_ROOT): Config {
  const parsedMode = RunMode.safeParse(env.RUN_MODE ?? "demo");
  if (!parsedMode.success) {
    throw new Error(`RUN_MODE must be "demo" or "live", got "${env.RUN_MODE}"`);
  }
  const mode = parsedMode.data;

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer 1–65535, got "${env.PORT}"`);
  }
  const adminPort = Number(env.ADMIN_PORT ?? port + 1);
  if (!Number.isInteger(adminPort) || adminPort < 1 || adminPort > 65535) {
    throw new Error(`ADMIN_PORT must be an integer 1–65535, got "${env.ADMIN_PORT}"`);
  }
  if (adminPort === port) throw new Error("ADMIN_PORT must differ from PORT: the admin never shares the portal's listener");

  if (mode === "demo") {
    return { mode, port, adminPort, dataDir: resolve(repoRoot, "data/demo") };
  }

  // Live mode never guesses where real data goes.
  const dir = env.LIVE_DATA_DIR;
  if (!dir) throw new Error("RUN_MODE=live requires LIVE_DATA_DIR");
  if (!isAbsolute(dir)) throw new Error(`LIVE_DATA_DIR must be an absolute path, got "${dir}"`);
  if (isInside(repoRoot, dir)) {
    throw new Error(`LIVE_DATA_DIR must be outside the repo (${repoRoot}), got "${dir}"`);
  }
  return { mode, port, adminPort, dataDir: resolve(dir) };
}
