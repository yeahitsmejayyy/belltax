import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../config";
import { migrationStatus } from "../db/migrate";
import { bootDatabase, connect, DB_FILE } from "../db/open";
import { createBackup, latestBackup, restoreBackup, rotateBackups, verifyBackup } from "./backup";
import { assertLiveReady, BIND_HOST, checkHost, serverOptions, tightenPermissions } from "./hardening";

// Backups and hardening for the live instance, exercised on the demo world (never real data).

const PASS = "correct horse battery staple, demo only";
const tmp = mkdtempSync(join(tmpdir(), "btp-backup-test-"));
const dataDir = join(tmp, "demo");
const backupDir = join(tmp, "backups");
let db: Database;

beforeAll(async () => {
  ({ db } = await bootDatabase({ mode: "demo", port: 0, adminPort: 1, dataDir }, { anchor: new Date("2026-09-23T17:00:00.000Z") }));
});
afterAll(() => {
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

const sha = (path: string) => new Bun.CryptoHasher("sha256").update(readFileSync(path)).digest("hex");
const docCount = () => (db.query("SELECT COUNT(*) AS n FROM documents WHERE storage_key IS NOT NULL").get() as { n: number }).n;
const backup = (at?: Date) => createBackup({ db, dataDir, backupDir, passphrase: PASS, at });

describe("backup", () => {
  test("writes one encrypted, versioned file with nothing readable inside", async () => {
    const { file, manifest } = await backup(new Date("2026-09-24T10:00:00.000Z"));
    expect(file).toBe(join(backupDir, "belltaxprep-20260924T100000Z.btpbak"));
    expect(manifest).toMatchObject({ format: 1, schemaVersion: 1, uploads: { files: docCount() } });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const bytes = readFileSync(file);
    expect(bytes.subarray(0, 6).toString()).toBe("BTPBK1");
    for (const plaintext of ["SQLite format 3", "%PDF", "DEMO - NOT A REAL DOCUMENT", "example.test"]) {
      expect(bytes.includes(Buffer.from(plaintext))).toBe(false);
    }
    expect(readdirSync(backupDir).some((f) => f.endsWith(".partial"))).toBe(false);
  });

  test("the snapshot is consistent even while the server holds the database open", async () => {
    db.run("UPDATE households SET display_name = display_name WHERE 1 = 0"); // an open, live connection
    const { manifest } = await backup(new Date("2026-09-24T10:00:01.000Z"));
    expect(manifest.db.bytes).toBeGreaterThan(0);
  });

  test("refuses a weak passphrase or a backup folder inside the repo or the data dir", async () => {
    await expect(createBackup({ db, dataDir, backupDir, passphrase: "short" })).rejects.toThrow(/at least 20 characters/);
    await expect(createBackup({ db, dataDir, backupDir: join(import.meta.dir, "nope"), passphrase: PASS })).rejects.toThrow(/outside the repo/);
    await expect(createBackup({ db, dataDir, backupDir: join(dataDir, "backups"), passphrase: PASS })).rejects.toThrow(/separate from the data directory/);
  });
});

describe("verify and restore", () => {
  let file: string;
  beforeAll(async () => {
    file = (await backup(new Date("2026-09-24T11:00:00.000Z"))).file;
  });

  test("verify decrypts and checks the manifest without restoring anything", async () => {
    const m = await verifyBackup(file, PASS);
    expect(m.uploads.files).toBe(docCount());
  });

  test("a wrong passphrase or a single flipped byte is refused", async () => {
    await expect(verifyBackup(file, "definitely the wrong passphrase!!")).rejects.toThrow(/wrong passphrase, or the backup file is damaged/);
    const damaged = join(tmp, "damaged.btpbak");
    const bytes = readFileSync(file);
    bytes[Math.floor(bytes.length / 2)]! ^= 0xff;
    writeFileSync(damaged, bytes);
    await expect(verifyBackup(damaged, PASS)).rejects.toThrow(/damaged/);
  });

  test("restore rebuilds an identical, bootable live data directory", async () => {
    const target = join(tmp, "restored");
    const m = await restoreBackup(file, PASS, target);
    expect(sha(join(target, DB_FILE))).toBe(m.db.sha256);
    // Every upload comes back byte for byte.
    for (const f of readdirSync(join(dataDir, "uploads"))) {
      expect(sha(join(target, "uploads", f))).toBe(sha(join(dataDir, "uploads", f)));
    }
    const restored = connect(join(target, DB_FILE));
    expect(restored.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(restored.query("SELECT COUNT(*) AS n FROM households").get()).toEqual({ n: 25 });
    expect(migrationStatus(restored).pending).toEqual([]);
    restored.close();
    // It starts as a live instance: already migrated, never seeded.
    const booted = await bootDatabase({ mode: "live", port: 0, adminPort: 1, dataDir: target });
    expect(booted.seeded).toBeNull();
    booted.db.close();
    expect(JSON.parse(readFileSync(join(target, "restored-from.json"), "utf8")).file).toBe(file);
  });

  test("restore never writes over an existing directory", async () => {
    const busy = join(tmp, "busy");
    mkdirSync(busy);
    writeFileSync(join(busy, "keep.txt"), "don't touch");
    await expect(restoreBackup(file, PASS, busy)).rejects.toThrow(/must be empty/);
    expect(readFileSync(join(busy, "keep.txt"), "utf8")).toBe("don't touch");
  });
});

describe("rotation", () => {
  test("keeps the newest N of our own files and nothing else is touched", () => {
    const dir = join(tmp, "rotate");
    mkdirSync(dir);
    const names = ["20260901T000000Z", "20260902T000000Z", "20260903T000000Z", "20260904T000000Z"].map((s) => `belltaxprep-${s}.btpbak`);
    for (const n of [...names, "notes.txt"]) writeFileSync(join(dir, n), "x");
    expect(rotateBackups(dir, 2).sort()).toEqual(names.slice(0, 2));
    expect(readdirSync(dir).sort()).toEqual([...names.slice(2), "notes.txt"].sort());
    expect(latestBackup(dir)!.at.toISOString()).toBe("2026-09-04T00:00:00.000Z");
  });
});

describe("hardening", () => {
  const live = (dir: string): Config => ({ mode: "live", port: 3000, adminPort: 1, dataDir: dir });

  test("the server only ever binds to 127.0.0.1", () => {
    expect(BIND_HOST).toBe("127.0.0.1");
    expect(serverOptions(live(tmp)).hostname).toBe("127.0.0.1");
  });

  test("permissions are tightened to owner-only", () => {
    const dir = join(tmp, "perms");
    mkdirSync(join(dir, "uploads"), { recursive: true });
    writeFileSync(join(dir, "uploads", "a.pdf"), "x");
    writeFileSync(join(dir, DB_FILE), "x");
    chmodSync(dir, 0o755);
    chmodSync(join(dir, "uploads"), 0o755);
    chmodSync(join(dir, "uploads", "a.pdf"), 0o644);
    expect(tightenPermissions(dir).length).toBe(4);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(join(dir, "uploads")).mode & 0o777).toBe(0o700);
    expect(statSync(join(dir, "uploads", "a.pdf")).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, DB_FILE)).mode & 0o777).toBe(0o600);
  });

  test("live refuses to start on an unencrypted disk; unknown only warns", () => {
    const dir = join(tmp, "live-check");
    mkdirSync(dir);
    expect(() => assertLiveReady(live(dir), { probe: () => "off" })).toThrow(/full-disk encryption: OFF/);
    const checks = assertLiveReady(live(dir), { probe: () => "unknown" });
    expect(checks.find((c) => c.name === "full-disk encryption")!.status).toBe("warn");
    expect(checks.find((c) => c.name === "permissions")!.status).toBe("ok");
  });

  test("the check reports backup freshness", async () => {
    const recent = checkHost(live(dataDir), { probe: () => "on", backupDir, now: new Date("2026-09-24T12:00:00.000Z") });
    expect(recent.find((c) => c.name === "latest backup")!.status).toBe("ok");
    const stale = checkHost(live(dataDir), { probe: () => "on", backupDir, now: new Date("2026-10-10T12:00:00.000Z") });
    expect(stale.find((c) => c.name === "latest backup")!.status).toBe("warn");
    expect(existsSync(backupDir)).toBe(true);
  });
});
