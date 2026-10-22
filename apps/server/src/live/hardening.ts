import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isInside, REPO_ROOT, type Config } from "../config";
import { latestBackup } from "./backup";

// Is this machine fit to hold real client data? Run at every live boot and by `bun run live:check`.
// Failures stop a live boot; warnings are printed. See docs/live-runbook.md.

export const BIND_HOST = "127.0.0.1"; // never a public interface; the tunnel reaches the portal from outside
// The hosted public demo is the one exception: invented data only, in a container whose platform routes to it.
export const PUBLIC_DEMO_HOST = "0.0.0.0";
export const serverOptions = (config: Config) => ({ hostname: config.mode === "demo" && config.publicDemo ? PUBLIC_DEMO_HOST : BIND_HOST, port: config.port });
export const adminServerOptions = (config: Config) => ({ hostname: BIND_HOST, port: config.adminPort });

export type Check = { name: string; status: "ok" | "warn" | "fail"; detail: string };
export type DiskProbe = () => "on" | "off" | "unknown";

// Full-disk encryption on the machine holding the data. macOS: FileVault. Linux: root on dm-crypt/LUKS.
export const probeDiskEncryption: DiskProbe = () => {
  if (process.platform === "darwin") {
    const out = spawnSync("fdesetup", ["status"], { encoding: "utf8" }).stdout ?? "";
    if (/FileVault is On/.test(out)) return "on";
    if (/FileVault is Off/.test(out)) return "off";
    return "unknown";
  }
  if (process.platform === "linux") {
    const out = spawnSync("lsblk", ["-no", "TYPE,MOUNTPOINT"], { encoding: "utf8" }).stdout ?? "";
    if (/^crypt\s+\/\s*$/m.test(out) || /^crypt/m.test(out)) return "on";
    return out ? "off" : "unknown";
  }
  return "unknown";
};

// Owner-only access to everything under the data directory.
export function tightenPermissions(dataDir: string): string[] {
  const changed: string[] = [];
  const set = (path: string, mode: number) => {
    if (!existsSync(path)) return;
    if ((statSync(path).mode & 0o777) !== mode) {
      chmodSync(path, mode);
      changed.push(path);
    }
  };
  set(dataDir, 0o700);
  for (const name of readdirSync(dataDir)) {
    const p = join(dataDir, name);
    if (statSync(p).isDirectory()) {
      set(p, 0o700);
      for (const f of readdirSync(p)) if (statSync(join(p, f)).isFile()) set(join(p, f), 0o600);
    } else set(p, 0o600);
  }
  return changed;
}

// ---------- The tunnel (ticket 25) ----------
// Cloudflare Tunnel (cloudflared) carries the portal to the internet: outbound only, no open ports, HTTPS at
// Cloudflare. Its config file says where each public hostname goes; read it rather than trust a setting.

/** Where cloudflared's config lives: CLOUDFLARED_CONFIG, or cloudflared's own default. */
export const cloudflaredConfigPath = (env: NodeJS.ProcessEnv = process.env) => env.CLOUDFLARED_CONFIG ?? join(homedir(), ".cloudflared", "config.yml");

/** The tunnel config's text, if the file exists. */
export function readTunnelConfig(path = cloudflaredConfigPath()): { path: string; text: string } | null {
  return existsSync(path) ? { path, text: readFileSync(path, "utf8") } : null;
}

type IngressRule = { hostname?: string; service?: string; path?: string };

/**
 * Every route in the tunnel must reach the portal listener on this machine (and nothing else: never the admin,
 * another port or another host), and the last rule must refuse every other hostname with a 404.
 */
