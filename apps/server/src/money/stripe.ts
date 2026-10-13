import { timingSafeEqual } from "node:crypto";
import type { StripeConfig } from "../config";

// Stripe, TEST mode (ticket 09), without the SDK: two REST calls and the webhook signature check. Card details are
// typed on Stripe's own hosted page and never reach this server.

const API = "https://api.stripe.com/v1";

// Overridable in tests, so no test ever calls Stripe.
export const stripeHttp = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

async function call<T>(cfg: StripeConfig, method: "GET" | "POST", path: string, form?: Record<string, string>): Promise<T> {
  const res = await stripeHttp.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.secretKey}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe: ${body.error?.message ?? res.status}`);
  return body;
}

export type CheckoutSession = { id: string; url: string | null; status: "open" | "complete" | "expired"; payment_intent: string | null };

export function createCheckoutSession(
  cfg: StripeConfig,
  s: { amountCents: number; description: string; email?: string | null; invoiceId: string; paymentId: string; returnPath: string },
): Promise<CheckoutSession> {
  return call<CheckoutSession>(cfg, "POST", "/checkout/sessions", {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(s.amountCents),
    "line_items[0][price_data][product_data][name]": s.description,
    ...(s.email ? { customer_email: s.email } : {}),
    client_reference_id: s.paymentId,
    "metadata[invoice_id]": s.invoiceId,
    "metadata[payment_id]": s.paymentId,
    "payment_intent_data[metadata][invoice_id]": s.invoiceId,
    "payment_intent_data[metadata][payment_id]": s.paymentId,
    success_url: `${cfg.publicOrigin}${s.returnPath}?paid=1`,
    cancel_url: `${cfg.publicOrigin}${s.returnPath}`,
  });
}

export function getCheckoutSession(cfg: StripeConfig, id: string): Promise<CheckoutSession> {
  return call<CheckoutSession>(cfg, "GET", `/checkout/sessions/${encodeURIComponent(id)}`);
}

// Stripe-Signature: "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${raw body}`>". Reject anything older than five
// minutes so a captured delivery can't be replayed later.
export function verifySignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !signatures.length || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = Buffer.from(new Bun.CryptoHasher("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  return signatures.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// For tests and local fixtures: a header Stripe would send for this body.
export function signForTest(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${new Bun.CryptoHasher("sha256", secret).update(`${t}.${rawBody}`).digest("hex")}`;
}
