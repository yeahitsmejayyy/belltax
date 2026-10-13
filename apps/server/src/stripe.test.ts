import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { useRuntime } from "./db/client";
import { signForTest, stripeHttp, verifySignature } from "./money/stripe";
import { demoWorld, ORIGIN } from "./test-harness";

// Ticket 09: paying an invoice with Stripe, test mode. Stripe is never called: stripeHttp.fetch is replaced, and the
// webhook is fed fixture events signed with a test secret.

const STRIPE = { secretKey: "sk_test_fixture", webhookSecret: "whsec_fixture", publicOrigin: "https://demo.example" };
let w: Awaited<ReturnType<typeof demoWorld>>;
let sessions: Map<string, { id: string; url: string; status: "open" | "complete" | "expired"; payment_intent: string | null }>;
let calls: { method: string; url: string; body: string }[];

beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => {
  useRuntime({ db: w.db, storage: w.storage, mode: "demo", stripe: STRIPE });
  w.db.run("DELETE FROM payments WHERE provider = 'stripe'"); // each test starts from the seeded, unpaid invoices
  sessions = new Map();
  calls = [];
  stripeHttp.fetch = async (url, init) => {
    calls.push({ method: String(init.method), url, body: String(init.body ?? "") });
    if (init.method === "POST") {
      const id = `cs_test_${sessions.size + 1}`;
      const s = { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: "open" as const, payment_intent: null };
      sessions.set(id, s);
      return Response.json(s);
    }
    const id = url.split("/").pop()!;
    return Response.json(sessions.get(id));
  };
});
afterAll(() => w.cleanup());

const unpaid = () =>
  w.get<{ id: string; client: string; balance: number }>(
    `SELECT b.invoice_id AS id, u.id AS client, b.balance_cents AS balance FROM invoice_balances b
       JOIN return_people rp ON rp.engagement_id = b.engagement_id AND rp.role = 'primary' JOIN users u ON u.person_id = rp.person_id
      WHERE b.status = 'issued' AND b.balance_cents > 0 AND b.paid_cents = 0 AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = b.invoice_id) LIMIT 1`,
  );
const payment = (invoiceId: string) => w.get<{ id: string; status: string; checkout_session_id: string; failure_message: string | null } | null>("SELECT id, status, checkout_session_id, failure_message FROM payments WHERE invoice_id = ? AND provider = 'stripe' ORDER BY created_at DESC LIMIT 1", invoiceId);
const settlement = (invoiceId: string) => w.get<{ settlement: string }>("SELECT settlement FROM invoice_balances WHERE invoice_id = ?", invoiceId).settlement;
const hook = (event: object, sign = true) => {
  const body = JSON.stringify(event);
  return w.portal(new Request(`${ORIGIN}/api/stripe/webhook`, { method: "POST", headers: sign ? { "stripe-signature": signForTest(body, STRIPE.webhookSecret) } : {}, body }));
};
let n = 0;
const evt = (type: string, object: object) => ({ id: `evt_test_${++n}`, type, data: { object } });

async function checkout(invoiceId: string, as: string) {
  const res = await w.call(as, "payment.checkout", { invoiceId }, "mutation", "portal");
  return res;
}

describe("starting a checkout", () => {
  test("is set up only with keys", async () => {
    expect((await w.call(unpaid().client, "payment.online", undefined, "query", "portal")).data).toEqual({ enabled: true });
    useRuntime({ db: w.db, storage: w.storage, mode: "demo", stripe: null });
    expect((await w.call(unpaid().client, "payment.online", undefined, "query", "portal")).data).toEqual({ enabled: false });
    expect((await checkout(unpaid().id, unpaid().client)).status).toBe(412);
  });

  test("sends the client to Stripe for the balance, with a pending payment", async () => {
    const inv = unpaid();
    const res = await checkout(inv.id, inv.client);
    expect(res.status).toBe(200);
    expect((res.data as { url: string }).url).toStartWith("https://checkout.stripe.com/");
    const form = new URLSearchParams(calls[0]!.body);
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe(String(inv.balance));
    expect(form.get("success_url")).toBe("https://demo.example/invoice?paid=1");
    expect(payment(inv.id)).toMatchObject({ status: "pending" });
    expect(settlement(inv.id)).toBe("unpaid"); // pending money isn't money
  });

  test("asking again reuses the open checkout instead of starting another", async () => {
    const inv = unpaid();
    const a = await checkout(inv.id, inv.client);
    const b = await checkout(inv.id, inv.client);
    expect((b.data as { url: string }).url).toBe((a.data as { url: string }).url);
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE invoice_id = ?", inv.id).n).toBe(1);
  });

  test("someone else's invoice is not found", async () => {
    const inv = unpaid();
    const stranger = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' AND id <> ? LIMIT 1", inv.client).id;
    const other = await checkout(inv.id, stranger);
    expect([404]).toContain(other.status);
  });
});

