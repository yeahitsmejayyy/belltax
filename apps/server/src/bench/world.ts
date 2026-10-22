import type { Database } from "bun:sqlite";
import { seedDemo } from "../db/seed/seed";
import { HOUSEHOLD_SCOPE } from "../export/household";
import type { Storage } from "../storage";

// A big demo world for measuring, never for live. Seeds the usual 25 households, then clones them
// `copies - 1` more times with fresh ids, so the mix of stages, letters, invoices, payments and events is
// the demo's own (every row went through the same gates once). Files are not copied: metadata only.
// On top, each return gets a few view events, as a busy season with the access log (ticket 32) would.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

// Insert order that satisfies the foreign keys and triggers.
const TABLES = [
  "households", "people", "users", "reminder_preferences", "household_access", "engagement_letters", "engagements", "return_people",
  "intake_responses", "sources", "source_owners", "return_sources", "requests", "documents", "signatures",
  "invoices", "invoice_lines", "invoice_included", "payments", "efile_submissions", "household_exports", "events",
] as const;
const ORDER: Partial<Record<(typeof TABLES)[number], string>> = {
  engagements: "kind DESC, created_at", // originals before the amendments that point at them
  documents: "created_at, id", // superseded before superseding
  events: "occurred_at, id",
};

export type BenchSummary = { households: number; returns: number; documents: number; events: number; requests: number; invoices: number };

