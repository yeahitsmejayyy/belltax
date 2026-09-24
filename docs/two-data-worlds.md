# Two data worlds

This project holds real taxpayer data and is also a public portfolio piece. Those two facts fight,
so the line is drawn once and never crossed.

| | Demo world | Live world |
|---|---|---|
| Data | Seeded, invented households | Actual clients |
| Where | Public repo, deployed demo, every interview walkthrough | One local instance, on hardware under PJ's control |
| Rule | Nothing real ever appears here | Never pushed, never deployed, never screen-shared |

## How the code enforces it

- `RUN_MODE=demo|live`, read by the server at boot (`apps/server/src/config.ts`). Default is demo.
- Demo data lives in `data/demo/` (gitignored) and is re-seeded from a deterministic script.
- Live mode refuses to start unless `LIVE_DATA_DIR` is an absolute path **outside the repo**.
- `.gitignore` covers databases, `data/`, `uploads/`, `live-data/` and every `.env*` except `.env.example`.
- The server binds to `127.0.0.1`; the live instance never opens a public port.
- The UI always shows which mode it is in.

## Rules for people and agents

- Every screenshot, demo, test fixture and interview uses seeded data only.
- Nothing about a real client goes into an AI chat, a note, an issue, a commit message, or a log line.
- Live uploads are encrypted at rest (disk encryption on the host at minimum).
- The practice keeps a written information security plan under the FTC Safeguards Rule: see
  [`wisp.md`](wisp.md). Not legal advice; confirm current requirements.
