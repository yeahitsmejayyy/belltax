import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { MyAccount, Receipt } from "@app/schema";
import { demoWorld } from "./test-harness";

// Ticket 42: a client's own settings (contact, reminders) and receipts.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

type Client = { id: string; person_id: string; email: string; household_id: string };
const clients = () =>
  w.all<Client>("SELECT u.id, u.person_id, u.email, p.household_id FROM users u JOIN people p ON p.id = u.person_id WHERE u.role = 'client' AND p.household_id IS NOT NULL ORDER BY u.id");
const me = async (as: string) => MyAccount.parse((await w.call(as, "me.get", undefined, "query", "portal")).data);
const update = (as: string, input: unknown) => w.call(as, "me.updateContact", input, "mutation", "portal");
const remind = (as: string, input: unknown) => w.call(as, "me.setReminders", input, "mutation", "portal");

describe("contact", () => {
  test("a client changes their own email and phone: the login, the person and an event, nothing else", async () => {
    const c = clients()[0]!;
    const other = clients()[1]!;
    const otherBefore = w.get<{ email: string | null; phone: string | null }>("SELECT email, phone FROM people WHERE id = ?", other.person_id);
    const res = await update(c.id, { email: "new.address@example.test", phone: "555 555 0177" });
    expect(res.status).toBe(200);
    expect(MyAccount.parse(res.data)).toMatchObject({ email: "new.address@example.test", phone: "555 555 0177" });
    expect(w.get<Record<string, unknown>>("SELECT email FROM users WHERE id = ?", c.id)).toEqual({ email: "new.address@example.test" });
    expect(w.get<Record<string, unknown>>("SELECT email, phone FROM people WHERE id = ?", c.person_id)).toEqual({ email: "new.address@example.test", phone: "555 555 0177" });
    expect(w.get<Record<string, unknown>>("SELECT email, phone FROM people WHERE id = ?", other.person_id)).toEqual(otherBefore);
    const ev = w.get<{ household_id: string; data: string }>("SELECT household_id, data FROM events WHERE type = 'person.contact_updated' AND subject_id = ?", c.person_id);
    expect(ev.household_id).toBe(c.household_id);
    expect(JSON.parse(ev.data)).toEqual({ email: true, phone: true }); // which fields, never the values
  });

  test("the preparer sees the new details on the household", async () => {
    const c = clients()[2]!;
    await update(c.id, { email: "moved@example.test", phone: null });
    const hh = (await w.call(w.preparerId, "household.get", { householdId: c.household_id })).data as { members: { personId: string; email: string | null }[] };
    expect(hh.members.find((m) => m.personId === c.person_id)?.email).toBe("moved@example.test");
  });

  test("an email another login already has is refused, whatever its case, and nothing changes", async () => {
    const [a, b] = clients();
    const before = w.get<{ email: string }>("SELECT email FROM users WHERE id = ?", a!.id);
    const res = await update(a!.id, { email: b!.email.toUpperCase(), phone: null });
    expect({ status: res.status, message: res.error?.message }).toEqual({ status: 409, message: "That email is already used by another login." });
    expect(w.get<Record<string, unknown>>("SELECT email FROM users WHERE id = ?", a!.id)).toEqual(before);
  });

  test("a bad email or phone is a sentence", async () => {
    const c = clients()[3]!;
    expect((await update(c.id, { email: "nope", phone: null })).status).toBe(400);
    expect((await update(c.id, { email: "ok@example.test", phone: "12345" })).status).toBe(400);
  });

  test("clients only: the preparer has no account here, and nobody signed out gets in", async () => {
    expect((await w.call(w.preparerId, "me.get", undefined, "query", "admin")).status).toBe(403);
    w.use("live");
    expect((await w.call(null, "me.get", undefined, "query", "portal")).status).toBe(401);
  });
});

describe("reminders", () => {
  test("defaults, then a round trip", async () => {
    const c = clients().find((x) => !w.all("SELECT 1 FROM reminder_preferences WHERE user_id = ?", x.id).length)!;
    expect((await me(c.id)).reminders).toEqual([
      { kind: "requests", email: true, text: false },
      { kind: "letter", email: true, text: false },
      { kind: "invoice", email: true, text: false },
    ]);
    await update(c.id, { email: c.email, phone: "(555) 555-0142" });
    const res = await remind(c.id, { reminders: [{ kind: "invoice", email: false, text: true }] });
    expect(res.status).toBe(200);
    expect((await me(c.id)).reminders).toEqual([
      { kind: "requests", email: true, text: false },
      { kind: "letter", email: true, text: false },
      { kind: "invoice", email: false, text: true },
    ]);
    expect(w.all("SELECT 1 FROM events WHERE type = 'person.reminders_updated' AND subject_id = ?", c.person_id)).toHaveLength(1);
  });

  test("texts need a phone", async () => {
    const c = clients()[4]!;
    await update(c.id, { email: c.email, phone: null });
    const res = await remind(c.id, { reminders: [{ kind: "letter", email: true, text: true }] });
    expect({ status: res.status, message: res.error?.message }).toEqual({ status: 400, message: "Add a mobile phone to get reminders by text." });
  });

  test("returning clients in the demo already chose texts for the letter and the invoice", async () => {
    const u = w.get<{ user_id: string }>("SELECT user_id FROM reminder_preferences WHERE kind = 'requests' ORDER BY updated_at LIMIT 1");
    expect((await me(u.user_id)).reminders.map((r) => [r.kind, r.text])).toEqual([["requests", false], ["letter", true], ["invoice", true]]);
  });
});

