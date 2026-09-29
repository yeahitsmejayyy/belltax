import type { Database } from "bun:sqlite";
import { SearchInput, SearchResults, type SearchHit } from "@app/schema";
import { runtime } from "../db/client";
import type { SessionUser } from "../identity";
import { preparerProcedure, router } from "../trpc";

// ⌘K and the header search (admin 26-dialogs-and-sheets-cmdk): clients, people, returns and invoices.
//
// Matching is by word prefix, case-insensitive: every typed word must start a word in the record ("dan mari"
// finds Dana Marigold). Plain SQL over the tables, no search index: ~6 ms at 2,000 households and ~30 ms at
// 10,000 (docs/performance.md), so an FTS5 table and the triggers to keep it in sync would be machinery
// without a need. Exact matches rank first, then label-starts-with, then the rest, alphabetically.
//
// It never searches identifying numbers: SSNs aren't stored (only the last four, which aren't searchable),
// and anything typed that looks like a full SSN returns nothing at all.

const PER_GROUP = 8;
const SSN_LIKE = /^\d{3}[- ]?\d{2}[- ]?\d{4}$/;

type Hit = SearchHit & { rank: number };

// "  Dana   MARI " → ["dana", "mari"]. Wildcards typed by the user are taken literally.
// Split the same way the text is ("2026-0014" → "2026", "0014"), so what you type lines up with what's stored.
const words = (q: string) =>
  q.toLowerCase().replace(/[&\-@.·]/g, " ").replace(/[%_\\]/g, (c) => `\\${c}`).split(/\s+/).filter(Boolean).slice(0, 6);

// A WHERE fragment: each word starts some word of `text` (words split on space, &, ·, -, @ and .).
function wordPrefix(text: string, ws: string[], params: string[]) {
  const spaced = `(' ' || replace(replace(replace(replace(replace(lower(${text}), '&', ' '), '-', ' '), '@', ' '), '.', ' '), '·', ' '))`;
  return ws
    .map((w) => {
      params.push(`% ${w}%`);
      return `${spaced} LIKE ?${params.length} ESCAPE '\\'`;
    })
    .join(" AND ");
}

function rank(label: string, q: string) {
  const l = label.toLowerCase();
  return l === q ? 0 : l.startsWith(q) ? 1 : 2;
}

const top = (hits: Hit[]) => hits.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)).slice(0, PER_GROUP).map(({ rank: _r, ...h }) => h);

