import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isInside, REPO_ROOT, type Config } from "../config";
import { latestBackup } from "./backup";

// Is this machine fit to hold real client data? Run at every live boot and by `bun run live:check`.
// Failures stop a live boot; warnings are printed. See docs/live-runbook.md.

export const BIND_HOST = "127.0.0.1"; // never a public interface; the tunnel reaches the portal from outside
export const serverOptions = (config: Config) => ({ hostname: BIND_HOST, port: config.port });

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

export function checkHost(
  config: Config,
  opts: { probe?: DiskProbe; backupDir?: string; now?: Date; fixPermissions?: boolean } = {},
): Check[] {
  const checks: Check[] = [];
  const add = (name: string, status: Check["status"], detail: string) => checks.push({ name, status, detail });

  add("bind address", serverOptions(config).hostname === BIND_HOST ? "ok" : "fail", `listens on ${serverOptions(config).hostname} only`);

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
