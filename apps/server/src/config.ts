import { isAbsolute, relative, resolve } from "node:path";
import { RunMode } from "@app/schema";

export const REPO_ROOT = resolve(import.meta.dir, "../../..");

export type Config = {
  mode: RunMode;
  port: number; // the portal listener: the only one a tunnel may forward
  adminPort: number; // the admin listener: this machine only, never forwarded
  dataDir: string;
  // The hosted public demo (docs/demo-deploy.md): invented data on a public interface, the admin mounted at
  // /admin/ on the one listener, uploads off, re-seeded every resetHours. Demo mode only, never live.
  publicDemo: { resetHours: number } | null;
  // Stripe, TEST mode only (ticket 09): both keys or neither. Without them the portal's Pay button stays off.
  stripe?: StripeConfig | null;
  // Where sign-in links point (ticket 05): the portal clients use, and the admin the preparer uses.
  links?: Links;
};

export type Links = { portal: string; admin: string };

// Invite and reset links are copied by the preparer and opened elsewhere, so they need full addresses.
// PUBLIC_ORIGIN is the portal's public address (the tunnel, or the hosted demo); the admin is this machine,
// except on the hosted demo, where it's mounted at /admin on the same address.
export function linksFor(env: Env, mode: RunMode, port: number, adminPort: number, publicDemo: boolean): Links {
  const trim = (s: string) => s.replace(/\/$/, "");
  const pub = env.PUBLIC_ORIGIN ? trim(env.PUBLIC_ORIGIN) : null;
  if (mode === "live") return { portal: pub ?? `http://127.0.0.1:${port}`, admin: env.ADMIN_ORIGIN ? trim(env.ADMIN_ORIGIN) : `http://127.0.0.1:${adminPort}` };
  if (publicDemo && pub) return { portal: pub, admin: `${pub}/admin` };
  return { portal: pub ?? "http://localhost:5173", admin: env.ADMIN_ORIGIN ? trim(env.ADMIN_ORIGIN) : "http://localhost:5174" };
}

export type StripeConfig = { secretKey: string; webhookSecret: string; publicOrigin: string };

// Test keys only, both or neither. A live key refuses to boot: real money waits for a deliberate decision.
export function loadStripe(env: Env): StripeConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey && !webhookSecret) return null;
  if (!secretKey || !webhookSecret) throw new Error("Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, or neither");
  if (/^(sk|rk)_live_/.test(secretKey)) throw new Error("STRIPE_SECRET_KEY is a live key. Only test keys (sk_test_…) are allowed");
  if (!/^(sk|rk)_test_/.test(secretKey)) throw new Error("STRIPE_SECRET_KEY must be a Stripe test key (sk_test_…)");
  if (!webhookSecret.startsWith("whsec_")) throw new Error("STRIPE_WEBHOOK_SECRET must be a webhook signing secret (whsec_…)");
  const publicOrigin = (env.PUBLIC_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");
  return { secretKey, webhookSecret, publicOrigin };
}

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

  const wantsPublic = env.DEMO_PUBLIC !== undefined && env.DEMO_PUBLIC !== "" && env.DEMO_PUBLIC !== "0";
  if (wantsPublic && mode !== "demo") {
    throw new Error("DEMO_PUBLIC is for the hosted demo only: it can never be set with RUN_MODE=live");
  }

  if (mode === "demo") {
    let publicDemo: Config["publicDemo"] = null;
    if (wantsPublic) {
      const resetHours = Number(env.DEMO_RESET_HOURS ?? 6);
      if (!Number.isFinite(resetHours) || resetHours <= 0) throw new Error(`DEMO_RESET_HOURS must be a positive number, got "${env.DEMO_RESET_HOURS}"`);
      publicDemo = { resetHours };
    }
    return { mode, port, adminPort, dataDir: resolve(repoRoot, "data/demo"), publicDemo, stripe: loadStripe(env), links: linksFor(env, mode, port, adminPort, !!publicDemo) };
  }

  // Live mode never guesses where real data goes.
  const dir = env.LIVE_DATA_DIR;
  if (!dir) throw new Error("RUN_MODE=live requires LIVE_DATA_DIR");
  if (!isAbsolute(dir)) throw new Error(`LIVE_DATA_DIR must be an absolute path, got "${dir}"`);
  if (isInside(repoRoot, dir)) {
    throw new Error(`LIVE_DATA_DIR must be outside the repo (${repoRoot}), got "${dir}"`);
  }
  return { mode, port, adminPort, dataDir: resolve(dir), publicDemo: null, stripe: loadStripe(env), links: linksFor(env, mode, port, adminPort, false) };
}
