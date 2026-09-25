import type { Database } from "bun:sqlite";
import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { chmodSync, createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, appendFileSync, openSync, readSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { now, PRODUCT_NAME } from "@app/schema";
import { isInside, REPO_ROOT } from "../config";
import { DB_FILE } from "../db/open";

// Encrypted, versioned backups of a data directory: a consistent snapshot of the database
// (VACUUM INTO — safe while the server runs; a file copy of a live WAL database is not), the uploads,
// and a manifest, tarred, gzipped and sealed with AES-256-GCM under a passphrase-derived key (scrypt).
//
// File format: "BTPBK1" · salt (16) · iv (12) · ciphertext · GCM tag (16)
// Restores go into an empty directory only, and nothing is extracted until the tag verifies.

const MAGIC = Buffer.from("BTPBK1");
const HEADER = MAGIC.length + 16 + 12;
const TAG = 16;
const EXT = ".btpbak";
export const MIN_PASSPHRASE = 20;

export type Manifest = {
  format: 1;
  product: string;
  createdAt: string;
  schemaVersion: number;
  db: { sha256: string; bytes: number };
  uploads: { files: number; bytes: number };
};

const sha256File = (path: string) => new Bun.CryptoHasher("sha256").update(readFileSync(path)).digest("hex");
const keyFrom = (passphrase: string, salt: Buffer) => scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

function checkPassphrase(passphrase: string | undefined): string {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE) {
    throw new Error(`BACKUP_PASSPHRASE must be at least ${MIN_PASSPHRASE} characters. Keep it in your password manager, never in the repo.`);
  }
  return passphrase;
}

function checkBackupDir(backupDir: string, dataDir: string) {
  if (isInside(REPO_ROOT, backupDir)) throw new Error(`BACKUP_DIR must be outside the repo (${REPO_ROOT}), got ${backupDir}`);
  if (isInside(dataDir, backupDir) || isInside(backupDir, dataDir)) throw new Error("BACKUP_DIR must be separate from the data directory it backs up");
}

function uploadsStats(dir: string) {
  if (!existsSync(dir)) return { files: 0, bytes: 0 };
  const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
  return { files: files.length, bytes: files.reduce((n, f) => n + statSync(join(dir, f)).size, 0) };
}

function run(cmd: string, args: string[], opts: { stdoutTo?: NodeJS.WritableStream } = {}) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", opts.stdoutTo ? "pipe" : "ignore", "pipe"] });
    let err = "";
    p.stderr!.on("data", (d) => (err += d));
    const done = new Promise<void>((res, rej) => p.on("close", (code) => (code === 0 ? res() : rej(new Error(`${cmd} failed: ${err.trim()}`)))));
    if (opts.stdoutTo) p.stdout!.pipe(opts.stdoutTo); // ends the destination when tar finishes
    done.then(resolve, reject);
  });
}

