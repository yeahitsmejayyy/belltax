import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { InvoiceSuggestion, InvoiceSummary, now } from "@app/schema";
import { z } from "zod";
import { demoWorld } from "./test-harness";

// Invoicing without Stripe: suggested lines, drafts, issuing, voiding, and money recorded by hand.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const inv = (res: { data?: unknown }) => InvoiceSummary.parse(res.data);
const today = () => now().slice(0, 10);
const engWith = (where: string) => w.get<{ id: string }>(`SELECT e.id FROM engagements e WHERE ${where} ORDER BY e.id LIMIT 1`).id;
const primaryUser = (engagementId: string) =>
  w.get<{ id: string }>(
    "SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'",
    engagementId,
  ).id;
// A current return that doesn't have an invoice yet (each test takes a new one).
const fresh = () =>
  engWith(
    "e.stage IN ('documents', 'ready', 'preparing') AND e.tax_year = 2025 AND e.kind = 'original' AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.engagement_id = e.id)",
  );

describe("the payments table keeps the two paths apart", () => {
  const base = () => {
    const invoiceId = w.get<{ id: string }>("SELECT id FROM invoices WHERE status = 'issued' LIMIT 1").id;
    return { id: Bun.randomUUIDv7(), invoice_id: invoiceId, amount_cents: 100, created_at: now(), updated_at: now() };
  };
  const insert = (row: Record<string, string | number | null>) => {
    const cols = Object.keys(row);
    w.db.run(`INSERT INTO payments (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, cols.map((c) => row[c]!));
  };
  test("a manual payment needs a method, a date and who recorded it, and is simply received", () => {
    expect(() => insert({ ...base(), provider: "manual", status: "succeeded" })).toThrow(/CHECK/);
    expect(() => insert({ ...base(), provider: "manual", method: "cash", received_on: today(), recorded_by: P(), status: "pending" })).toThrow(/CHECK/);
    expect(() => insert({ ...base(), provider: "manual", method: "cash", received_on: today(), recorded_by: P(), status: "succeeded" })).not.toThrow();
  });
  test("a Stripe payment needs its checkout session and carries no manual fields", () => {
    expect(() => insert({ ...base(), provider: "stripe", status: "pending" })).toThrow(/CHECK/);
    expect(() => insert({ ...base(), provider: "stripe", checkout_session_id: "cs_test_x1", method: "cash", status: "pending" })).toThrow(/CHECK/);
  });
});

describe("suggested lines follow what's on the return", () => {
  const suggest = async (engagementId: string) => InvoiceSuggestion.parse((await w.call(P(), "invoice.suggest", { engagementId })).data);
  test("the package for its filing status, then add-ons: rental per property, side work for a business", async () => {
    const landlord = engWith("e.tax_year = 2025 AND e.filing_status IS NOT NULL AND EXISTS (SELECT 1 FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = e.id AND s.kind = 'rental_property')");
    const l = await suggest(landlord);
    expect(l.packageCode).not.toBeNull();
    expect(l.lines[0]!.priceCode).toBe(l.packageCode);
    expect(l.lines.find((x) => x.priceCode === "rental")?.quantity).toBeGreaterThanOrEqual(1);
    const gig = engWith("e.tax_year = 2025 AND e.filing_status IS NOT NULL AND EXISTS (SELECT 1 FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = e.id AND s.kind = 'business')");
    expect((await suggest(gig)).lines.map((x) => x.priceCode)).toContain("side_work");
    const amended = engWith("e.kind = 'amended'");
    expect(await suggest(amended)).toEqual({ packageCode: null, lines: [], included: [] }); // the amended add-on ships inactive
  });
});

describe("invoice lifecycle", () => {
  test("draft from suggestions → edit → issue; clients only ever see issued invoices", async () => {
    const id = fresh();
    const client = primaryUser(id);
    const suggested = InvoiceSuggestion.parse((await w.call(P(), "invoice.suggest", { engagementId: id })).data);
    const draft = inv(await w.call(P(), "invoice.create", { engagementId: id, dueOn: "2026-04-15" }, "mutation"));
    expect(draft).toMatchObject({ status: "draft", settlement: "draft", dueOn: "2026-04-15" });
    expect(draft.number).toMatch(/^2026-\d{4}$/);
    // Left to itself, a new invoice is the suggestion: the package first, then the add-ons.
    expect(draft.lines.map((l) => l.description)).toEqual(suggested.lines.map((l) => l.description));
    expect(draft.included).toEqual(suggested.included.map((x) => x.name).sort());
    expect(w.eventsOf("invoice.created", draft.id)).toHaveLength(1);
    expect(z.array(InvoiceSummary).parse((await w.call(client, "invoice.list", { engagementId: id })).data)).toEqual([]);

    const edited = inv(await w.call(P(), "invoice.updateLines", {
      invoiceId: draft.id,
      lines: [{ description: "Federal return (Form 1040)", quantity: 1, unitAmountCents: 22500 }, { description: "California return (Form 540)", quantity: 1, unitAmountCents: 10000 }],
    }, "mutation"));
    expect(edited.totalCents).toBe(32500);

    const issued = inv(await w.call(P(), "invoice.issue", { invoiceId: draft.id }, "mutation"));
    expect(issued).toMatchObject({ status: "issued", settlement: "unpaid", balanceCents: 32500 });
    const seen = z.array(InvoiceSummary).parse((await w.call(client, "invoice.list", { engagementId: id })).data);
    expect(seen.map((i) => i.id)).toEqual([draft.id]);

    expect((await w.call(P(), "invoice.updateLines", { invoiceId: draft.id, lines: [{ description: "x", quantity: 1, unitAmountCents: 1 }] }, "mutation")).status).toBe(412);
    expect((await w.call(P(), "invoice.issue", { invoiceId: draft.id }, "mutation")).status).toBe(412);
  });

  test("numbers run in sequence per filing year", async () => {
    const id = fresh();
    const a = inv(await w.call(P(), "invoice.create", { engagementId: id }, "mutation"));
    const b = inv(await w.call(P(), "invoice.create", { engagementId: id }, "mutation"));
    expect(Number(b.number.slice(5))).toBe(Number(a.number.slice(5)) + 1);
  });

  test("recording payments by hand: never more than is owed, never in the future, balance follows", async () => {
    const id = fresh();
    const i = inv(await w.call(P(), "invoice.create", { engagementId: id, lines: [{ description: "Federal return (Form 1040)", quantity: 1, unitAmountCents: 30000 }] }, "mutation"));
    await w.call(P(), "invoice.issue", { invoiceId: i.id }, "mutation");
    const record = (amountCents: number, receivedOn = today(), method = "zelle") =>
      w.call(P(), "payment.record", { invoiceId: i.id, amountCents, method, receivedOn, note: "Deposit" }, "mutation");

    expect((await record(30001)).error!.message).toMatch(/more than the \$300\.00 still owed/);
    expect((await record(100, "2999-01-01")).error!.message).toMatch(/can't be in the future/);
    const half = inv(await record(10000));
    expect(half).toMatchObject({ settlement: "partial", paidCents: 10000, balanceCents: 20000 });
    expect(half.payments[0]).toMatchObject({ provider: "manual", method: "zelle", note: "Deposit", status: "succeeded" });
    const paid = inv(await record(20000, today(), "check"));
    expect(paid).toMatchObject({ settlement: "paid", balanceCents: 0 });
    expect((await record(1)).status).toBe(400);
    expect(w.eventsOf("payment.recorded", paid.payments[0]!.id)).toHaveLength(1);
    // The client sees how they paid.
    const seen = z.array(InvoiceSummary).parse((await w.call(primaryUser(id), "invoice.list", { engagementId: id })).data);
    expect(seen.find((x) => x.id === i.id)!.payments.map((p) => p.method).sort()).toEqual(["check", "zelle"]);
  });

  test("voiding needs a reason and is refused once money has come in", async () => {
    const id = fresh();
    const i = inv(await w.call(P(), "invoice.create", { engagementId: id }, "mutation"));
    await w.call(P(), "invoice.issue", { invoiceId: i.id }, "mutation");
    expect((await w.call(P(), "invoice.void", { invoiceId: i.id }, "mutation")).status).toBe(400);
    await w.call(P(), "payment.record", { invoiceId: i.id, amountCents: 500, method: "cash", receivedOn: today() }, "mutation");
    expect((await w.call(P(), "invoice.void", { invoiceId: i.id, reason: "Wrong amount" }, "mutation")).error!.message).toMatch(/Money has been received/);

    const other = inv(await w.call(P(), "invoice.create", { engagementId: id }, "mutation"));
    const voided = inv(await w.call(P(), "invoice.void", { invoiceId: other.id, reason: "Duplicate" }, "mutation"));
    expect(voided.settlement).toBe("void");
    expect(w.eventsOf("invoice.voided", other.id)[0]!.reason).toBe("Duplicate");
    expect((await w.call(P(), "payment.record", { invoiceId: other.id, amountCents: 1, method: "cash", receivedOn: today() }, "mutation")).status).toBe(412);
  });

  test("paying the rest by hand lets a filed return complete", async () => {
    const id = w.get<{ engagement_id: string }>("SELECT engagement_id FROM invoice_balances WHERE settlement = 'partial'").engagement_id;
    const blocked = await w.call(P(), "engagement.advanceStage", { engagementId: id, to: "complete" }, "mutation");
    expect(blocked.status).toBe(412);
    const i = z.array(InvoiceSummary).parse((await w.call(P(), "invoice.list", { engagementId: id })).data).find((x) => x.status === "issued")!;
    expect(i.payments.some((p) => p.provider === "manual")).toBe(true); // the seeded Zelle deposit
    await w.call(P(), "payment.record", { invoiceId: i.id, amountCents: i.balanceCents, method: "check", receivedOn: today() }, "mutation");
    // Complete also needs both e-files accepted (ticket 40): get whatever's pending or rejected over the line.
    for (const jurisdiction of ["federal", "state"]) {
      const state = () => w.get<{ status: string } | null>("SELECT status FROM efile_submissions WHERE engagement_id = ? AND jurisdiction = ? ORDER BY submitted_at DESC, id DESC LIMIT 1", id, jurisdiction)?.status;
      if (state() === "rejected") await w.call(P(), "engagement.recordEfile", { engagementId: id, jurisdiction, action: "submit" }, "mutation");
      if (state() === "submitted") await w.call(P(), "engagement.recordEfile", { engagementId: id, jurisdiction, action: "accept" }, "mutation");
    }
    expect((await w.call(P(), "engagement.advanceStage", { engagementId: id, to: "complete" }, "mutation")).status).toBe(200);
  });
});

describe("authorization", () => {
  test("clients can't create, issue, void or record; another household can't even list", async () => {
    const id = fresh();
    const client = primaryUser(id);
    expect((await w.call(client, "invoice.create", { engagementId: id }, "mutation")).status).toBe(403);
    expect((await w.call(client, "invoice.suggest", { engagementId: id })).status).toBe(403);
    const issued = w.get<{ id: string; engagement_id: string }>("SELECT id, engagement_id FROM invoices WHERE status = 'issued' LIMIT 1");
    expect((await w.call(client, "payment.record", { invoiceId: issued.id, amountCents: 1, method: "cash", receivedOn: today() }, "mutation")).status).toBe(403);
    const stranger = w.get<{ id: string }>(
      "SELECT u.id FROM users u JOIN return_people rp ON rp.person_id = u.person_id JOIN engagements e ON e.id = rp.engagement_id WHERE e.household_id <> (SELECT household_id FROM engagements WHERE id = ?) AND u.role = 'client' LIMIT 1",
      issued.engagement_id,
    ).id;
    expect((await w.call(stranger, "invoice.list", { engagementId: issued.engagement_id })).status).toBe(404);
  });

  test("live mode: 401 until auth", async () => {
    w.use("live");
    expect((await w.call(null, "invoice.list", { engagementId: fresh() })).status).toBe(401);
  });
});
