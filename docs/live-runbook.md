# Live runbook

How to run the live instance: the one holding real client data. Everything here happens on the machine you
chose for it (see the WISP, §IV). Nothing in this file, and no command in it, ever puts client data into the repo.

## One-time setup

1. **Full-disk encryption on.** macOS: System Settings → Privacy & Security → FileVault, then check with
   `fdesetup status` (should say "FileVault is On."). Linux: install with LUKS; `lsblk -o NAME,TYPE,MOUNTPOINT`
   shows a `crypt` device under `/`. The server checks this at every live boot and **refuses to start if it's off**.
2. **Pick two folders outside the repo, on different disks if you can:**
   - data: e.g. `~/BellTaxPrep/live`
   - backups: e.g. an external drive, or a synced folder that only ever sees encrypted files
3. **Create a backup passphrase** of at least 20 characters in your password manager. Losing it means losing every
   backup. It never goes in the repo, a `.env` inside the repo, or a chat.
4. **Keep the settings in a file outside the repo**, e.g. `~/BellTaxPrep/live.env` with `chmod 600`:

   ```bash
   RUN_MODE=live
   LIVE_DATA_DIR=/Users/you/BellTaxPrep/live
   BACKUP_DIR=/Volumes/Backup/BellTaxPrep
   BACKUP_KEEP=30
   PORT=3000               # the portal: the only port the tunnel forwards
   ADMIN_PORT=3001         # the admin: this machine only, never forwarded
   TUNNEL_TARGET_PORT=3000 # where your tunnel points; live:check fails if it's the admin port
   ```

   Load it into the shell before any live command: `set -a; source ~/BellTaxPrep/live.env; set +a`.
   Pass the passphrase for the one command that needs it, straight from the password manager, for example
   `BACKUP_PASSPHRASE="$(op read op://Private/btp-backup/password)" bun run backup`.
5. **Create the database:** `bun run migrate`.
6. **Check the machine:** `bun run live:check`. Every line should be ✔ before real data goes in.

## Start and stop

```bash
bun run start
```

At startup it: checks the machine (disk encryption, permissions, bind address, tunnel target); tightens the data
folder to owner-only; refuses to start if the database is behind the code. It then opens **two listeners, both on
`127.0.0.1`**:

- **Portal** on `PORT` (3000): what clients use, and the only port the tunnel may forward.
- **Admin** on `ADMIN_PORT` (3001): what you use, from this machine only. Preparer features don't exist on the
  portal port at all (404), and a preparer sign-in there counts for nothing, so a stolen preparer credential used from
  the internet gets nowhere.

Stop with `Ctrl+C`. SQLite's write-ahead log makes a stop mid-request safe.

### Your first sign-in (once)

```bash
bun run preparer:invite you@yourpractice.com
```

It creates your login the first time (a reset after that) and prints a one-time link. Open it **on this machine, at
`http://localhost:3001`** (browsers refuse passkeys on `127.0.0.1`), then set up all three (ticket 05b): a passkey, a
password (12+ characters) with an authenticator app, and save the ten recovery codes it shows once. After that, sign
in with the passkey, or the password and the app's code (or a recovery code). Lost your phone? "Lost your passkey?"
emails you a fresh link; Settings › Sign-in adds passkeys and makes new recovery codes. Clients get their links from you: the Invite dialog shows one, and each
household member has **Invite link** / **Sign-in reset link** and **Sign out everywhere**. Send links yourself; each
works once (invites 7 days, resets 24 hours). Sessions end after 30 minutes idle or 12 hours; 10 wrong passwords lock
a login for 15 minutes.

Every request prints one line (time, portal or admin, method, route pattern, status, duration, user id) and is also
appended to `<LIVE_DATA_DIR>/logs/requests.log`, owner-only, rotated at 5 MB with five old files kept. It never holds
a path, query string, header or body. Who opened which return or file lives in the activity feed, not here.

## Back up (daily in season, weekly otherwise)

```bash
BACKUP_PASSPHRASE="…" bun run backup
```

Writes `belltaxprep-<UTC timestamp>.btpbak` to `BACKUP_DIR`: a consistent snapshot of the database (`VACUUM INTO`,
safe while the server is running), every upload and a manifest, encrypted with AES-256-GCM. Afterward it keeps
the newest `BACKUP_KEEP` backups and deletes older ones. `bun run live:check` warns when the newest backup is
more than a day old.

**Always back up right before `bun run migrate`.**

To schedule it on macOS, use a LaunchAgent that runs a script which loads `live.env` and reads the passphrase
from the keychain (`security find-generic-password -w -s btp-backup`). Don't put the passphrase in the plist.