describe("the webhook", () => {
  test("refuses a missing or wrong signature", async () => {
    expect((await hook(evt("checkout.session.completed", { id: "cs_x", object: "checkout.session" }), false)).status).toBe(400);
    const body = "{}";
    expect(verifySignature(body, signForTest(body, "whsec_other"), STRIPE.webhookSecret)).toBe(false);
    expect(verifySignature(body, signForTest(body, STRIPE.webhookSecret, Math.floor(Date.now() / 1000) - 3600), STRIPE.webhookSecret)).toBe(false);
  });

  test("a completed checkout marks the payment paid, once, even if Stripe sends it twice", async () => {
    const inv = unpaid();
    await checkout(inv.id, inv.client);
    const p = payment(inv.id)!;
    const e = evt("checkout.session.completed", { id: p.checkout_session_id, object: "checkout.session", payment_status: "paid", payment_intent: "pi_test_1" });
    expect((await hook(e)).status).toBe(200);
    expect((await hook(e)).status).toBe(200);
    expect(payment(inv.id)).toMatchObject({ status: "succeeded" });
    expect(settlement(inv.id)).toBe("paid");
    expect(w.eventsOf("payment.succeeded", p.id)).toHaveLength(1);
  });

  test("a declined card marks it failed with Stripe's reason; the invoice shows the failed attempt", async () => {
    const inv = unpaid();
    await checkout(inv.id, inv.client);
    const p = payment(inv.id)!;
    await hook(evt("payment_intent.payment_failed", { id: "pi_test_2", object: "payment_intent", metadata: { payment_id: p.id }, last_payment_error: { message: "Your card was declined." } }));
    expect(payment(inv.id)).toMatchObject({ status: "failed", failure_message: "Your card was declined." });
    expect(settlement(inv.id)).toBe("failed_last_attempt");
  });

  test("an abandoned checkout disappears instead of counting as a failure", async () => {
    const inv = unpaid();
    await checkout(inv.id, inv.client);
    const p = payment(inv.id)!;
    await hook(evt("checkout.session.expired", { id: p.checkout_session_id, object: "checkout.session" }));
    expect(payment(inv.id)).toBeNull();
    expect(settlement(inv.id)).toBe("unpaid");
    expect(w.eventsOf("payment.checkout_closed", p.id)).toHaveLength(1);
  });

  test("a full refund marks it refunded, and the invoice can then be voided", async () => {
    const inv = unpaid();
    await checkout(inv.id, inv.client);
    const p = payment(inv.id)!;
    await hook(evt("checkout.session.completed", { id: p.checkout_session_id, object: "checkout.session", payment_status: "paid", payment_intent: "pi_test_3" }));
    expect((await w.call(w.preparerId, "invoice.void", { invoiceId: inv.id, reason: "test void" }, "mutation")).status).toBe(412);
    await hook(evt("charge.refunded", { id: "ch_test_3", object: "charge", payment_intent: "pi_test_3", refunded: true, amount: inv.balance, amount_refunded: inv.balance }));
    expect(payment(inv.id)).toMatchObject({ status: "refunded" });
    expect((await w.call(w.preparerId, "invoice.void", { invoiceId: inv.id, reason: "Refunded in full" }, "mutation")).status).toBe(200);
  });

  test("only on the portal listener, and only when Stripe is set up", async () => {
    const e = evt("checkout.session.completed", { id: "cs_none", object: "checkout.session" });
    const body = JSON.stringify(e);
    const admin = await w.handler(new Request(`${ORIGIN}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": signForTest(body, STRIPE.webhookSecret) }, body }));
    expect(admin.status).toBe(404);
    useRuntime({ db: w.db, storage: w.storage, mode: "demo", stripe: null });
    expect((await hook(e)).status).toBe(404);
  });
});
