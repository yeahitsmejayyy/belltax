# Demo in three minutes

For an interview or a call. Open [belltax-demo.onrender.com](https://belltax-demo.onrender.com/sign-in) a minute
before (the free plan wakes slowly), on a laptop, with a phone nearby.

## 0:00 · What it is (20 seconds)

"I run a small tax practice. ProSeries prepares and e-files the return; everything around it lived in texts, emails and
paper. This is the portal my clients use and the back office I run the season from. It goes live in January with
real clients, so it was built to the rules a paid preparer has to follow. Everything you'll see is invented."

## 0:20 · The client (60 seconds)

1. **See it as a client.** Renata's home: three things need her, in order.
2. **Documents.** Her W-2 was sent back with a reason. **Send a sample again**: the demo won't take real uploads, so
   the server draws an invented one and it goes through the same path.
3. **Letter.** Read, type the name, sign. Point out: the signature records the exact text it signed.
4. On a phone, this is the same screen with bottom tabs. Phone first.

## 1:20 · The tax agent (60 seconds)

1. **Switch to the tax agent** (top bar). The dashboard: what's filed, what's collected, what's stuck.
2. **Inbox:** Renata's new W-2 is waiting for review.
3. **Pipeline:** drag a return to its next stage. Moving backwards asks for a reason.
4. **⌘K:** search any client, return or invoice.

## 2:20 · Paying (20 seconds)

Pick any invented client in Review (Omar, Freya or Lucia) → **Invoice** → **Pay** with `4242 4242 4242 4242`. Stripe
test mode; the webhook marks it paid and the receipt appears.

## 2:40 · Why it's built this way (20 seconds)

Pick the one that fits the room:

- **Two data worlds:** real data can't reach the repo or this demo, and code enforces it, not discipline.
- **The admin never faces the internet:** two listeners; preparer endpoints don't exist on the public one.
- **The database refuses bad states:** one return per filer per year, signatures tied to text, an append-only log.
- **One design system for three apps:** the Storybook link in the README.

## If they ask

- **Tests:** about 460 server tests and 160+ Storybook interaction tests on every push; Chromatic snapshots every story.
- **Security:** a written information security plan under the FTC Safeguards Rule (`docs/wisp.md`).
- **What's next:** real sign-in with MFA, the tunnel for live clients, shorter retention, a dry-run season.
