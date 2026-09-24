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
  are closed in live mode until auth (task 05). One host serves `/trpc`, `/api` (file upload/download),
  `/health` and `apps/web/dist`.
- **Access:** every client-facing procedure goes through `src/access.ts` (`engagementFor`, `documentFor`).
  Denials are NOT_FOUND. Identity comes from `src/identity.ts` — demo header/cookie today, sessions after task 05.
- `apps/web` — one React 19 + Vite SPA, role-gated `/portal` and `/admin` (arrives with the UI tickets).
- `apps/site` — marketing site (skelly-site, last).
- `packages/schema` — shared zod schemas. Product name lives in `src/product.ts` (one-line rename).

## Commands

- `bun install` · `bun run dev` · `bun run seed` · `bun test` · `bun run typecheck`
- Demo mode wipes and re-seeds `data/demo/` on every boot (25 invented households, see `apps/server/src/db/seed/`).
