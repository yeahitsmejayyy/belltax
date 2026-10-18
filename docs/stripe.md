# Paying online with Stripe (test mode)

Ticket 09. A client pays an invoice's balance on Stripe's hosted checkout page; Stripe tells the server how it went
through a signed webhook. **Test mode only:** the server refuses to start with a live key. Card details are typed on
Stripe's page and never reach this server.

## How it works

1. Portal → Invoice → **Pay $X** calls `payment.checkout`. The server creates a Checkout Session for the balance and
   writes a `pending` Stripe payment (`apps/server/src/routes/invoice.ts`). Asking again reuses an open session.
2. The client pays on Stripe and comes back to `/invoice?paid=1`, which waits a few seconds for the webhook.
3. `POST /api/stripe/webhook` (`apps/server/src/rest/stripe.ts`): checks the `Stripe-Signature`, records the event in
   `webhook_receipts` first (a repeated delivery does nothing, R29), then:

| Stripe event | What changes |
|---|---|
| `checkout.session.completed` (paid), `checkout.session.async_payment_succeeded` | payment → `succeeded` |
| `payment_intent.payment_failed`, `checkout.session.async_payment_failed` | payment → `failed`, with Stripe's reason |
| `checkout.session.expired` | the pending payment is removed (an abandoned checkout isn't a failure); the history keeps a note |
| `charge.refunded` (in full) | payment → `refunded`; the invoice can then be voided |

Every change is an event with actor `stripe`. Refunds are made in the Stripe dashboard. No SDK: two REST calls and
the signature check live in `apps/server/src/money/stripe.ts`.

## Keys

Both or neither (`apps/server/src/config.ts`). Without them, the Pay button stays off and says so.

| Variable | Where it comes from |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys, **test mode**, the `sk_test_…` secret key |
| `STRIPE_WEBHOOK_SECRET` | the webhook endpoint's signing secret, `whsec_…` (below) |
| `PUBLIC_ORIGIN` | where clients come back to after paying. Local default: `http://localhost:5175` |

Never commit them: they go in `apps/server/.env` (gitignored; Bun loads it when the server starts) or the host's
environment settings.

## Local development

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,payment_intent.payment_failed,charge.refunded
```

`stripe listen` prints a `whsec_…` secret: put it in `apps/server/.env` as `STRIPE_WEBHOOK_SECRET`, with your
`sk_test_…` key as `STRIPE_SECRET_KEY`, then restart `bun run dev`. Pay with card `4242 4242 4242 4242`, any future
date, any CVC. `4000 0000 0000 0002` is declined.

## The hosted demo (Render)

1. Stripe → Developers → Webhooks → **Add endpoint**: `https://belltax-demo.onrender.com/api/stripe/webhook`, with the
   events in the table above.
2. Render → belltax-demo → Environment: set `STRIPE_SECRET_KEY` (test) and `STRIPE_WEBHOOK_SECRET` (that endpoint's
   signing secret). Render redeploys.
