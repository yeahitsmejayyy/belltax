import { now } from "@app/schema";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { verifySignature } from "../money/stripe";
import { dropExpiredCheckout } from "../routes/invoice";

// POST /api/stripe/webhook (ticket 09, test mode). Stripe tells us how a checkout went. The signature is checked against
// the raw body; each event is written to webhook_receipts first, so a repeated delivery changes nothing (R29). Every
// change to a payment is logged with actor 'stripe'. Card details never arrive here: only ids, amounts and outcomes.

type StripeObject = {
  id: string;
  object: string;
  payment_status?: string;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
  last_payment_error?: { message?: string } | null;
  refunded?: boolean;
  amount?: number;
  amount_refunded?: number;
};
type StripeEvent = { id: string; type: string; data: { object: StripeObject } };
type PaymentRef = { id: string; status: string; amount_cents: number; household_id: string; engagement_id: string };

const ok = () => Response.json({ received: true });

export async function stripeWebhook(req: Request): Promise<Response> {
  const cfg = runtime().stripe;
  if (!cfg) return new Response("Not found", { status: 404 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("stripe-signature"), cfg.webhookSecret)) return Response.json({ error: "Bad signature." }, { status: 400 });
  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return Response.json({ error: "Not JSON." }, { status: 400 });
  }

  const { db } = runtime();
  const fresh = db.query("INSERT INTO webhook_receipts (provider, event_id, received_at) VALUES ('stripe', ?, ?) ON CONFLICT DO NOTHING").run(event.id, now()).changes === 1;
  if (!fresh) return ok(); // a repeated delivery: already handled

  const o = event.data.object;
  const find = (where: string, value: string | null | undefined) =>
    value
      ? db
          .query<PaymentRef, [string]>(
            `SELECT p.id, p.status, p.amount_cents, e.household_id, e.id AS engagement_id
               FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN engagements e ON e.id = i.engagement_id
              WHERE p.provider = 'stripe' AND ${where} = ?`,
          )
          .get(value)
      : null;
  const bySession = () => find("p.checkout_session_id", o.id);
  const byIntent = () => find("p.id", o.metadata?.payment_id) ?? find("p.payment_intent_id", o.payment_intent ?? (o.object === "payment_intent" ? o.id : null));

  const settle = (p: PaymentRef | null | undefined, status: "succeeded" | "failed" | "refunded", extra: { intent?: string | null; message?: string | null } = {}) => {
    if (!p || p.status === status || p.status === "refunded") return;
    if (status === "failed" && p.status === "succeeded") return; // a late decline doesn't undo money received
    db.transaction(() => {
      db.run("UPDATE payments SET status = ?, payment_intent_id = COALESCE(?, payment_intent_id), failure_message = ?, updated_at = ? WHERE id = ?", [
        status,
        extra.intent ?? null,
        status === "failed" ? (extra.message ?? "The payment didn't go through.") : null,
        now(),
        p.id,
      ]);
      appendEvent(db, {
        actor: "stripe",
        type: `payment.${status}`,
        subjectType: "payment",
        subjectId: p.id,
        householdId: p.household_id,
        engagementId: p.engagement_id,
        data: { amount_cents: p.amount_cents, stripe_event: event.type },
      });
    })();
  };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      if (o.payment_status === "paid") settle(bySession(), "succeeded", { intent: o.payment_intent });
      break;
    case "checkout.session.async_payment_failed":
      settle(bySession(), "failed", { intent: o.payment_intent, message: "The bank didn't complete the payment." });
      break;
    case "checkout.session.expired": {
      const p = bySession();
      if (p?.status === "pending") dropExpiredCheckout(p.id, "expired");
      break;
    }
    case "payment_intent.payment_failed":
      settle(byIntent(), "failed", { intent: o.id, message: o.last_payment_error?.message ?? null });
      break;
    case "charge.refunded":
      if (o.refunded || (o.amount != null && (o.amount_refunded ?? 0) >= o.amount)) settle(byIntent(), "refunded");
      break;
  }
  return ok();
}
