import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { InvoicePage, SidebarBadges } from "@app/schema";
import { demoWorld } from "./test-harness";

// Ticket 39: every invoice in the practice, one tab each, most urgent first, paged so pages never shift.
// The clock is pinned five days after the seed's "now": some invoices are overdue, some still open.

let w: Awaited<ReturnType<typeof demoWorld>>;
const TODAY = "2026-09-28"; // some invoices past due, some not yet
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => {
  w.use("demo");
  setSystemTime(new Date(`${TODAY}T17:00:00.000Z`));
});
afterEach(() => setSystemTime());
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const page = async (input: Record<string, unknown> = {}) => InvoicePage.parse((await w.call(P(), "invoice.all", { taxYear: 2025, ...input })).data);
const all = async (input: Record<string, unknown> = {}) => {
  const out: InvoicePage["items"] = [];
  let next: InvoicePage["next"] = null;
  do {
    const p = await page({ ...input, limit: 3, ...(next ? { cursor: next } : {}) });
    out.push(...p.items);
    next = p.next;
  } while (next);
  return out;
};
const ORDER = ["failed", "overdue", "open", "draft", "paid", "void"];

// Independent of the route: which tab each invoice belongs in.
const expectedTabs = () =>
  Object.fromEntries(
    w
      .all<{ id: string; tab: string }>(
        `SELECT b.invoice_id AS id, CASE
            WHEN b.status = 'void' THEN 'void' WHEN b.status = 'draft' THEN 'draft'
            WHEN b.settlement = 'failed_last_attempt' THEN 'failed'
            WHEN b.balance_cents > 0 AND i.due_on < '${TODAY}' THEN 'overdue'
            WHEN b.balance_cents > 0 THEN 'open' ELSE 'paid' END AS tab
           FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id JOIN engagements e ON e.id = b.engagement_id WHERE e.tax_year = 2025`,
      )
      .map((r) => [r.id, r.tab]),
  );

describe("tabs and counts", () => {
  test("add a draft and a void so every tab has something", async () => {
    const fresh = w.all<{ id: string }>("SELECT e.id FROM engagements e WHERE e.tax_year = 2025 AND e.filing_status IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.engagement_id = e.id) ORDER BY e.id LIMIT 2");
    const a = (await w.call(P(), "invoice.create", { engagementId: fresh[0]!.id }, "mutation")).data as { id: string };
    const b = (await w.call(P(), "invoice.create", { engagementId: fresh[1]!.id }, "mutation")).data as { id: string };
    await w.call(P(), "invoice.issue", { invoiceId: b.id }, "mutation");
    await w.call(P(), "invoice.void", { invoiceId: b.id, reason: "Created by mistake" }, "mutation");
    expect(a.id).toBeTruthy();
  });

  test("each invoice is in exactly the tab its state says, and the tab counts add up", async () => {
    const p = await page({ limit: 200 });
    const expected = expectedTabs();
    expect(p.items).toHaveLength(Object.keys(expected).length);
    for (const i of p.items) expect({ id: i.id, tab: i.tab }).toEqual({ id: i.id, tab: expected[i.id] as typeof i.tab });
    for (const tab of ORDER) expect({ tab, n: p.counts[tab as keyof typeof p.counts] }).toEqual({ tab, n: Object.values(expected).filter((t) => t === tab).length });
    expect(p.counts.all).toBe(p.items.length);
    for (const tab of ["failed", "overdue", "open", "draft", "paid", "void"]) expect({ tab, has: p.counts[tab as "all"] > 0 }).toEqual({ tab, has: true });
  });

  test("outstanding is what's still owed on issued invoices", async () => {
    const p = await page();
    const owed = w.get<{ c: number }>(
      "SELECT SUM(b.balance_cents) AS c FROM invoice_balances b JOIN engagements e ON e.id = b.engagement_id WHERE b.status = 'issued' AND b.balance_cents > 0 AND e.tax_year = 2025",
    ).c;
    expect(p.outstandingCents).toBe(owed);
  });

  test("a tab shows only its own, with the same counts", async () => {
    const whole = await page();
    for (const tab of ORDER) {
      const p = await page({ tab, limit: 200 });
      expect(p.items.every((i) => i.tab === tab)).toBe(true);
      expect(p.items).toHaveLength(whole.counts[tab as "all"]);
      expect(p.counts).toEqual(whole.counts);
    }
  });
});

describe("order", () => {
  test("problems first: failed, overdue, open, draft, paid, void; soonest due first within each", async () => {
    const items = (await page({ limit: 200 })).items;
    const ranks = items.map((i) => ORDER.indexOf(i.tab));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    for (const tab of ORDER) {
      const due = items.filter((i) => i.tab === tab).map((i) => i.dueOn ?? "9999-12-31");
      expect(due).toEqual([...due].sort());
    }
    expect(items[0]!.tab).toBe("failed");
  });

  test("a failed invoice says why; one never tried says so", async () => {
    const items = (await page({ limit: 200 })).items;
    const failed = items.find((i) => i.tab === "failed")!;
    expect(failed.lastPayment).toMatchObject({ status: "failed" });
    expect(failed.lastPayment!.failureMessage).toBeTruthy();
    expect(items.find((i) => i.tab === "draft")!.lastPayment).toBeNull();
    expect(failed.name).toMatch(/\S/);
  });
});

describe("paging", () => {
  test("walking the pages gives the whole list once, in order", async () => {
    const whole = (await page({ limit: 200 })).items.map((i) => i.id);
    expect((await all()).map((i) => i.id)).toEqual(whole);
    expect((await all({ tab: "paid" })).map((i) => i.id)).toEqual(whole.filter((id) => expectedTabs()[id] === "paid"));
  });

  test("a new invoice arriving mid-walk never repeats or hides one already listed", async () => {
    const first = await page({ limit: 3 });
    const before = (await page({ limit: 200 })).items.map((i) => i.id);
    const fresh = w.get<{ id: string }>("SELECT e.id FROM engagements e WHERE e.tax_year = 2025 AND e.filing_status IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.engagement_id = e.id) ORDER BY e.id LIMIT 1").id;
    const added = (await w.call(P(), "invoice.create", { engagementId: fresh }, "mutation")).data as { id: string };
    const seen = [...first.items.map((i) => i.id)];
    let next = first.next;
    while (next) {
      const p = await page({ limit: 3, cursor: next });
      seen.push(...p.items.map((i) => i.id));
      next = p.next;
    }
    expect(new Set(seen).size).toBe(seen.length); // nothing twice
    for (const id of before) expect(seen).toContain(id); // nothing lost
    expect(seen).toContain(added.id); // a draft sorts after the first page, so it shows up later
  });
});

describe("agrees with the rest of the admin", () => {
  test("the sidebar badge is failed + overdue, the same definition", async () => {
    const p = await page();
    const b = SidebarBadges.parse((await w.call(P(), "dashboard.badges", { taxYear: 2025 })).data);
    expect(b.invoices).toBe(p.counts.failed + p.counts.overdue);
  });

  test("the admin's only: 404 on the portal, 403 for a client", async () => {
    expect((await w.call(P(), "invoice.all", undefined, "query", "portal")).status).toBe(404);
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    expect((await w.call(client, "invoice.all", undefined)).status).toBe(403);
  });
});
