import type { Database } from "bun:sqlite";
import { DEMO_USER_HEADER } from "../identity";
import { createFetchHandler } from "../http";

// Times the hot paths end to end: Request in, JSON out, through tRPC, zod, the access checks and the
// views, exactly as the admin and portal call them. Each case runs a few times after a warm-up; the
// median is what's compared to the budget.

export type BenchCase = { name: string; what: string; run: () => Promise<unknown> | unknown };
export type BenchResult = { name: string; what: string; medianMs: number; maxMs: number };

const ORIGIN = "http://127.0.0.1";

export function benchCases(db: Database): BenchCase[] {
  const admin = createFetchHandler({ surface: "admin", webDist: "/nonexistent" });
  const portal = createFetchHandler({ surface: "portal", webDist: "/nonexistent" });
  const pick = <T>(sql: string, ...p: (string | number)[]) => db.query(sql).get(...p) as T;
  const preparer = pick<{ id: string }>("SELECT id FROM users WHERE role = 'preparer' LIMIT 1").id;
  const year = pick<{ y: number }>("SELECT MAX(tax_year) AS y FROM engagements").y;
  // The busiest return: most events, documents and requests.
  const busy = pick<{ id: string }>(
    "SELECT engagement_id AS id FROM events WHERE engagement_id IS NOT NULL GROUP BY engagement_id ORDER BY COUNT(*) DESC LIMIT 1",
  ).id;
  const client = pick<{ user_id: string; engagement_id: string }>(
    "SELECT u.id AS user_id, rp.engagement_id FROM users u JOIN return_people rp ON rp.person_id = u.person_id AND rp.role = 'primary' JOIN engagements e ON e.id = rp.engagement_id WHERE e.tax_year = ? ORDER BY u.id DESC LIMIT 1",
    year,
  );
  const returning = pick<{ id: string } | null>(
    "SELECT e.id FROM engagements e WHERE e.tax_year = ? AND EXISTS (SELECT 1 FROM engagements p WHERE p.household_id = e.household_id AND p.tax_year = e.tax_year - 1) ORDER BY e.id DESC LIMIT 1",
    year,
  )?.id ?? busy;
  const deep = pick<{ occurred_at: string; id: string }>("SELECT occurred_at, id FROM events ORDER BY occurred_at, id LIMIT 1 OFFSET (SELECT COUNT(*) / 10 FROM events)");

  const call = async (surface: "admin" | "portal", as: string, path: string, input?: unknown) => {
    const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
    const res = await (surface === "admin" ? admin : portal)(new Request(`${ORIGIN}/trpc/${path}${qs}`, { headers: { [DEMO_USER_HEADER]: as } }));
    if (res.status !== 200) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  return [
    { name: "engagement.list", what: `the pipeline, every ${year} return`, run: () => call("admin", preparer, "engagement.list", { taxYear: year }) },
    { name: "engagement.detail", what: "the busiest return", run: () => call("admin", preparer, "engagement.detail", { engagementId: busy }) },
    { name: "inbox.list", what: "the triage queue", run: () => call("admin", preparer, "inbox.list", { taxYear: year }) },
    { name: "activity.list (first page)", what: "newest 50 events", run: () => call("admin", preparer, "activity.list") },
    { name: "activity.list (deep page)", what: "50 events from the oldest tenth", run: () => call("admin", preparer, "activity.list", { cursor: { occurredAt: deep.occurred_at, id: deep.id } }) },
    { name: "activity.list (views hidden)", what: "newest 50 changes", run: () => call("admin", preparer, "activity.list", { views: "hide" }) },
    { name: "household.list", what: "the Clients screen, by last activity", run: () => call("admin", preparer, "household.list") },
    { name: "engagement.mine", what: "a client's home (client_access)", run: () => call("portal", client.user_id, "engagement.mine") },
    { name: "client_access lookup", what: "one (user, return) check", run: () => db.query("SELECT 1 FROM client_access WHERE user_id = ? AND engagement_id = ? LIMIT 1").get(client.user_id, client.engagement_id) },
    { name: "expected_documents", what: "a returning client's checklist", run: () => db.query("SELECT * FROM expected_documents WHERE engagement_id = ?").all(returning) },
    { name: "invoice_balances", what: "every issued invoice's balance", run: () => db.query("SELECT settlement, COUNT(*), SUM(balance_cents) FROM invoice_balances WHERE status = 'issued' GROUP BY settlement").all() },
    { name: "invoice.list", what: "one return's invoices", run: () => call("admin", preparer, "invoice.list", { engagementId: busy }) },
  ];
}

export async function runBench(cases: BenchCase[], runs = 7): Promise<BenchResult[]> {
  const out: BenchResult[] = [];
  for (const c of cases) {
    await c.run(); // warm-up: statement cache, page cache
    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
      const t = performance.now();
      await c.run();
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    out.push({ name: c.name, what: c.what, medianMs: round(times[Math.floor(times.length / 2)]!), maxMs: round(times.at(-1)!) });
  }
  return out;
}

const round = (n: number) => Math.round(n * 10) / 10;

export const table = (results: BenchResult[], budgetMs: number) =>
  results
    .map((r) => `${r.medianMs <= budgetMs ? "✔" : "✖"} ${r.name.padEnd(30)} ${String(r.medianMs).padStart(8)} ms  (max ${r.maxMs})  ${r.what}`)
    .join("\n");

// The plan SQLite chose, for docs/performance.md.
export const explain = (db: Database, sql: string, ...params: (string | number)[]) =>
  (db.query(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((r) => r.detail).join("\n");
