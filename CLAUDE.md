# belltaxprep

[![CI](https://github.com/yeahitsmejayyy/belltax/actions/workflows/ci.yml/badge.svg)](https://github.com/yeahitsmejayyy/belltax/actions/workflows/ci.yml)

Client portal + preparer admin for a small tax practice. Everything around the return; never the
return itself (ProSeries owns that). Read `.docs/belltaxprep-portal.md` for the brief (kept out of git: private notes).

## Non-negotiable

- **Two data worlds** — read `docs/two-data-worlds.md`. Nothing real ever enters this repo, a
  commit, a log, or this session. Demo data is seeded only.
- **Never run `git commit`** and never add a co-author line. PJ commits and pushes.

## Finishing a command-center ticket

Work comes off the command-center board, one ticket at a time. When a ticket is done:

1. Verify: `bun test` and `bun run typecheck` pass.
2. Run `cmc finish` to move it to review.
3. **Hand over a one-line commit message** as text in a code block. Every ticket, no exceptions.
4. Tell PJ exactly what to test, then stop. Don't start the next ticket until PJ approves.

## Layout

- `apps/server` — Bun + tRPC backend (skelly-backend). Config and run mode in `src/config.ts`.
  Routes read the DB via `runtime()` (`src/db/client.ts`), never the tRPC context — keeps Bun types out of
  the `AppRouter` contract (`bun run --filter @app/server types:emit` refuses a leaky one). Sign-in (ticket 05):
  `src/auth/auth.ts` (sessions, one-time links, lockout), `src/rest/auth.ts` (`/api/auth/*`, httpOnly cookie
  `btp_session_<surface>`), `auth.state` / `login.link` / `login.signOutEverywhere` (`src/routes/auth.ts`). **MFA for
  everyone** (ticket 05b, `docs/wisp.md` §5): `src/auth/mfa.ts` (passkeys via @simplewebauthn, RP ID = the page's host,
  never an IP; recovery codes), `src/auth/totp.ts` (hand-rolled RFC 6238). Clients: a passkey, or password + app. Preparer:
  passkey and password + app, plus recovery codes. Links (invite/reset, and "Lost your passkey?" `POST /api/auth/recover`)
  set it up; a reset clears old factors. `mfa.*` for Settings; screens in `packages/ui` `mfa-cards.tsx` +
  `sign-in-flows.tsx`, wired through `@app/ui/auth-client`. Tests use a software passkey (`src/test-auth.ts`); every non-GET
  must come from our own Origin (`fromOurPages`, `http.ts`); `bun run preparer:invite <email>` makes the preparer's first
  link (live). **Two listeners, both 127.0.0.1:** portal on `PORT` (3000, the only one a
  tunnel may forward; serves `apps/portal/dist`) and admin on `ADMIN_PORT` (3001; serves `apps/admin/dist`). Preparer
  procedures are 404 on the portal and a preparer identity is ignored there (`src/identity.ts`, `src/trpc.ts`).
- **Access:** every client-facing procedure goes through `src/access.ts` (`engagementFor`, `documentFor`).
  Denials are NOT_FOUND. **The portal is send-only for clients** (ticket 52, `docs/wisp.md`): `GET /api/documents/:id/file` is
  404 for a client; submitted intake answers (`intake.get`) and answered questions' `response` (`request.list`) come back
  empty to clients; letter signature evidence is preparer-only. Never add a client path that reads back what they sent. Identity comes from `src/identity.ts`: a session first, then (demo mode only) the demo header/cookie.
- `apps/portal` — the client portal: React 19 + Vite + Tailwind v4 on `packages/ui`, phone first (402px), top nav
  from `md` (ticket 12). Dev on :5175, proxied to the portal listener (:3000, override with `PORTAL_API_PORT`, never
  `PORT`, which launchers set for Vite itself). Screens are `src/pages/*` (lazy per route) inside `src/shell/shell.tsx`
  (header, account menu, bottom tabs / top nav with counts, offline banner). `useReturn()` (`lib/return.tsx`) is the
  return being shown (newest by default, remembered per device). A 401 anywhere clears the demo identity and goes to
  sign-in (both apps, `main.tsx`): the demo re-seeds on every boot. Intake renders `INTAKE_V1` (`components/intake`),
  autosaves drafts and sends emptied answers as `clear`. Auth screens (sign in, invite, set password, link gone, expired) are
  `packages/ui` `auth-cards.tsx`; `/invite/:token` in both apps.
- `apps/admin` — the preparer admin: React 19 + Vite from skelly-admin (ticket 13). Dev on :5174, proxied to :3001.
  Screens are `src/pages/*` (lazy-loaded per route; the return is `pages/return/`, one file per tab) inside
  `src/shell/shell.tsx` (sidebar, header, phone bottom tabs + More button). Shared hooks: `usePageTitle`
  (`shell/header-slots`), `useTaxYear` (`lib/tax-year`), `useInvite` (`shell/invite`), `useStageMove`
  (`components/stage-move`, every stage change goes through its dialog). Filters and tabs live in the URL (nuqs).
  Page roots are `grid grid-cols-1` so wide content scrolls inside its box, never the page, on phones.
  Both talk to the same backend; access is decided server-side, never by which app is calling.
  Frontends type against a **committed copy** of the contract (`src/lib/app-router.d.ts`), never server source.
  After changing any procedure run `bun run sync:types`; `contract.test.ts` fails while a copy is stale.
  Demo identity is a per-app cookie (`btp_demo_portal` / `btp_demo_admin`): browsers share cookies across ports.
- `packages/ui` — the design system both apps share. `tokens.css` holds every value (the belltax. palette, charcoal and
  chartreuse, light/dark; Space Grotesk body and Bricolage Grotesque headings, self-hosted; radius, motion). The brand
  is the outlined b. mark and belltax. wordmark (`BellMark`, `Wordmark`, `Logo` in `components/logo.tsx`; SVGs and favicons
  from `src/brand/`). `theme.css` maps them to Tailwind v4 utilities. There are also brand marks, `cn`, and the demo
  identity helpers. The rules behind the values: `principles.md` (root); `tokens.test.ts` enforces its contrast rule.
  Design references: `.assets/` (gitignored), starting with its README and manifest. Shared components live in
  `packages/ui/src/components` (shadcn primitives plus the product pieces: StagePill, StatusChip, DataTable, Chart, Logo,
  Banner, EmptyState, FileDropzone, Stepper, StatCard, Board, Timeline, DocumentViewer, BottomTabs; money/dates in `format.ts`); apps import
  `@app/ui/components/<name>`, never copy them. Every component gets stories in `packages/ui/src/stories` (Storybook sections: Principles, Tokens, Primitives, Admin, Site); interaction tests go in a hidden `<Name>Test` twin
  (`tags: ["!dev"]`), never on the visible story. The admin shell is `AppSidebar` + `AppHeader` (on shadcn's `sidebar`). Search is `InlineSearch` (header field with a results dropdown) + `CommandPalette` (⌘K), both fed the same `SearchGroup[]`,
  from `search.query` (server: word-prefix SQL, no index; never searches SSN digits). Invite client / Add without invite open `InviteClientDialog` (Household → Members → Filers → Send). Story fixtures live in `packages/ui/src/stories/fixtures.tsx`.
- `apps/site` — the marketing site (ticket 14): one static page, React + Tailwind on `packages/ui`, dev on :5176. Prices and
  the practice's details are read at load from the portal's `pricing.public` / `practice.public` (`src/lib/public.tsx`;
  the server lets any origin GET only those two, `SITE_READABLE` in `http.ts`), never copied; a deployed site sets
  `VITE_PORTAL_ORIGIN`. Unavailable → no prices shown, never stale ones. "How it works" is a scripted walkthrough of
  design-system mini screens with invented data (`src/components/walkthrough/`), no server. "Get started" mails the
  practice until self sign-up exists. The copy speaks as the brand and pairs clients with "your tax agent" (`useNames()`):
  it never names the preparer or presents the practice as one person; reviews stay out until there are real, consented quotes (`ReviewCards` story). Its sections are in Storybook under Site (`apps/site/src/stories`), rendered
  from the real components with invented data via `PublicFixture`; site-only CSS is `src/site.css`, scoped to `.site-root`.
- `packages/schema` — shared zod schemas. Product name lives in `src/product.ts` (one-line rename).
- **The practice's details** (name, preparer, reply-to email, texting phone, city/state) live in `practice_settings`
  (one row, migration 007): `settings.practice.*` to edit, `practice.public` for the portal and site (no phone). Letters,
  invoices and invites read them; never hard-code the practice name.
- **E-file status** is recorded by hand from ProSeries (`efile_submissions`, migration 008; `src/efile/efile.ts`): moving to
  Filed submits federal and state, `engagement.recordEfile` answers or resubmits, Complete needs both accepted. One row per
  attempt, answered once, never deleted.
- **A client's own settings** are `me.*` (`src/routes/me.ts`): their email (login + person, unique across logins) and
  phone, and reminder choices (`reminder_preferences`, migration 009; no row = email on, text off; texts need a phone).
  Clients only, their own person only; each change is an event on the household. **Receipts** are `invoice.receipt`
  (`src/routes/receipt.ts`): data for the portal to render and print, one per issued invoice with money on it, numbered
  `R-<invoice number>`, same access as the invoice (NOT_FOUND otherwise), logged as `receipt.viewed`.
- **Paying online** is Stripe, TEST mode only (ticket 09, `docs/stripe.md`): `payment.checkout` opens Stripe's hosted page,
  `POST /api/stripe/webhook` (`src/rest/stripe.ts`, portal listener only) settles it; no SDK (`src/money/stripe.ts`). Keys
  `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, both or neither; a live key refuses to boot.
- **Email** (ticket 51, `docs/email.md`): `src/email/` — `send()` with two drivers: Resend (live, `RESEND_API_KEY` +
  `EMAIL_FROM`) or the outbox (everywhere else, never sends; admin Outbox page, `email.outbox`). Invite, reset and
  sign-in-changed templates; every send is an event (to + template, never a link).
- **Pricing** is packages (one per filing status) + add-ons (`price_packages`, `price_addons`, migration 006), edited via
  `settings.pricing.*`; `pricing.public` feeds the marketing site. `src/money/pricing.ts` turns a return's facts (filing
  status, sources, intake answers) into a suggested invoice. An add-on with no price is "Included": named on the invoice
  (`invoice_included`), never a $0 line (R26).

## Commands

- `bun install` · `bun run dev` (server) · `bun run dev:portal` · `bun run dev:admin` · `bun run dev:site` · `bun run build` (all three)
- `bun run sync:types` · `bun run seed` · `bun run migrate [--status]` · `bun test` · `bun run typecheck`
- Intake questions live in `packages/schema/src/intake/v1.ts` (the portal imports it; the server validates with it).
  After editing, run `bun run intake:doc` to regenerate `docs/intake-v1.md`; a test fails while it's stale.
- `bun run storybook` (:6006) · `bun run storybook:build` · `bun run test:storybook` (stories + play functions in
  Chromium via Vitest 4; set `CHROMIUM_PATH` to use a Chromium already on the machine).
- **Hosted demo** (ticket 15, `docs/demo-deploy.md`): portal https://belltax-demo.onrender.com/, admin https://belltax-demo.onrender.com/admin/, site https://belltaxprep.vercel.app/ (Render free plan; switch to Starter before sharing widely). `Dockerfile` + `render.yaml` (portal, admin at `/admin/` on the same
  port via `withAdminMounted`, only with `DEMO_PUBLIC=1`, which live refuses), `vercel.json` (site), Chromatic in
  `.github/workflows/chromatic.yml` (needs the `CHROMATIC_PROJECT_TOKEN` secret). Public demo: uploads off (clients send a server-drawn sample instead, `POST /api/documents/sample`, `sampleDocument` in `rest/documents.ts`), re-seeded every
  `DEMO_RESET_HOURS`, and a front door (`demo.tour`; `DemoFrontDoor`, `DemoBar`, `TryThis` in `components/demo-tour.tsx`; `useDemoTour` in each app's `lib/demo-tour.ts`). Admin URLs go through `at()` (`apps/admin/src/lib/base.ts`) so the `ADMIN_BASE=/admin/` build works.
- `bun run check:data` — fails if anything tracked looks like real data (databases, backups, uploads, `.env`,
  PDFs/HEIC, or an SSN not starting with 9). CI (`.github/workflows/ci.yml`) runs it on every push, then
  typecheck, tests and both app builds. The same four commands locally mean CI will pass.
- Live only (see `docs/live-runbook.md`): `bun run start` · `bun run live:check` · `bun run backup` ·
  `bun run backup:verify <file>` · `bun run restore <file> <empty-dir>` · `bun run purge [--confirm]`
- `bun run export <householdId|--all> [--encrypt]` · `bun run export:open <file> <empty-dir>` — the offline client
  record (record.json + files + README) into `EXPORT_DIR`, outside the repo; `src/export/household.ts`. A new table must
  be added to `HOUSEHOLD_SCOPE` or `PRACTICE_WIDE` there (a test fails until it is).
- `bun run bench:seed [copies]` · `bun run bench` — the scale check (demo data under `data/bench/`, never live).
  Budget 100 ms per hot path at 2,000 households; results and query plans in `docs/performance.md`.
- Demo mode wipes and re-seeds `data/demo/` on every boot (25 invented households, see `apps/server/src/db/seed/`).
- **Schema changes are new numbered migrations** in `apps/server/src/db/migrations/` — never edit an applied one.
  Live refuses to boot behind the code; back up, then `bun run migrate`. See `docs/migrations.md`.
