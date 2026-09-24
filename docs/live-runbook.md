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
   PORT=3000
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

At startup it: checks the machine (disk encryption, permissions, bind address); tightens the data folder to
owner-only; refuses to start if the database is behind the code; listens on `127.0.0.1` only. Clients reach the
portal through the tunnel, never through an open port.

Stop with `Ctrl+C`. SQLite's write-ahead log makes a stop mid-request safe.

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
- **Uploads past retention:** portal documents are purged two years after last use (WISP, Attachment A). The
  purge job ships with the admin tooling; until then it's a manual review each January.

## If something's wrong

- **"the live database is behind the code":** back up, then `bun run migrate`.
- **"was edited after it was applied":** someone changed an old migration file. Don't start the server; restore
  that file from git and add a new migration instead.
- **"full-disk encryption: OFF":** turn it on and wait for encryption to finish. Don't override this.
- **Anything that looks like a breach:** WISP Attachment C. The IRS Stakeholder Liaison comes first.
