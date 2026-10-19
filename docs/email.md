# Outgoing email

Ticket 51. The practice emails three things: an **invite** (set up your account), a **reset** ("set up your sign-in
again", from the preparer or from "Lost your passkey?", ticket 05b), and **"your sign-in changed"** after a reset, a
passkey added or removed, or new recovery codes. Bodies carry a first name and the practice's details, never anything about a return.

## Two drivers

| Where | Driver | What happens |
|---|---|---|
| Live mode with `RESEND_API_KEY` + `EMAIL_FROM` | Resend | One REST call per message (`apps/server/src/email/email.ts`, no SDK) |
| Everywhere else: dev, tests, the local demo, the hosted demo | Outbox | Nothing is sent. Messages land in the admin's **Outbox** page and the server console |

The demos never send, whatever keys are set, so a visitor can't make the practice email anyone. Every send (or
failure) is an event naming the recipient and the template, never the body or a link. A failed send never blocks
the action: the preparer still sees the link to copy.

Templates: `apps/server/src/email/templates.ts` (one inline-styled layout, a plain-text twin for each).
When they're sent: `apps/server/src/email/notify.ts`, called by `login.link`, onboarding, `POST /api/auth/recover`,
a used reset link, and the passkey and recovery-code changes in Settings.

## Setting up Resend (before the first live client)

1. **A domain to send from**, e.g. `belltax.com`. Resend → Domains → Add domain, then add the DNS records it shows
   (SPF, DKIM, and a DMARC policy) at your registrar. Wait for "Verified". Without it, mail lands in spam or bounces.
2. Resend → API Keys → Create, with **sending access only**. Copy the `re_…` key.
3. On the live machine, in the settings file outside the repo (see `live-runbook.md`):
   ```bash
   RESEND_API_KEY=re_…
   EMAIL_FROM="Bell Tax <hello@belltax.com>"
   ```
4. Restart. Make an invite link for yourself and check it arrives.

The key never goes in the repo, a commit, the demo, or a chat.
