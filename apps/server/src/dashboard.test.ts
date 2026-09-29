import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { DashboardSummary, Inbox, SidebarBadges } from "@app/schema";
import { seasonFor } from "./routes/dashboard";
import { demoWorld } from "./test-harness";

// Ticket 38: the dashboard, checked against the seeded world with independently written queries.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => {
  w.use("demo");
  setSystemTime(new Date("2026-09-23T17:00:00.000Z")); // the seed's "now"
});
afterEach(() => setSystemTime());
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const summary = async () => DashboardSummary.parse((await w.call(P(), "dashboard.summary", { taxYear: 2025 })).data);
const count = (sql: string, ...p: (string | number)[]) => w.get<{ n: number }>(sql, ...p).n;
const check = (s: DashboardSummary, key: string) => s.health.find((h) => h.key === key)!;

describe("the season", () => {
  test("TY 2026: opens January 26, due April 15 2027; day 39 of 79 means 40 days to go (the design's numbers)", () => {
    expect(seasonFor(2026, new Date("2027-03-06T20:00:00Z"))).toEqual({ phase: "regular", opensOn: "2027-01-26", deadline: "2027-04-15", daysToDeadline: 40, day: 39, length: 79 });
    expect(seasonFor(2026, new Date("2026-12-01T00:00:00Z"))).toMatchObject({ phase: "before", day: 0, daysToDeadline: 135 });
    expect(seasonFor(2026, new Date("2027-05-01T00:00:00Z"))).toMatchObject({ phase: "extension", deadline: "2027-10-15", daysToDeadline: 167 });
    expect(seasonFor(2026, new Date("2027-11-01T00:00:00Z"))).toMatchObject({ phase: "closed", daysToDeadline: 0 });
  });

  test("a deadline on a weekend moves to Monday", () => {
    // April 15, 2028 is a Saturday; October 15, 2028 a Sunday.
    expect(seasonFor(2027, new Date("2028-02-01T00:00:00Z")).deadline).toBe("2028-04-17");
    expect(seasonFor(2027, new Date("2028-06-01T00:00:00Z")).deadline).toBe("2028-10-16");
  });
});