export function seedBench(db: Database, opts: { storage: Storage; copies: number; anchor?: Date; viewsPerReturn?: number; history?: boolean }): BenchSummary {
  seedDemo(db, { storage: opts.storage, anchor: opts.anchor });
  // The seed wrote demo PDFs; the bench keeps their rows but never reads the files.
  const originals = Object.fromEntries(
    TABLES.map((t) => {
      let rows = db.query<Record<string, unknown>, []>(`SELECT * FROM ${t} ORDER BY ${ORDER[t] ?? "rowid"}`).all();
      if (t === "users") rows = rows.filter((r) => r.role === "client"); // one preparer, shared by every copy
      if (t === "events") rows = rows.filter((r) => r.household_id !== null || r.engagement_id !== null);
      return [t, rows];
    }),
  ) as Record<(typeof TABLES)[number], Record<string, unknown>[]>;

  // Every id that belongs to a household gets a fresh one per copy; the preparer's and the practice's don't.
  const cloneable = new Set<string>();
  for (const t of TABLES) for (const r of originals[t]) if (typeof r.id === "string") cloneable.add(r.id);

  const insert = new Map<string, ReturnType<Database["prepare"]>>();
  const stmt = (table: string, cols: string[]) => {
    const key = `${table}:${cols.join(",")}`;
    if (!insert.has(key)) insert.set(key, db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`));
    return insert.get(key)!;
  };

  for (let k = 1; k < opts.copies; k++) {
    const tag = k.toString(16).padStart(8, "0");
    // Same length and shape as a UUID: the first group becomes the copy number. The seed's ids all share
    // that group (it's the high bits of one timestamp) and differ after it, so copies can't collide.
    const remap = (v: unknown): unknown =>
      typeof v === "string" ? v.replace(UUID, (id) => (cloneable.has(id) ? `${tag}${id.slice(8)}` : id)) : v;

    db.transaction(() => {
      for (const t of TABLES) {
        for (const row of originals[t]) {
          const r: Record<string, unknown> = {};
          for (const [c, v] of Object.entries(row)) r[c] = remap(v);
          if (t === "households") r.display_name = `${row.display_name as string} ${k + 1}`;
          if (t === "users") r.email = `c${k}.${row.email as string}`;
          if (t === "invoices") {
            const n = row.number as string; // "2025-0003" → "2025-0120003": still year-digits, unique per copy
            r.number = `${n.slice(0, 5)}${String(k).padStart(3, "0")}${n.slice(5)}`;
            r.status = "draft"; // lines first; the real status is restored below
          }
          if (t === "payments" && row.checkout_session_id) r.checkout_session_id = `${row.checkout_session_id as string}_${k}`;
          if (t === "payments") {
            const inv = r.invoice_id as string;
            db.run("UPDATE invoices SET status = 'issued' WHERE id = ? AND status = 'draft'", [inv]);
          }
          const cols = Object.keys(r);
          stmt(t, cols).run(...(cols.map((c) => r[c]) as never[]));
        }
      }
      // Restore each invoice's real status (draft → issued → void only moves forward).
      for (const inv of originals.invoices) {
        const id = remap(inv.id) as string;
        if (inv.status !== "draft") db.run("UPDATE invoices SET status = 'issued' WHERE id = ? AND status = 'draft'", [id]);
        if (inv.status === "void") db.run("UPDATE invoices SET status = 'void' WHERE id = ?", [id]);
      }
    })();
  }

  // History: a returning client has last year's completed return behind this year's. Every original
  // return without one gets it (same people, the sources that were open then), so the checklist view
  // (expected_documents) has real work to do, as it will from the second season on.
  if (opts.history ?? true) {
    const DAY = 86_400_000;
    const current = db
      .query<{ id: string; household_id: string; tax_year: number; filing_status: string | null; created_at: string }, []>(
        `SELECT e.id, e.household_id, e.tax_year, e.filing_status, e.created_at FROM engagements e
          WHERE e.kind = 'original' AND e.tax_year = (SELECT MAX(tax_year) FROM engagements)
            AND NOT EXISTS (SELECT 1 FROM return_people rp JOIN return_people prev ON prev.person_id = rp.person_id AND prev.tax_year = e.tax_year - 1
                             WHERE rp.engagement_id = e.id)`,
      )
      .all();
    const people = db.prepare("SELECT person_id, role, relationship, months_lived_with FROM return_people WHERE engagement_id = ?");
    const sources = db.prepare(
      "SELECT s.id FROM sources s WHERE s.household_id = ? AND (s.first_year IS NULL OR s.first_year <= ?) AND (s.last_year IS NULL OR s.last_year >= ?)",
    );
    db.transaction(() => {
      for (const e of current) {
        const id = Bun.randomUUIDv7();
        const year = e.tax_year - 1;
        const created = new Date(Date.parse(e.created_at) - 330 * DAY).toISOString();
        const done = new Date(Date.parse(e.created_at) - 200 * DAY).toISOString();
        db.run(
          "INSERT INTO engagements (id, household_id, tax_year, kind, filing_status, stage, stage_changed_at, created_at) VALUES (?, ?, ?, 'original', ?, 'complete', ?, ?)",
          [id, e.household_id, year, e.filing_status, done, created],
        );
        for (const p of people.all(e.id) as { person_id: string; role: string; relationship: string | null; months_lived_with: number | null }[]) {
          db.run(
            "INSERT INTO return_people (engagement_id, person_id, tax_year, engagement_kind, role, relationship, months_lived_with) VALUES (?, ?, ?, 'original', ?, ?, ?)",
            [id, p.person_id, year, p.role, p.relationship, p.months_lived_with],
          );
        }
        for (const s of sources.all(e.household_id, year, year) as { id: string }[]) db.run("INSERT INTO return_sources (engagement_id, source_id) VALUES (?, ?)", [id, s.id]);
        db.run(
          `INSERT INTO events (id, occurred_at, actor_kind, actor_user_id, household_id, engagement_id, type, subject_type, subject_id, data)
           VALUES (?, ?, 'system', NULL, ?, ?, 'engagement.created', 'engagement', ?, '{"bench_history":true}')`,
          [Bun.randomUUIDv7(), created, e.household_id, id, id],
        );
      }
    })();
  }

  // Views: the preparer opens each return a few times over the season, and clients read their documents.
  const views = opts.viewsPerReturn ?? 6;
  if (views > 0) {
    const preparer = db.query<{ id: string }, []>("SELECT id FROM users WHERE role = 'preparer' LIMIT 1").get()!.id;
    const returns = db.query<{ id: string; household_id: string; created_at: string }, []>("SELECT id, household_id, created_at FROM engagements").all();
    const ev = db.prepare(
      `INSERT INTO events (id, occurred_at, actor_kind, actor_user_id, household_id, engagement_id, type, subject_type, subject_id, data)
       VALUES (?, ?, 'preparer', ?, ?, ?, 'engagement.viewed', 'engagement', ?, '{}')`,
    );
    db.transaction(() => {
      for (const r of returns) {
        const start = Date.parse(r.created_at);
        for (let i = 0; i < views; i++) {
          const at = new Date(start + (i + 1) * 3_600_000 * 7).toISOString();
          ev.run(Bun.randomUUIDv7(), at, preparer, r.household_id, r.id, r.id);
        }
      }
    })();
  }

  // No ANALYZE: live databases never run it, so the planner here sees what it sees there.
  const n = (t: string) => (db.query(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  return { households: n("households"), returns: n("engagements"), documents: n("documents"), events: n("events"), requests: n("requests"), invoices: n("invoices") };
}

// Every household-scoped table is cloned; a new one must be added to TABLES (the bench test checks).
export const BENCH_TABLES: readonly string[] = TABLES;
export const HOUSEHOLD_TABLES = Object.keys(HOUSEHOLD_SCOPE);
