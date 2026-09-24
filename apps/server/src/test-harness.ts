import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useRuntime } from "./db/client";
import { applySchema } from "./db/schema";
import { seedDemo } from "./db/seed/seed";
import { createFetchHandler } from "./http";
import { DEMO_USER_HEADER } from "./identity";
import { createStorage } from "./storage";

// Test-only: a seeded demo world behind the real fetch handler, and a tiny tRPC-over-HTTP client.

export const ORIGIN = "http://127.0.0.1";
export const ANCHOR = new Date("2026-09-23T17:00:00.000Z");

export async function demoWorld() {
  const tmp = mkdtempSync(join(tmpdir(), "btp-harness-"));
  const storage = createStorage(join(tmp, "files"));
  const db = new Database(":memory:", { strict: true });
  await applySchema(db);
  seedDemo(db, { storage, anchor: ANCHOR });
  const handler = createFetchHandler({ webDist: join(tmp, "dist") });
  const use = (mode: "demo" | "live" = "demo") => useRuntime({ db, storage, mode });
  use();

  const get = <T>(sql: string, ...p: (string | number)[]) => db.query(sql).get(...p) as T;
  const all = <T>(sql: string, ...p: (string | number)[]) => db.query(sql).all(...p) as T[];

  async function call(as: string | null, path: string, input: unknown, kind: "query" | "mutation" = "query") {
    const headers: Record<string, string> = as ? { [DEMO_USER_HEADER]: as } : {};
    const url = `${ORIGIN}/trpc/${path}`;
    const res =
      kind === "query"
        ? await handler(new Request(`${url}?input=${encodeURIComponent(JSON.stringify(input))}`, { headers }))
        : await handler(
            new Request(url, { method: "POST", headers: { ...headers, "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify(input) }),
          );
    const body = (await res.json()) as { result?: { data: unknown }; error?: { message: string } };
    return { status: res.status, data: body.result?.data, error: body.error };
  }

  const preparerId = get<{ id: string }>("SELECT id FROM users WHERE role = 'preparer'").id;
  const eventsOf = (type: string, subjectId: string) =>
    all<{ reason: string | null; data: string }>("SELECT reason, data FROM events WHERE type = ? AND subject_id = ?", type, subjectId);

  return { db, storage, handler, use, get, all, call, preparerId, eventsOf, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}