describe("receipts", () => {
  // A paid invoice and a client on its return; someone with no access to it.
  const paid = () =>
    w.get<{ invoice_id: string; number: string; user_id: string; household_id: string }>(
      `SELECT b.invoice_id, i.number, ca.user_id, e.household_id
         FROM invoice_balances b JOIN invoices i ON i.id = b.invoice_id JOIN engagements e ON e.id = i.engagement_id
         JOIN client_access ca ON ca.engagement_id = e.id
        WHERE b.settlement = 'paid' ORDER BY i.number LIMIT 1`,
    );
  const receipt = (as: string, invoiceId: string, surface: "admin" | "portal" = "portal") => w.call(as, "invoice.receipt", { invoiceId }, "query", surface);

  test("the invoice's client gets lines, payments, practice and balance; the preparer too", async () => {
    const p = paid();
    const r = Receipt.parse((await receipt(p.user_id, p.invoice_id)).data);
    expect(r).toMatchObject({ invoiceNumber: p.number, receiptNumber: `R-${p.number}`, settlement: "paid", balanceCents: 0 });
    expect(r.paidCents).toBe(r.totalCents);
    expect(r.lines.reduce((s, l) => s + l.amountCents, 0)).toBe(r.totalCents);
    expect(r.payments.reduce((s, x) => s + x.amountCents, 0)).toBe(r.paidCents);
    expect(r.practice.practiceName.length).toBeGreaterThan(0);
    expect(r.practice).not.toHaveProperty("phone");
    expect(r.billedTo.length).toBeGreaterThan(0);
    expect(Receipt.parse((await receipt(w.preparerId, p.invoice_id, "admin")).data).invoiceId).toBe(p.invoice_id);
  });

  test("a part-paid invoice has a receipt for what's been paid", async () => {
    const part = w.get<{ invoice_id: string; user_id: string }>(
      "SELECT b.invoice_id, ca.user_id FROM invoice_balances b JOIN client_access ca ON ca.engagement_id = b.engagement_id WHERE b.settlement = 'partial' LIMIT 1",
    );
    const r = Receipt.parse((await receipt(part.user_id, part.invoice_id)).data);
    expect(r.settlement).toBe("partial");
    expect(r.balanceCents).toBeGreaterThan(0);
  });

  test("nobody from another household, and nothing to say whether it exists", async () => {
    const p = paid();
    const stranger = clients().find((c) => c.household_id !== p.household_id && !w.get<Record<string, unknown>>("SELECT 1 AS ok FROM client_access ca JOIN invoices i ON i.engagement_id = ca.engagement_id WHERE ca.user_id = ? AND i.id = ?", c.id, p.invoice_id))!;
    const res = await receipt(stranger.id, p.invoice_id);
    expect({ status: res.status, message: res.error?.message }).toEqual({ status: 404, message: "Return not found." });
    expect((await receipt(stranger.id, "019b0000-0000-7000-8000-000000000000")).status).toBe(404);
  });

  test("no receipt before any money, and none for a draft (which a client can't see at all)", async () => {
    const unpaid = w.get<{ invoice_id: string; user_id: string }>(
      "SELECT b.invoice_id, ca.user_id FROM invoice_balances b JOIN client_access ca ON ca.engagement_id = b.engagement_id WHERE b.status = 'issued' AND b.paid_cents = 0 LIMIT 1",
    );
    expect((await receipt(unpaid.user_id, unpaid.invoice_id)).status).toBe(400);
    const draft = w.get<{ invoice_id: string; user_id: string }>(
      "SELECT b.invoice_id, ca.user_id FROM invoice_balances b JOIN client_access ca ON ca.engagement_id = b.engagement_id WHERE b.status = 'draft' LIMIT 1",
    );
    if (draft) expect((await receipt(draft.user_id, draft.invoice_id)).status).toBe(404);
  });

  test("opening a receipt is in the access log", async () => {
    const p = paid();
    await receipt(p.user_id, p.invoice_id);
    expect(w.all("SELECT 1 FROM events WHERE type = 'receipt.viewed' AND subject_id = ? AND actor_user_id = ?", p.invoice_id, p.user_id).length).toBeGreaterThan(0);
  });
});