## Check a backup without restoring it

```bash
BACKUP_PASSPHRASE="…" bun run backup:verify /Volumes/Backup/BellTaxPrep/belltaxprep-20270115T090000Z.btpbak
```

Decrypts it into a private temp folder, checks the database and uploads against the manifest, then deletes the temp
copy. A wrong passphrase or any damaged byte fails loudly.

## Restore

A restore never touches the live folder. It only writes into a new, empty folder, and you switch over yourself:

```bash
BACKUP_PASSPHRASE="…" bun run restore /path/to/belltaxprep-….btpbak ~/BellTaxPrep/restored-2027-01-20
```

Then:
1. Try it on another port: `RUN_MODE=live LIVE_DATA_DIR=~/BellTaxPrep/restored-2027-01-20 PORT=3100 bun run start`,
   open `http://127.0.0.1:3100/health` and spot-check a few returns.
2. Stop the live server, rename the old data folder aside (keep it until you're sure), point `LIVE_DATA_DIR` at the
   restored one, and start again.
3. Record what happened and why in a dated note (WISP, Attachment C step 8).

## The restore drill (do it once before January, then yearly)

Practise on the demo world, never on client data:

```bash
bun run seed
BACKUP_DIR=$(mktemp -d) BACKUP_PASSPHRASE="a drill passphrase at least 20 long" bun run backup
# note the file it prints, then:
BACKUP_PASSPHRASE="a drill passphrase at least 20 long" bun run backup:verify <file>
BACKUP_PASSPHRASE="a drill passphrase at least 20 long" bun run restore <file> "$(mktemp -d)/restored"
RUN_MODE=live LIVE_DATA_DIR=<restored folder> bun run live:check
RUN_MODE=live LIVE_DATA_DIR=<restored folder> PORT=3100 bun run start
```

You should see 25 households at `http://127.0.0.1:3100/health`. Then repeat once against the real live data, restoring into
a scratch folder you delete afterward. Write the date of both drills in the WISP (§VI).

## Rotate

- **Backups:** automatic, keeping the newest `BACKUP_KEEP` (default 30). Before each season, copy one backup to a
  second place (a drive kept elsewhere).
- **Backup passphrase:** yearly, or at once if you think it leaked. Old backups keep needing the old passphrase,
  so keep it in the password manager until those backups have rotated out.
- **Uploads past retention:** portal documents are purged two years after last use (WISP, Attachment A).
  Every January, after a backup:

  ```bash
  bun run purge            # lists what would go: nothing is deleted
  bun run purge --confirm  # deletes those files; each row stays as a dated tombstone with a system event
  ```

  "Last use" means the return has been complete for 730 days (`RETENTION_DAYS` to change it), or the document's
  own `purge_after` date has passed. Documents on any return that isn't complete are never aged out. A photo ID
  stays until every return its person is on is complete and two years old. The purge also removes any stray file
  a previous run left behind.

## Open the new season (before January)

`season.preview({ fromYear })` lists every return from last year and whether it will roll: each completed original
return becomes next year's return with the same people, the sources still open, and its day-one checklist of
document requests. Skipped, with the reason: archived households, returns not yet complete, amended returns, filers
now in another household, and anyone already on a next-year return. Dependents who've left are dropped and named.
`season.rollover({ fromYear, householdIds? })` does it, one household per transaction, and reports created, skipped
and failed. Running it again creates nothing new. Back up first.

## Export client records (the offline copy)

A complete copy of each household that needs no app to read: `record.json` (people with SSN last-4 only, logins
without credentials, every return by year with its answers, requests, documents and invoices, letters with their
signatures, and the audit trail), the uploaded files under their original names, and a `README.txt`.

```bash
EXPORT_DIR=/Volumes/Exports bun run export --all --encrypt
```

- `--encrypt` seals each household into one `.btpexport` file with `BACKUP_PASSPHRASE`. Without it you get plain
  folders; only do that onto an encrypted disk.
- One household: `bun run export <householdId>`. The admin can do the same (`household.export`).
- Open a sealed one: `bun run export:open <file> <empty-folder>`.
- Each export is recorded in the activity feed as `household.exported`.

Do it at the end of each season, and keep the copies with the backups.

## If something's wrong

- **"the live database is behind the code":** back up, then `bun run migrate`.
- **"was edited after it was applied":** someone changed an old migration file. Don't start the server; restore
  that file from git and add a new migration instead.
- **"full-disk encryption: OFF":** turn it on and wait for encryption to finish. Don't override this.
- **Anything that looks like a breach:** WISP Attachment C. The IRS Stakeholder Liaison comes first.
