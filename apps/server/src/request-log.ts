import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Surface } from "./identity";

// One line per HTTP request: when, which listener, method, route pattern, status, duration and who
// (a user id, or "-"). Never the raw path, a query string, a header or a body: those are where client
// data lives. Demo writes to stdout; live also appends to <dataDir>/logs/requests.log, rotated by size.

export type RequestLogEntry = { surface: Surface; method: string; route: string; status: number; ms: number; user: string | null };
export type RequestLog = (entry: RequestLogEntry) => void;

const ID = /^[0-9a-f-]{36}$/;
const PROCEDURES = /^[a-zA-Z]+(\.[a-zA-Z]+)*(,[a-zA-Z]+(\.[a-zA-Z]+)*)*$/;

// The pattern a path matched, not the path itself.
export function routeOf(pathname: string): string {
  if (pathname.startsWith("/trpc/")) {
    const names = pathname.slice("/trpc/".length);
    return PROCEDURES.test(names) && names.length <= 300 ? `/trpc/${names}` : "/trpc/:unknown";
  }
  if (pathname === "/api/documents") return pathname;
  const parts = pathname.split("/");
  if (parts.length === 5 && parts[1] === "api" && parts[2] === "documents" && ID.test(parts[3]!) && parts[4] === "file") return "/api/documents/:id/file";
  if (pathname.startsWith("/api/")) return "/api/:unknown";
  if (pathname === "/health") return pathname;
  if (pathname.startsWith("/assets/")) return "/assets/*";
  return "/*"; // the app shell and its client routes
}

export const formatLine = (e: RequestLogEntry, at = new Date()) =>
  `${at.toISOString()} ${e.surface} ${e.method} ${e.route} ${e.status} ${e.ms}ms ${e.user ?? "-"}`;

const MAX_BYTES = 5 * 1024 * 1024;
const KEEP = 5; // requests.log.1 … requests.log.5

export function fileLog(dataDir: string, maxBytes = MAX_BYTES): (line: string) => void {
  const dir = join(dataDir, "logs");
  const file = join(dir, "requests.log");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return (line) => {
    if (existsSync(file) && statSync(file).size >= maxBytes) {
      rmSync(`${file}.${KEEP}`, { force: true });
      for (let i = KEEP - 1; i >= 1; i--) if (existsSync(`${file}.${i}`)) renameSync(`${file}.${i}`, `${file}.${i + 1}`);
      renameSync(file, `${file}.1`);
    }
    appendFileSync(file, `${line}\n`, { mode: 0o600 });
  };
}

export function createRequestLog(opts: { mode: "demo" | "live"; dataDir: string }): RequestLog {
  const toFile = opts.mode === "live" ? fileLog(opts.dataDir) : null;
  return (entry) => {
    const line = formatLine(entry);
    console.log(line);
    toFile?.(line);
  };
}