export async function createBackup(opts: {
  db: Database;
  dataDir: string;
  backupDir: string;
  passphrase: string | undefined;
  at?: Date;
}): Promise<{ file: string; manifest: Manifest }> {
  const passphrase = checkPassphrase(opts.passphrase);
  checkBackupDir(opts.backupDir, opts.dataDir);
  mkdirSync(opts.backupDir, { recursive: true, mode: 0o700 });
  const staging = mkdtempSync(join(tmpdir(), "btp-backup-"));
  chmodSync(staging, 0o700);
  try {
    // 1. Consistent snapshot of the database.
    const snapshot = join(staging, DB_FILE);
    opts.db.run("VACUUM INTO ?", [snapshot]);
    const schemaVersion =
      (opts.db.query("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number | null } | null)?.v ?? 0;
    const manifest: Manifest = {
      format: 1,
      product: PRODUCT_NAME,
      createdAt: (opts.at ?? new Date()).toISOString(),
      schemaVersion,
      db: { sha256: sha256File(snapshot), bytes: statSync(snapshot).size },
      uploads: uploadsStats(join(opts.dataDir, "uploads")),
    };
    writeFileSync(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2));

    // 2. tar + gzip, streamed straight into the cipher. Uploads are read in place, never copied.
    const stamp = manifest.createdAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const file = join(opts.backupDir, `${PRODUCT_NAME}-${stamp}${EXT}`);
    const partial = `${file}.partial`;
    const tarArgs = ["-czf", "-", "-C", staging, DB_FILE, "manifest.json"];
    if (existsSync(join(opts.dataDir, "uploads"))) tarArgs.push("-C", opts.dataDir, "uploads");
    await sealTar(tarArgs, file, passphrase);
    return { file, manifest };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

// tar + gzip streamed into AES-256-GCM, written as "BTPBK1" · salt · iv · ciphertext · tag. Shared with
// the client record export (export/household.ts), which seals a folder the same way.
export async function sealTar(tarArgs: string[], file: string, passphrase: string) {
  const partial = `${file}.partial`;
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(passphrase, salt), iv);
  writeFileSync(partial, Buffer.concat([MAGIC, salt, iv]), { mode: 0o600 });
  const out = createWriteStream(partial, { flags: "a" });
  const sealed = pipeline(cipher, out);
  await run("tar", tarArgs, { stdoutTo: cipher });
  await sealed;
  appendFileSync(partial, cipher.getAuthTag());
  renameSync(partial, file); // a sealed file either exists whole or not at all
}

// Decrypt a sealed file and extract it into `target`, verifying the GCM tag before anything is extracted.
export async function unsealTo(file: string, passphrase: string | undefined, target: string) {
  const { dir, archive } = await decryptToTemp(file, checkPassphrase(passphrase));
  try {
    mkdirSync(target, { recursive: true, mode: 0o700 });
    await run("tar", ["-xzf", archive, "-C", target]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export { checkPassphrase };

// Decrypt to a private temp archive, verifying the GCM tag before anything is trusted.
async function decryptToTemp(file: string, passphrase: string): Promise<{ dir: string; archive: string }> {
  const size = statSync(file).size;
  if (size < HEADER + TAG) throw new Error("not a backup file (too short)");
  const fd = openSync(file, "r");
  const head = Buffer.alloc(HEADER);
  const tag = Buffer.alloc(TAG);
  readSync(fd, head, 0, HEADER, 0);
  readSync(fd, tag, 0, TAG, size - TAG);
  closeSync(fd);
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("not a backup file (bad header)");
  const salt = head.subarray(MAGIC.length, MAGIC.length + 16);
  const iv = head.subarray(MAGIC.length + 16, HEADER);
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  const dir = mkdtempSync(join(tmpdir(), "btp-restore-"));
  chmodSync(dir, 0o700);
  const archive = join(dir, "backup.tar.gz");
  try {
    await pipeline(createReadStream(file, { start: HEADER, end: size - TAG - 1 }), decipher, createWriteStream(archive, { mode: 0o600 }));
  } catch {
    rmSync(dir, { recursive: true, force: true });
    throw new Error("wrong passphrase, or the backup file is damaged");
  }
  return { dir, archive };
}

function checkRestored(target: string): Manifest {
  const manifest = JSON.parse(readFileSync(join(target, "manifest.json"), "utf8")) as Manifest;
  const dbFile = join(target, DB_FILE);
  if (sha256File(dbFile) !== manifest.db.sha256) throw new Error("restored database doesn't match its manifest");
  const up = uploadsStats(join(target, "uploads"));
  if (up.files !== manifest.uploads.files || up.bytes !== manifest.uploads.bytes) throw new Error("restored uploads don't match the manifest");
  return manifest;
}

// Decrypt and check a backup without restoring it anywhere.
export async function verifyBackup(file: string, passphrase: string | undefined): Promise<Manifest> {
  const { dir, archive } = await decryptToTemp(file, checkPassphrase(passphrase));
  try {
    const out = join(dir, "x");
    mkdirSync(out);
    await run("tar", ["-xzf", archive, "-C", out]);
    return checkRestored(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Restore into a new, empty directory. Never over an existing data directory.
export async function restoreBackup(file: string, passphrase: string | undefined, target: string): Promise<Manifest> {
  if (existsSync(target) && readdirSync(target).length) throw new Error(`restore target must be empty or not exist yet: ${target}`);
  if (isInside(REPO_ROOT, target)) throw new Error("restore target must be outside the repo");
  const { dir, archive } = await decryptToTemp(file, checkPassphrase(passphrase));
  try {
    mkdirSync(target, { recursive: true, mode: 0o700 });
    await run("tar", ["-xzf", archive, "-C", target]);
    const manifest = checkRestored(target);
    rmSync(join(target, "manifest.json"));
    writeFileSync(join(target, "restored-from.json"), JSON.stringify({ file, restoredAt: now(), manifest }, null, 2), { mode: 0o600 });
    return manifest;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Keep the newest `keep` backups; delete the rest. Only touches files this tool named.
export function rotateBackups(backupDir: string, keep: number): string[] {
  if (!Number.isInteger(keep) || keep < 1) throw new Error("BACKUP_KEEP must be a positive integer");
  const ours = new RegExp(`^${PRODUCT_NAME}-\\d{8}T\\d{6}Z\\${EXT}$`);
  const files = readdirSync(backupDir).filter((f) => ours.test(f)).sort().reverse();
  const doomed = files.slice(keep);
  for (const f of doomed) rmSync(join(backupDir, f));
  return doomed;
}

export function latestBackup(backupDir: string): { file: string; at: Date } | null {
  if (!existsSync(backupDir)) return null;
  const ours = new RegExp(`^${PRODUCT_NAME}-(\\d{8}T\\d{6}Z)\\${EXT}$`);
  const newest = readdirSync(backupDir).filter((f) => ours.test(f)).sort().at(-1);
  if (!newest) return null;
  const s = newest.match(ours)![1]!;
  const at = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`);
  return { file: join(backupDir, newest), at };
}
