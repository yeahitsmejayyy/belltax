import type { Database } from "bun:sqlite";
import { DashboardInput, DashboardSummary, SidebarBadges, Stage } from "@app/schema";
import { runtime } from "../db/client";
import { preparerProcedure, router } from "../trpc";
import { OVERDUE_SQL } from "../money/settlement";
import { inboxFor } from "./inbox";

// The admin dashboard (.assets/screens/admin/desktop/03-dashboard-dashboard.png): everything on it is derived
// from the database on request, never stored. `dashboard.badges` is the app shell's sidebar counts.

const DAY = 86_400_000;
const STALE_DAYS = 7;

type Waiting = "client" | "preparer" | "authority" | "done";
const WAITING: Record<Stage, Waiting> = {
  invited: "client", intake: "client", documents: "client", ready: "preparer", preparing: "preparer", review: "client", filed: "authority", complete: "done",
};
const STAGE_LABEL: Record<Stage, string> = {
  invited: "Invited", intake: "Intake", documents: "Documents", ready: "Ready to prep", preparing: "Preparing", review: "Client review", filed: "Filed", complete: "Complete",
};

// ── The season ───────────────────────────────────────────────────────────────────────────────────────
// E-filing opens in late January (January 26 here: the IRS's usual date, close enough for a progress bar).
// The deadline is April 15, or the next weekday when it falls on a weekend; extensions run to October 15.

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const offWeekend = (d: Date) => {
  const day = d.getUTCDay();
  return day === 6 ? new Date(d.getTime() + 2 * DAY) : day === 0 ? new Date(d.getTime() + DAY) : d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const midnight = (t: Date) => utc(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());

export function seasonFor(taxYear: number, today: Date): DashboardSummary["season"] {
  const y = taxYear + 1;
  const opens = utc(y, 0, 26);
  const regular = offWeekend(utc(y, 3, 15));
  const extension = offWeekend(utc(y, 9, 15));
  const t = midnight(today);
  if (t < opens) return { phase: "before", opensOn: iso(opens), deadline: iso(regular), daysToDeadline: days(t, regular), day: 0, length: days(opens, regular) };
  if (t <= regular) return { phase: "regular", opensOn: iso(opens), deadline: iso(regular), daysToDeadline: days(t, regular), day: days(opens, t), length: days(opens, regular) };
  if (t <= extension) return { phase: "extension", opensOn: iso(opens), deadline: iso(extension), daysToDeadline: days(t, extension), day: days(regular, t), length: days(regular, extension) };
  return { phase: "closed", opensOn: iso(opens), deadline: iso(extension), daysToDeadline: 0, day: days(regular, extension), length: days(regular, extension) };
}

// "Dana & Sam Marigold": the filers' first names and the household name, as the design writes them.
const RETURN_NAME = "COALESCE(pr.filers || ' ' || pr.household_name, pr.household_name)";

const list = (names: string[]) => names.slice(0, 3);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function filedTimes(db: Database, taxYear: number) {
  return db
    .query<{ filed_at: string }, [number]>(
      `SELECT MAX(ev.occurred_at) AS filed_at
         FROM engagements e JOIN events ev ON ev.engagement_id = e.id AND ev.type = 'engagement.stage_changed'
        WHERE e.tax_year = ? AND e.stage IN ('filed', 'complete') AND json_extract(ev.data, '$.to') = 'filed'
        GROUP BY e.id`,
    )
    .all(taxYear)
    .map((r) => new Date(r.filed_at));
}

export function dashboardSummary(db: Database, taxYearIn?: number, today = new Date()): DashboardSummary {
  const taxYear = taxYearIn ?? db.query<{ y: number | null }, []>("SELECT MAX(tax_year) AS y FROM engagements").get()!.y;
  const season = seasonFor(taxYear ?? today.getUTCFullYear() - 1, today);
  if (taxYear === null) {
    return {
      taxYear, season, returns: { total: 0, filed: 0, complete: 0, waitingOnAuthority: 0 }, money: { billedCents: 0, collectedCents: 0, outstandingCents: 0 },
      waitingOnYou: { total: 0, toPrepare: 0, inbox: 0 }, daysInStage: { average: 0, over7: 0 }, byStage: Stage.options.map((stage) => ({ stage, count: 0, waiting: WAITING[stage] })),
      filingsPerWeek: { weeks: [], filedSoFar: 0, lastYearBySameDay: 0 }, billingByPackage: [], health: [], needAttention: 0,
    };
  }
  const todayIso = iso(today);
  const staleBefore = new Date(today.getTime() - STALE_DAYS * DAY).toISOString();

  // Returns and stages
  const stages = db
    .query<{ stage: Stage; n: number; days: number; stale: number }, [string, number, string]>(
      `SELECT stage, COUNT(*) AS n, SUM(julianday(?1) - julianday(stage_changed_at)) AS days,
              SUM(stage NOT IN ('filed', 'complete') AND stage_changed_at < ?3) AS stale
         FROM engagements WHERE tax_year = ?2 GROUP BY stage`,
    )
    .all(today.toISOString(), taxYear, staleBefore);
  const n = (s: Stage) => stages.find((r) => r.stage === s)?.n ?? 0;
  const total = stages.reduce((a, r) => a + r.n, 0);
  const open = stages.filter((r) => r.stage !== "complete");
  const openCount = open.reduce((a, r) => a + r.n, 0);
  const average = openCount ? Math.round((open.reduce((a, r) => a + r.days, 0) / openCount) * 10) / 10 : 0;
  const over7 = stages.reduce((a, r) => a + (r.stale ?? 0), 0);

  // Money
  const m = db
    .query<{ billed: number | null; collected: number | null; outstanding: number | null }, [number]>(
      `SELECT SUM(b.total_cents) AS billed, SUM(b.paid_cents) AS collected, SUM(MAX(b.balance_cents, 0)) AS outstanding
         FROM invoice_balances b JOIN engagements e ON e.id = b.engagement_id WHERE b.status = 'issued' AND e.tax_year = ?`,
    )
    .get(taxYear)!;

  // Filings per week: this season against the same weeks last season, measured from each season's opening.
  const thisOpens = new Date(`${season.opensOn}T00:00:00.000Z`);
  const lastOpens = new Date(`${seasonFor(taxYear - 1, today).opensOn}T00:00:00.000Z`);
  const weekIndex = (d: Date, opens: Date) => Math.floor((d.getTime() - opens.getTime()) / (7 * DAY));
  const nowWeek = weekIndex(today, thisOpens);
  const mine = filedTimes(db, taxYear).map((d) => weekIndex(d, thisOpens));
  const theirs = filedTimes(db, taxYear - 1);
  const theirWeeks = theirs.map((d) => weekIndex(d, lastOpens));
  const weeks =
    nowWeek < 0
      ? []
      : Array.from({ length: Math.min(12, nowWeek + 1) }, (_, k) => nowWeek - Math.min(11, nowWeek) + k).map((w) => ({
          weekOf: iso(new Date(thisOpens.getTime() + w * 7 * DAY)),
          thisYear: mine.filter((x) => x === w).length,
          lastYear: theirWeeks.filter((x) => x === w).length,
        }));
  const sinceOpening = today.getTime() - thisOpens.getTime();
  const lastYearBySameDay = theirs.filter((d) => d.getTime() - lastOpens.getTime() <= sinceOpening).length;

  // Billing by package
  const billingByPackage = db
    .query<{ code: string; name: string; returns: number; billed: number }, [number]>(
      `SELECT p.code, p.name, COUNT(DISTINCT i.engagement_id) AS returns, SUM(l.quantity * l.unit_amount_cents) AS billed
         FROM invoice_lines l JOIN price_packages p ON p.code = l.price_code JOIN invoices i ON i.id = l.invoice_id JOIN engagements e ON e.id = i.engagement_id
        WHERE i.status = 'issued' AND e.tax_year = ? GROUP BY p.code ORDER BY p.position, p.code`,
    )
    .all(taxYear)
    .map((r) => ({ code: r.code, name: r.name, returns: r.returns, billedCents: r.billed }));

  // Health checks
  const inbox = inboxFor(db, { taxYear, staleDays: STALE_DAYS });
  const names = (sql: string, ...p: (string | number)[]) => db.query<{ name: string }, (string | number)[]>(sql).all(...p).map((r) => r.name);

  const failed = db
    .query<{ n: number; cents: number | null }, [number]>(
      `SELECT COUNT(*) AS n, SUM(b.balance_cents) AS cents FROM invoice_balances b JOIN engagements e ON e.id = b.engagement_id
        WHERE b.settlement = 'failed_last_attempt' AND e.tax_year = ?`,
    )
    .get(taxYear)!;
  const failedNames = names(
    `SELECT ${RETURN_NAME} AS name FROM invoice_balances b JOIN pipeline_rows pr ON pr.engagement_id = b.engagement_id
      WHERE b.settlement = 'failed_last_attempt' AND pr.tax_year = ? ORDER BY b.balance_cents DESC LIMIT 3`,
    taxYear,
  );

  const stale = db
    .query<{ name: string; stage: Stage; since: string }, [number, string]>(
      `SELECT ${RETURN_NAME} AS name, pr.stage, pr.stage_changed_at AS since FROM pipeline_rows pr
        WHERE pr.tax_year = ? AND pr.stage NOT IN ('filed', 'complete') AND pr.stage_changed_at < ? ORDER BY pr.stage_changed_at, pr.engagement_id`,
    )
    .all(taxYear, staleBefore);

  const missing = db
    .query<{ households: number; open: number }, [number]>(
      `SELECT COUNT(DISTINCT e.household_id) AS households, COUNT(*) AS open
         FROM requests r JOIN engagements e ON e.id = r.engagement_id WHERE r.kind = 'document' AND r.status = 'open' AND e.tax_year = ?`,
    )
    .get(taxYear)!;
  const missingNames = names(
    `SELECT ${RETURN_NAME} AS name FROM pipeline_rows pr WHERE pr.tax_year = ? AND pr.open_requests > 0 ORDER BY pr.open_requests DESC, pr.engagement_id LIMIT 3`,
    taxYear,
  );

  const overdueNames = names(
    `SELECT ${RETURN_NAME} AS name FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id JOIN pipeline_rows pr ON pr.engagement_id = b.engagement_id
      WHERE ${OVERDUE_SQL} AND pr.tax_year = ? ORDER BY i.due_on, i.id`,
    todayIso,
    taxYear,
  );

  const unsigned = names(
    `SELECT (SELECT ${RETURN_NAME} FROM pipeline_rows pr JOIN engagements e ON e.id = pr.engagement_id WHERE e.letter_id = l.id ORDER BY e.created_at, e.id LIMIT 1) AS name
       FROM engagement_letters l WHERE l.status = 'sent' AND l.tax_year = ? ORDER BY l.sent_at, l.id`,
    taxYear,
  );

  const invites = names(
    `SELECT DISTINCT p.first_name || ' ' || p.last_name AS name FROM users u JOIN people p ON p.id = u.person_id
       JOIN return_people rp ON rp.person_id = p.id AND rp.role IN ('primary', 'spouse')
      WHERE u.role = 'client' AND u.activated_at IS NULL AND u.created_at < ? AND rp.tax_year = ? ORDER BY u.created_at, u.id`,
    staleBefore,
    taxYear,
  );

  type Check = DashboardSummary["health"][number];
  const check = (key: Check["key"], count: number, tone: Check["tone"], title: string, detail: string, names: string[], link: string, tracked = true): Check => ({
    key, count, tone: count === 0 && tracked ? "ok" : tone, title, detail, names: list(names), link, tracked,
  });
  const longest = stale[0];
  const health: Check[] = [
    check("failed_payments", failed.n, "danger", failed.n ? `${plural(failed.n, "failed payment")} · ${money(failed.cents ?? 0)}` : "No failed payments", failedNames.join(", "), failedNames, "/invoices?settlement=failed_last_attempt"),
    check("stale_returns", stale.length, "warning", stale.length ? `${plural(stale.length, "return")} stuck over ${STALE_DAYS} days` : `Nothing stuck over ${STALE_DAYS} days`,
      longest ? `Longest: ${longest.name} · ${Math.floor((today.getTime() - Date.parse(longest.since)) / DAY)} days in ${STAGE_LABEL[longest.stage]}` : "", stale.map((s) => s.name), `/pipeline?staleDays=${STALE_DAYS}`),
    check("missing_documents", missing.households, "warning", missing.households ? `${plural(missing.households, "household")} missing documents` : "No documents outstanding",
      missing.open ? `${plural(missing.open, "document")} outstanding in total` : "", missingNames, "/pipeline?missing=1"),
    check("overdue_invoices", overdueNames.length, "warning", overdueNames.length ? plural(overdueNames.length, "overdue invoice") : "No overdue invoices", list(overdueNames).join(", "), overdueNames, "/invoices?overdue=1"),
    check("unsigned_letters", unsigned.length, "warning", unsigned.length ? `${plural(unsigned.length, "engagement letter")} not signed` : "Every sent letter is signed", list(unsigned).join(", "), unsigned, "/pipeline?letter=unsigned"),
    check("invites_pending", invites.length, "warning", invites.length ? `${plural(invites.length, "invite")} not accepted after ${STALE_DAYS} days` : "Every invite accepted", list(invites).join(", "), invites, "/clients?invite=pending"),
    check("efile_rejections", 0, "info", "E-file status isn't tracked yet", "Record acceptances and rejections once e-file tracking lands.", [], "/pipeline?stage=filed", false),
    check("inbox", inbox.total, "info", inbox.total ? `${plural(inbox.total, "item")} waiting in Inbox` : "Inbox is clear", "Uploads, replies and payment updates to review.", [], "/inbox"),
  ];

  return {
    taxYear,
    season,
    returns: { total, filed: n("filed") + n("complete"), complete: n("complete"), waitingOnAuthority: n("filed") },
    money: { billedCents: m.billed ?? 0, collectedCents: m.collected ?? 0, outstandingCents: m.outstanding ?? 0 },
    waitingOnYou: { total: n("ready") + n("preparing") + inbox.total, toPrepare: n("ready") + n("preparing"), inbox: inbox.total },
    daysInStage: { average, over7 },
    byStage: Stage.options.map((stage) => ({ stage, count: n(stage), waiting: WAITING[stage] })),
    filingsPerWeek: { weeks, filedSoFar: mine.filter((w) => w <= nowWeek).length, lastYearBySameDay },
    billingByPackage,
    health,
    needAttention: health.filter((h) => h.tracked && h.key !== "inbox" && h.count > 0).length,
  };
}

export function sidebarBadges(db: Database, taxYearIn?: number, today = new Date()) {
  const taxYear = taxYearIn ?? db.query<{ y: number | null }, []>("SELECT MAX(tax_year) AS y FROM engagements").get()!.y;
  if (taxYear === null) return { pipeline: 0, inbox: 0, invoices: 0 };
  const pipeline = db.query<{ n: number }, [number]>("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = ?").get(taxYear)!.n;
  const invoices = db
    .query<{ n: number }, [string, number]>(
      `SELECT COUNT(*) AS n FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id JOIN engagements e ON e.id = b.engagement_id
        WHERE (b.settlement = 'failed_last_attempt' OR (${OVERDUE_SQL})) AND e.tax_year = ?`,
    )
    .get(iso(today), taxYear)!.n;
  return { pipeline, inbox: inboxFor(db, { taxYear }).total, invoices };
}

export const dashboardRouter = router({
  summary: preparerProcedure
    .input(DashboardInput)
    .output(DashboardSummary)
    .query(({ input }) => dashboardSummary(runtime().db, input?.taxYear)),
  badges: preparerProcedure
    .input(DashboardInput)
    .output(SidebarBadges)
    .query(({ input }) => sidebarBadges(runtime().db, input?.taxYear)),
});
