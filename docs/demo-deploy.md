# The hosted demo

The public demo is the demo world on the internet: the portal, the admin and the marketing site, all
showing the 25 invented households. Nothing real can reach it, by construction rather than by care.
Ticket 15. See [`two-data-worlds.md`](two-data-worlds.md) for the line this sits on.

| Piece | Where | URL |
|---|---|---|
| Portal | Render, Docker web service (`render.yaml`, `Dockerfile`), free plan | https://belltax-demo.onrender.com/ |
| Admin | The same service, mounted at `/admin/` | https://belltax-demo.onrender.com/admin/ |
| Site | Vercel, static (`vercel.json`) | https://belltaxprep.vercel.app/ |
| Storybook | Chromatic (`.github/workflows/chromatic.yml`) | the Chromatic project's permalink |

## How the admin is exposed

Locally the admin has its own listener on 127.0.0.1, and a tunnel may only ever forward the portal. A host
like Render gives a service one public port, so the hosted demo mounts the admin under `/admin/` on the
portal's port instead (`withAdminMounted` in `apps/server/src/http.ts`):

- Only when `DEMO_PUBLIC=1`, and `DEMO_PUBLIC` with `RUN_MODE=live` refuses to boot (`config.ts`).
- Requests under `/admin/` lose the prefix and go to the admin's own handler: admin surface, admin cookie.
  Preparer procedures stay 404 on the portal paths beside it.
- In live mode the mount answers 404 even if it were ever wired up.
- The admin is built with `ADMIN_BASE=/admin/` for this (`apps/admin/vite.config.ts`, `src/lib/base.ts`).

Tested in `apps/server/src/public-demo.test.ts`.

## Why nothing real can reach it

- **The image is demo only.** `Dockerfile` pins `RUN_MODE=demo` and `DEMO_PUBLIC=1`; there is no live setting
  in it or in `render.yaml`, and a test fails if one appears.
- **No data goes in.** `.dockerignore` leaves out `data/`, `live-data/`, uploads, backups, exports, `.env*`,
  databases, PDFs and phone photos, `.assets`, `.docs` and git history. A test checks the list.
- **Every boot is a fresh world.** Demo mode wipes `data/demo/` and seeds it; the container's disk isn't kept.
- **Uploads are off.** `POST /api/documents` answers 403 before reading the body, so a visitor can't send a
  real W-2 even by mistake. Instead, "Use a sample document" asks the server to draw an invented PDF
  (`POST /api/documents/sample`, JSON only, at most 25 per return) that goes through the same steps as an upload.
- **Typed answers don't last.** The world re-seeds every `DEMO_RESET_HOURS` (6 by default) as well as on
  every boot, and the UI says "Demo · sample data" throughout.
- **The repo is checked.** `bun run check:data` runs in CI on every push.

## Setting it up (once)

PJ does these: each needs an account sign-in.

1. **Render.** New → Blueprint → this repo. It reads `render.yaml` and builds the `Dockerfile`. When it's
   live, open `/health`: it should say `"mode":"demo"` and 25 households.
2. **Vercel.** New project → this repo, root directory left at the repo root (`vercel.json` builds
   `apps/site`). Add the environment variable `VITE_PORTAL_ORIGIN=https://<service>.onrender.com`, then
   deploy. The pricing section should show prices; if it says prices are unavailable, the origin is wrong
   or the Render service is asleep.

   **Which page (ticket 53).** The site has two pages: the full landing page and a splash page ("Opening
   January 2027", a placeholder with no call to action: the practice is invite-only). `VITE_SITE_PAGE=splash`
   makes the splash the page a deploy shows; unset or `landing` shows the landing page. Either way,
   `?page=landing` or `?page=splash` on the address previews the other without a redeploy. `VITE_CONTACT_EMAIL`
   (optional) is the address the landing page's email links use; without it they use the practice's reply-to
   email from the portal. The site stores and sends nothing. These are build-time settings: change one, then
   redeploy.
3. **Chromatic.** Sign in at chromatic.com with GitHub, add this repo, copy the project token, and save it
   as the `CHROMATIC_PROJECT_TOKEN` repository secret (GitHub → Settings → Secrets and variables → Actions).
   The next push to `main` becomes the baseline; pull requests then get a "UI Tests" check.

Render's free plan sleeps after a quiet spell, so the first visit can take a minute; each wake is a fresh seed.

## Link previews

Each app's `index.html` carries Open Graph and Twitter card tags with its own share image (`public/og.png`,
drawn by `bun scripts/share-cards.ts`). Absolute URLs are filled in at build time by `scripts/vite-share-meta.ts`
from `PUBLIC_ORIGIN` (set in `render.yaml`) or Vercel's own production URL. Check a link with any preview
debugger (e.g. opengraph.xyz) after a deploy.

## Running the image locally

```bash
docker build -t belltax-demo .
docker run --rm -p 127.0.0.1:3900:3000 belltax-demo
```

Portal at http://localhost:3900/, admin at http://localhost:3900/admin/.
