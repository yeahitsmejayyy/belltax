# belltaxprep

Client portal + preparer admin for a small tax practice. Everything around the return; never the
return itself (ProSeries owns that). Read `belltaxprep-portal.md` for the brief.

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
  the `AppRouter` contract (`bun run --filter @app/server types:emit` refuses a leaky one). Preparer procedures
  are closed in live mode until auth (task 05). **Two listeners, both 127.0.0.1:** portal on `PORT` (3000, the only one a
  tunnel may forward; serves `apps/portal/dist`) and admin on `ADMIN_PORT` (3001; serves `apps/admin/dist`). Preparer
  procedures are 404 on the portal and a preparer identity is ignored there (`src/identity.ts`, `src/trpc.ts`).
- **Access:** every client-facing procedure goes through `src/access.ts` (`engagementFor`, `documentFor`).
  Denials are NOT_FOUND. Identity comes from `src/identity.ts` — demo header/cookie today, sessions after task 05.
- `apps/portal` — the client portal: its own React 19 + Vite app, mobile-first (arrives with ticket 12).
- `apps/admin` — the preparer admin: its own React 19 + Vite app from skelly-admin (ticket 13).
  Both talk to the same backend; access is decided server-side, never by which app is calling.
  Frontends import the `AppRouter` contract and `packages/ui`, never server source.
- `packages/ui` — the shared design system: tokens + shadcn/Radix primitives (ticket 11).
- `apps/site` — marketing site (skelly-site, last).
- `packages/schema` — shared zod schemas. Product name lives in `src/product.ts` (one-line rename).

## Commands

- `bun install` · `bun run dev` · `bun run seed` · `bun run migrate [--status]` · `bun test` · `bun run typecheck`
- Live only (see `docs/live-runbook.md`): `bun run start` · `bun run live:check` · `bun run backup` ·
  `bun run backup:verify <file>` · `bun run restore <file> <empty-dir>` · `bun run purge [--confirm]`
- Demo mode wipes and re-seeds `data/demo/` on every boot (25 invented households, see `apps/server/src/db/seed/`).
- **Schema changes are new numbered migrations** in `apps/server/src/db/migrations/` — never edit an applied one.
  Live refuses to boot behind the code; back up, then `bun run migrate`. See `docs/migrations.md`.