describe("the numbers match the database", () => {
  test("returns, stages and who each stage waits on", async () => {
    const s = await summary();
    expect(s.returns.total).toBe(count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2025"));
    expect(s.returns).toMatchObject({
      filed: count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2025 AND stage IN ('filed', 'complete')"),
      complete: count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2025 AND stage = 'complete'"),
      waitingOnAuthority: count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2025 AND stage = 'filed'"),
    });
    expect(s.byStage.reduce((a, b) => a + b.count, 0)).toBe(s.returns.total);
    expect(s.byStage.map((b) => b.waiting)).toEqual(["client", "client", "client", "preparer", "preparer", "client", "authority", "done"]);
  });

  test("money: billed, collected and outstanding from issued invoices", async () => {
    const s = await summary();
    const m = w.get<{ billed: number; paid: number; owed: number }>(
      `SELECT SUM(b.total_cents) AS billed, SUM(b.paid_cents) AS paid, SUM(CASE WHEN b.balance_cents > 0 THEN b.balance_cents ELSE 0 END) AS owed
         FROM invoice_balances b JOIN engagements e ON e.id = b.engagement_id WHERE b.status = 'issued' AND e.tax_year = 2025`,
    );
    expect(s.money).toEqual({ billedCents: m.billed, collectedCents: m.paid, outstandingCents: m.owed });
    expect(s.money.billedCents).toBeGreaterThan(0);
  });

  test("waiting on you is the returns to prepare plus everything in the Inbox", async () => {
    const s = await summary();
    const inbox = Inbox.parse((await w.call(P(), "inbox.list", { taxYear: 2025 })).data);
    expect(s.waitingOnYou).toEqual({
      toPrepare: count("SELECT COUNT(*) AS n FROM engagements WHERE tax_year = 2025 AND stage IN ('ready', 'preparing')"),
      inbox: inbox.total,
      total: s.waitingOnYou.toPrepare + inbox.total,
    });
    expect(s.daysInStage.over7).toBe(inbox.counts.stale); // the same rule as the Inbox's "stale"
  });

  test("billing by package sums each package's lines on issued invoices", async () => {
    const s = await summary();
    for (const p of s.billingByPackage) {
      const expected = w.get<{ billed: number }>(
        `SELECT SUM(l.quantity * l.unit_amount_cents) AS billed FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id JOIN engagements e ON e.id = i.engagement_id
          WHERE l.price_code = ? AND i.status = 'issued' AND e.tax_year = 2025`,
        p.code,
      ).billed;
      expect({ code: p.code, billed: p.billedCents }).toEqual({ code: p.code, billed: expected });
    }
    expect(s.billingByPackage.length).toBeGreaterThan(1);
  });

  test("health checks count what they say, name up to three, and link somewhere", async () => {
    const s = await summary();
    expect(check(s, "failed_payments").count).toBe(count("SELECT COUNT(*) AS n FROM invoice_balances b JOIN engagements e ON e.id = b.engagement_id WHERE b.settlement = 'failed_last_attempt' AND e.tax_year = 2025"));
    expect(check(s, "missing_documents").count).toBe(
      count("SELECT COUNT(DISTINCT e.household_id) AS n FROM requests r JOIN engagements e ON e.id = r.engagement_id WHERE r.kind = 'document' AND r.status = 'open' AND e.tax_year = 2025"),
    );
    expect(check(s, "unsigned_letters").count).toBe(count("SELECT COUNT(*) AS n FROM engagement_letters WHERE status = 'sent' AND tax_year = 2025"));
    expect(check(s, "overdue_invoices").count).toBe(
      count("SELECT COUNT(*) AS n FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id JOIN engagements e ON e.id = b.engagement_id WHERE b.status = 'issued' AND b.balance_cents > 0 AND i.due_on < '2026-09-23' AND e.tax_year = 2025"),
    );
    for (const h of s.health) {
      expect(h.names.length).toBeLessThanOrEqual(3);
      expect(h.link).toMatch(/^\//);
      expect(h.title.length).toBeGreaterThan(0);
    }
    expect(check(s, "efile_rejections")).toMatchObject({ tracked: true, tone: "danger" });
    expect(check(s, "efile_rejections").count).toBe(
      count(`SELECT COUNT(DISTINCT s.engagement_id) AS n FROM efile_submissions s JOIN engagements e ON e.id = s.engagement_id
              WHERE s.status = 'rejected' AND e.stage = 'filed' AND e.tax_year = 2025
                AND NOT EXISTS (SELECT 1 FROM efile_submissions t WHERE t.engagement_id = s.engagement_id AND t.jurisdiction = s.jurisdiction AND t.submitted_at > s.submitted_at)`),
    );
    expect(s.needAttention).toBe(s.health.filter((h) => h.tracked && h.key !== "inbox" && h.count > 0).length);
    expect(check(s, "failed_payments").title).toMatch(/^\d+ failed payments? · \$[\d,]+\.\d\d$/);
  });

  test("a check that's clear turns ok: paying off the failed invoice", async () => {
    const failed = w.get<{ invoice_id: string; balance_cents: number }>(
      "SELECT b.invoice_id, b.balance_cents FROM invoice_balances b JOIN engagements e ON e.id = b.engagement_id WHERE b.settlement = 'failed_last_attempt' AND e.tax_year = 2025",
    );
    const before = check(await summary(), "failed_payments").count;
    await w.call(P(), "payment.record", { invoiceId: failed.invoice_id, amountCents: failed.balance_cents, method: "check", receivedOn: "2026-09-23" }, "mutation");
    const after = check(await summary(), "failed_payments");
    expect(after.count).toBe(before - 1);
    if (after.count === 0) expect(after).toMatchObject({ tone: "ok", title: "No failed payments" });
  });
});

describe("filings per week", () => {
  test("filing a return this week shows up this week, and only this season", async () => {
    const before = await summary();
    const ready = w.get<{ id: string }>("SELECT id FROM engagements WHERE tax_year = 2025 AND stage = 'review' ORDER BY id LIMIT 1").id;
    w.db.run("UPDATE engagements SET stage = 'filed', stage_changed_at = ? WHERE id = ?", ["2026-09-23T16:00:00.000Z", ready]);
    w.db.run(
      `INSERT INTO events (id, occurred_at, actor_kind, actor_user_id, household_id, engagement_id, type, subject_type, subject_id, data)
       SELECT ?, '2026-09-23T16:00:00.000Z', 'preparer', ?, household_id, id, 'engagement.stage_changed', 'engagement', id, '{"from":"review","to":"filed"}' FROM engagements WHERE id = ?`,
      [Bun.randomUUIDv7(), P(), ready],
    );
    const after = await summary();
    expect(after.filingsPerWeek.filedSoFar).toBe(before.filingsPerWeek.filedSoFar + 1);
    expect(after.filingsPerWeek.weeks.at(-1)!.thisYear).toBe(before.filingsPerWeek.weeks.at(-1)!.thisYear + 1);
    expect(after.filingsPerWeek.lastYearBySameDay).toBe(before.filingsPerWeek.lastYearBySameDay);
    expect(after.filingsPerWeek.weeks.length).toBeLessThanOrEqual(12);
    expect(after.filingsPerWeek.weeks.reduce((a, x) => a + x.lastYear, 0)).toBeGreaterThan(0); // last season is there to compare
  });
});

describe("sidebar badges", () => {
  test("agree with the dashboard and the inbox", async () => {
    const b = SidebarBadges.parse((await w.call(P(), "dashboard.badges", { taxYear: 2025 })).data);
    const s = await summary();
    expect(b.pipeline).toBe(s.returns.total);
    expect(b.inbox).toBe(s.waitingOnYou.inbox);
    expect(b.invoices).toBe(
      count(
        `SELECT COUNT(*) AS n FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id JOIN engagements e ON e.id = b.engagement_id
          WHERE e.tax_year = 2025 AND (b.settlement = 'failed_last_attempt' OR (b.status = 'issued' AND b.balance_cents > 0 AND i.due_on < '2026-09-23'))`,
      ),
    );
  });

  test("the admin's only: 404 on the portal, 403 for a client", async () => {
    expect((await w.call(P(), "dashboard.summary", undefined, "query", "portal")).status).toBe(404);
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "dashboard.badges", undefined)).status).toBe(403);
  });
});