export function checkTunnelConfig(text: string, config: Pick<Config, "port" | "adminPort">, publicOrigin?: string): Check {
  const fail = (detail: string): Check => ({ name: "tunnel target", status: "fail", detail });
  let doc: { ingress?: IngressRule[] };
  try {
    doc = (Bun.YAML.parse(text) ?? {}) as { ingress?: IngressRule[] };
  } catch {
    return fail("the cloudflared config isn't valid YAML");
  }
  const rules = Array.isArray(doc.ingress) ? doc.ingress : [];
  if (!rules.length) return fail("the cloudflared config has no ingress rules");
  const portal = new RegExp(`^https?://(localhost|127\\.0\\.0\\.1):${config.port}/?$`);
  const routes = rules.filter((r) => r.hostname);
  for (const r of routes) {
    if (!portal.test(r.service ?? "")) {
      const admin = (r.service ?? "").includes(`:${config.adminPort}`);
      return fail(`${r.hostname} goes to ${r.service ?? "nothing"}: ${admin ? "that's the admin, which must never be on the internet" : `it must go to the portal, http://127.0.0.1:${config.port}`}`);
    }
  }
  const last = rules.at(-1)!;
  if (last.hostname || last.service !== "http_status:404") return fail("the last ingress rule must be `- service: http_status:404`, so any other hostname is refused");
  if (!routes.length) return fail("no hostname is routed to the portal");
  const hosts = routes.map((r) => r.hostname!);
  if (publicOrigin) {
    const want = new URL(publicOrigin).host;
    if (!hosts.includes(want)) return { name: "tunnel target", status: "warn", detail: `PUBLIC_ORIGIN is ${want}, but the tunnel serves ${hosts.join(", ")}` };
  }
  return { name: "tunnel target", status: "ok", detail: `${hosts.join(", ")} → the portal (:${config.port}) only; every other hostname gets 404` };
}

export function checkHost(
  config: Config,
  opts: { probe?: DiskProbe; backupDir?: string; now?: Date; fixPermissions?: boolean; tunnelTargetPort?: number; tunnelConfig?: { path: string; text: string } | null; publicOrigin?: string } = {},
): Check[] {
  const checks: Check[] = [];
  const add = (name: string, status: Check["status"], detail: string) => checks.push({ name, status, detail });

  const bound = [serverOptions(config), adminServerOptions(config)].every((o) => o.hostname === BIND_HOST);
  add("bind address", bound ? "ok" : "fail", `portal :${config.port} and admin :${config.adminPort}, both on ${BIND_HOST} only`);

  // The tunnel: its own config file when there is one (the truth); otherwise TUNNEL_TARGET_PORT, a note of where
  // it points.
  const target = opts.tunnelTargetPort;
  if (opts.tunnelConfig) {
    const c = checkTunnelConfig(opts.tunnelConfig.text, config, opts.publicOrigin);
    add(c.name, c.status, `${c.detail} (${opts.tunnelConfig.path})`);
  } else add(
    "tunnel target",
    target === undefined ? "warn" : target === config.port ? "ok" : "fail",
    target === undefined
      ? `no cloudflared config found (CLOUDFLARED_CONFIG or ~/.cloudflared/config.yml); set up the tunnel per docs/live-runbook.md`
      : target === config.port
        ? `forwards the portal (:${target}) only`
        : `forwards :${target} — it must forward the portal (:${config.port}), never the admin (:${config.adminPort})`,
  );

  const disk = (opts.probe ?? probeDiskEncryption)();
  add(
    "full-disk encryption",
    disk === "on" ? "ok" : disk === "off" ? "fail" : "warn",
    disk === "on" ? "on" : disk === "off" ? "OFF — turn on FileVault / LUKS before storing client data" : "couldn't tell; check by hand (docs/live-runbook.md)",
  );

  add("data directory", isInside(REPO_ROOT, config.dataDir) ? "fail" : "ok", config.dataDir);

  if (existsSync(config.dataDir)) {
    const changed = opts.fixPermissions ? tightenPermissions(config.dataDir) : [];
    const mode = statSync(config.dataDir).mode & 0o777;
    const uploads = join(config.dataDir, "uploads");
    const uploadsMode = existsSync(uploads) ? statSync(uploads).mode & 0o777 : 0o700;
    const tight = mode === 0o700 && uploadsMode === 0o700;
    add("permissions", tight ? "ok" : "fail", tight ? `owner only${changed.length ? ` (tightened ${changed.length})` : ""}` : `data ${mode.toString(8)}, uploads ${uploadsMode.toString(8)} — should be 700`);
  }

  if (opts.backupDir) {
    const latest = latestBackup(opts.backupDir);
    const ageH = latest ? ((opts.now ?? new Date()).getTime() - latest.at.getTime()) / 3_600_000 : Infinity;
    add("latest backup", ageH <= 26 ? "ok" : "warn", latest ? `${Math.round(ageH)} h ago: ${latest.file}` : "none yet — run bun run backup");
  } else {
    add("latest backup", "warn", "BACKUP_DIR not set");
  }
  return checks;
}

// Live boot refuses on any failure. Demo never calls this.
export function assertLiveReady(config: Config, opts: Parameters<typeof checkHost>[1] = {}) {
  const checks = checkHost(config, { fixPermissions: true, ...opts });
  const failed = checks.filter((c) => c.status === "fail");
  if (failed.length) throw new Error(`live instance isn't safe to start: ${failed.map((c) => `${c.name}: ${c.detail}`).join("; ")}`);
  return checks;
}
