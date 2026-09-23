# belltaxprep-portal

*Written 2026-09-22 · kickoff brief for this repo · read this first*

belltaxprep is also a business; its notes live in the Sprout vault at
`jayyy-os/projects/belltaxprep/`. **This file is about the software**: a client portal for a small
tax practice, built as the portfolio system for the job hunt and as a real tool for season one.

---

## What this is

A SaaS-shaped product with three surfaces:

1. **Marketing site** — one page that sells the practice and routes new clients into intake.
2. **Client portal** — the client signs in, fills intake, uploads documents, signs the engagement
   letter, sees where their return stands, and pays the invoice.
3. **Preparer admin** — the pipeline: every client, what stage they're in, what's missing, what's
   owed. Plus the offline client record.

Underneath all three: **one design system**, tokens in CSS, components in Storybook with
interaction tests and visual regression on every PR.

## What it is NOT

- **Not a filing engine and not a ProSeries replacement.** Intuit ProSeries stays the system of
  record for preparing and e-filing returns; that software is paid for on purpose. This never
  computes a return, never touches a 1040, never e-files.
- Not a bookkeeping product. Not a CRM for anyone else's practice, at least not in v1.

What it *is*, in one line: **everything around the return** — intake, documents, status, signature,
payment, and a durable local copy of each client's profile that outlives any vendor subscription.

## The two data worlds — the rule that governs everything

This project holds real taxpayer data and is also a public portfolio piece. Those two facts fight,
so the line is drawn now and never crossed:

| | Demo world | Real world |
|---|---|---|
| Data | Seeded, invented households | Actual clients |
| Where | Public repo, deployed demo, every interview walkthrough | One local instance, on hardware under your control |
| Rule | Nothing real ever appears here | Never pushed, never deployed, never screen-shared |

Consequences to build in from the first commit:

- A seed script that generates plausible fake households (names, W-2s, IHSS cases, documents).
  **Every screenshot, demo and interview uses these.**
- Real data lives outside the repo. `.gitignore` the database, uploads, and any `.env` with keys.
  Uploads encrypted at rest; the local instance never opens a public port.
- Two run modes — demo and live — and the UI says which one it's in. That badge is also a nice
  detail to show in the walkthrough.
- **A WISP is not optional.** A paid preparer who keeps taxpayer data needs a written information
  security plan under the FTC Safeguards Rule; the IRS lays out what it has to cover in Publication
  4557. Write it as part of this project — it doubles as a document that makes the build look
  professional rather than naive. Not legal advice; confirm the current requirements.
- Nothing about a real client ever goes into an AI chat, this vault, or a commit message.

## Stack

The Skelly stack, since this is also the proof that it works:

- **Backend** — Bun + tRPC + zod, SQLite locally (Postgres if the deployed demo needs it), schema first.
- **Client portal / admin** — React 19 + Vite + TypeScript, Tailwind v4 CSS-first tokens, shadcn/Radix primitives, React Router, nuqs for URL state, TanStack Query.
- **Design system** — tokens in CSS, components in Storybook at the repo root, interaction tests, Chromatic visual regression on every PR, `principles.md` as the first Storybook page.
- **Payments** — Stripe **test mode**: Checkout for invoices/deposits, webhooks updating status in the DB, customer billing portal, a designed failed-payment state.
- **Marketing site** — skelly-site.
- **Docs/e-sign** — engagement letters; decide whether to integrate a signature vendor or store a typed signature with an audit trail (v1 probably the latter).

## Milestones

| By | Milestone |
|---|---|
| Oct 4 | Name, one-line pitch, `principles.md` (8–12 interface rules with numbers), tokens in CSS, schema drafted |
| Oct 18 | Design system in Storybook: story per state, interaction tests, Chromatic on every PR |
| Oct 25 | Marketing site, real copy, pricing linked to test checkout |
| Nov 8 | Portal + admin: sign-in, intake, document upload, pipeline, the core flow end to end |
| Nov 15 | Payments wired in test mode, including the failed-payment state |
| Nov 22 | Case study on itspjbell, 10-minute walkthrough rehearsed |

## Start order for the new chat

Empty root. In this order:

1. Confirm scope and the name; init the repo; `principles.md` and the two-data-worlds rule written
   down before any feature code.
2. **Schema first** — clients, households, engagements (tax year), documents, tasks, invoices,
   events/audit. The data shape decides the product.
3. Tokens in CSS, then the first four primitives in Storybook.
4. Backend from skelly-backend; one real tRPC procedure end to end.
5. Portal shell and admin shell from skelly-admin; the core flow.
6. Stripe test mode.
7. Marketing site last — it sells a thing that already exists.

## How I work (for the new chat)

- Name is **Doom**. Concise, lead with the answer, never a yes-man, first principles.
- Complexity has to earn its keep — **with one standing exception on this project**: it's a
  portfolio piece as much as a tool, so the full system (landing + portal + admin + payments +
  design system) is the deliberate scope. Say so if it starts sprawling past that.
- PJ tests every change himself. Finish, say what to look for, stop.
- Commit messages are one line, handed over as text. PJ commits and pushes; never run `git commit`,
  never add a co-author line.
- Applications and interviews do not pause for this build.

## Open questions to settle early

- **Name and domain.** belltaxprep, or a product name distinct from the practice?
- **Season one:** does this actually run the 2027 season with real clients, or stay a demo until
  after the job hunt? The answer changes how much of the security work is required now.
- **The friend.** A business analyst with his own enterprise-shaped tax platform, not live. Worth an
  hour with him before Oct 4. Questions to bring: what steps actually eat the time in season; what
  he'd never let a client self-serve; how he models a household versus a return; what his intake
  asks and why; what he'd cut if he rebuilt it.
- **Hosting.** Demo on Vercel + Render. The live instance stays local — decide now whether it's
  laptop-only or the home lab.
- **Offline copies.** What exactly gets kept: client profile, prior-year summary, documents? Export
  format? A manual export from ProSeries, or typed in during intake?