function search(db: Database, raw: string): SearchResults["groups"] {
  const q = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const ws = words(q);
  if (!ws.length || SSN_LIKE.test(q)) return [];

  // Clients: the household's name and everyone in it.
  let p: string[] = [];
  const clients = db
    .query<{ id: string; label: string; members: string; returns: number }, string[]>(
      `SELECT h.id, COALESCE((SELECT group_concat(first_name, ' & ') FROM (SELECT p.first_name FROM people p WHERE p.household_id = h.id ORDER BY p.created_at LIMIT 2)) || ' ' || h.display_name, h.display_name) AS label,
              (SELECT group_concat(p.first_name || ' ' || p.last_name, ', ') FROM people p WHERE p.household_id = h.id) AS members,
              (SELECT COUNT(*) FROM engagements e WHERE e.household_id = h.id) AS returns
         FROM households h
        WHERE ${wordPrefix("h.display_name || ' ' || COALESCE((SELECT group_concat(p.first_name || ' ' || p.last_name, ' ') FROM people p WHERE p.household_id = h.id), '')", ws, (p = []))}
        LIMIT 50`,
    )
    .all(...p)
    .map((r) => ({ type: "client" as const, id: r.id, label: r.label, sublabel: `${r.members ?? ""} · ${r.returns} return${r.returns === 1 ? "" : "s"}`, householdId: r.id, engagementId: null, rank: rank(r.label, q) }));

  // People: by name or email. Never by any number.
  const people = db
    .query<{ id: string; first: string; last: string; email: string | null; household_id: string; household: string }, string[]>(
      `SELECT p.id, p.first_name AS first, p.last_name AS last, COALESCE(p.email, u.email) AS email, p.household_id, h.display_name AS household
         FROM people p JOIN households h ON h.id = p.household_id LEFT JOIN users u ON u.person_id = p.id
        WHERE ${wordPrefix("p.first_name || ' ' || p.last_name || ' ' || COALESCE(p.email, u.email, '')", ws, (p = []))}
        LIMIT 50`,
    )
    .all(...p)
    .map((r) => ({ type: "person" as const, id: r.id, label: `${r.first} ${r.last}`, sublabel: [r.household + " household", r.email].filter(Boolean).join(" · "), householdId: r.household_id, engagementId: null, rank: rank(`${r.first} ${r.last}`, q) }));

  // Returns: the household, the filers and the tax year ("marigold 2025").
  const returns = db
    .query<{ id: string; household_id: string; household: string; filers: string | null; tax_year: number; kind: string; stage: string }, string[]>(
      `SELECT pr.engagement_id AS id, pr.household_id, pr.household_name AS household, pr.filers, pr.tax_year, pr.kind, pr.stage
         FROM pipeline_rows pr
        WHERE ${wordPrefix("pr.household_name || ' ' || COALESCE(pr.filers, '') || ' ' || pr.tax_year || ' ty' || pr.tax_year", ws, (p = []))}
        ORDER BY pr.tax_year DESC
        LIMIT 50`,
    )
    .all(...p)
    .map((r) => {
      const label = `${r.household} · TY ${r.tax_year}${r.kind === "amended" ? " (amended)" : ""}`;
      return { type: "return" as const, id: r.id, label, sublabel: `${r.filers ?? ""} · ${r.stage}`, householdId: r.household_id, engagementId: r.id, rank: rank(label, q) };
    });

  // Invoices: by number ("2026-0014", "0014").
  const invoices = db
    .query<{ id: string; number: string; engagement_id: string; household_id: string; household: string; settlement: string; total: number }, string[]>(
      `SELECT i.id, i.number, i.engagement_id, e.household_id, h.display_name AS household, b.settlement, b.total_cents AS total
         FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id JOIN engagements e ON e.id = i.engagement_id JOIN households h ON h.id = e.household_id
        WHERE ${wordPrefix("i.number", ws, (p = []))}
        LIMIT 50`,
    )
    .all(...p)
    .map((r) => ({
      type: "invoice" as const,
      id: r.id,
      label: r.number,
      sublabel: `${r.household} · $${(r.total / 100).toFixed(2)} · ${r.settlement.replaceAll("_", " ")}`,
      householdId: r.household_id,
      engagementId: r.engagement_id,
      rank: rank(r.number, q),
    }));

  return [
    { type: "client" as const, heading: "Clients", hits: top(clients) },
    { type: "person" as const, heading: "People", hits: top(people) },
    { type: "return" as const, heading: "Returns", hits: top(returns) },
    { type: "invoice" as const, heading: "Invoices", hits: top(invoices) },
  ].filter((g) => g.hits.length);
}

// Nothing typed: the returns you opened last (engagement.viewed, ticket 32), newest first.
function recent(db: Database, user: SessionUser): SearchResults["groups"] {
  const hits = db
    .query<{ id: string; household_id: string; household: string; filers: string | null; tax_year: number; stage: string }, [string]>(
      `SELECT pr.engagement_id AS id, pr.household_id, pr.household_name AS household, pr.filers, pr.tax_year, pr.stage
         FROM (SELECT subject_id, MAX(occurred_at) AS at FROM events WHERE type = 'engagement.viewed' AND actor_user_id = ? GROUP BY subject_id ORDER BY at DESC LIMIT ${PER_GROUP}) v
         JOIN pipeline_rows pr ON pr.engagement_id = v.subject_id
        ORDER BY v.at DESC`,
    )
    .all(user.id)
    .map((r) => ({ type: "return" as const, id: r.id, label: `${r.household} · TY ${r.tax_year}`, sublabel: `${r.filers ?? ""} · ${r.stage}`, householdId: r.household_id, engagementId: r.id }));
  return hits.length ? [{ type: "return", heading: "Recent", hits }] : [];
}

export const searchRouter = router({
  query: preparerProcedure
    .input(SearchInput)
    .output(SearchResults)
    .query(({ ctx, input }) => {
      const { db } = runtime();
      const q = input.q.trim();
      return q ? { q, recent: false, groups: search(db, q) } : { q, recent: true, groups: recent(db, ctx.user) };
    }),
});
