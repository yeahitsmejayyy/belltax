# Written Information Security Plan (WISP)

> **This public copy is the template.** Once the `[brackets]` are filled in with real devices, locations, insurer,
> counsel and contacts, that copy lives offline with the practice's records, never in this repository.

**Bell Tax** · draft v0.1 · 2026-09-24 · next review: before the first live client (January 2027), then at least annually

> **Draft, not legal advice.** This plan is written to the FTC Safeguards Rule (16 CFR Part 314) and follows the
> structure of IRS Publication 5708, with the practices in IRS Publication 4557. Have it reviewed by a qualified
> professional before relying on it, and re-check the rules at each annual review. Everything in `[brackets]` is
> for the owner to complete. No client information appears in this document or anywhere in this repository.

**Status tags used below:** ✅ in place · 🔧 planned (board ticket) · ✍️ owner action

---

## I. Objective, purpose and scope

**Objective.** Protect the security, confidentiality and integrity of client information; protect against
anticipated threats to it; and protect against unauthorized access that could cause a client harm or
inconvenience ([16 CFR 314.3(b)](https://www.law.cornell.edu/cfr/text/16/314.3)).

**Why this is required.** Paid tax return preparers are financial institutions under the Gramm-Leach-Bliley Act
and must keep a written information security plan under the FTC Safeguards Rule
([Pub 5708](https://www.irs.gov/pub/irs-pdf/p5708.pdf), [Pub 4557](https://www.irs.gov/pub/irs-pdf/p4557.pdf)).
PTIN renewal asks the preparer to attest to it on
[Form W-12, line 11](https://www.irs.gov/pub/irs-pdf/fw12.pdf).

**Scope.** All client information the practice collects, stores, processes or transmits, in any form:

| System | What it holds | Where |
|---|---|---|
| Intuit ProSeries | Full returns, SSNs, bank details, e-file records (the system of record) | Intuit, via the preparer's account |
| Client portal and preparer admin (this repository's software, **live instance**) | Contact details, household members, **last 4 digits of SSN only**, intake answers, uploaded documents (W-2s, 1099s, IDs), engagement letters and signatures, invoices, payment records, audit log | One local instance on hardware the owner controls ✍️ `[laptop / home lab]` |
| Portal backups | Copies of the live database and uploads | ✅ `bun run backup` (AES-256-GCM, versioned) · ✍️ at `[location]` |
| Email and phone | Whatever clients send outside the portal | `[provider]` |
| Paper | Documents clients hand over in person | `[office / home]` |

**Out of scope, by design.** The public code repository, the deployed demo, Storybook and every walkthrough contain
**only invented demo data**. Real client data never enters them (the "two data worlds" rule,
[`docs/two-data-worlds.md`](two-data-worlds.md)). The portal never stores a full SSN or a bank account number.

---

## II. Qualified individual and authorized users ([16 CFR 314.4(a)](https://www.law.cornell.edu/cfr/text/16/314.4))

**Qualified Individual (Data Security Coordinator):** ✍️ `[Owner name]`, owner of Bell Tax. Responsible for
implementing, overseeing and enforcing this plan, and for the annual review in Section VI.

**Authorized users and access levels** ([Pub 5708 Attachment F](https://www.irs.gov/pub/irs-pdf/p5708.pdf)):

| Person | Role | Access |
|---|---|---|
| ✍️ `[Owner name]` | Preparer, Qualified Individual | Everything: ProSeries, portal admin, backups |
| Clients | Portal users | Only returns they file, plus households they've been explicitly granted (see §V.4) |

There are no employees today. Before anyone else gets access: add them here, train them (§V.9), and have them sign
the acknowledgment in Attachment D.

---

## III. Risk assessment ([16 CFR 314.4(b)](https://www.law.cornell.edu/cfr/text/16/314.4))

**Information handled.** Names, contact details, dates of birth, SSN fragments, income documents, household
relationships, signatures, IP addresses and payment records in the portal; full return data in ProSeries.

**Foreseeable risks, and how each is controlled:**

| Risk | Likelihood | Controls |
|---|---|---|
| Phishing / credential theft of the preparer's accounts (ProSeries, email, e-Services) | High in season | MFA everywhere (§V.5); phishing rules (Attachment B); EFIN/PTIN monitoring (§V.10) |
| Stolen or lost laptop | Medium | Full-disk encryption; screen lock; backups (§V.3, §V.8) |
| A client seeing another household's data | Medium (software bug) | Server-side access checks for every request; denials look like "not found"; automated tests that fail if a client can reach another household ✅ |
| Real data leaking into the public repo or demo | Medium | Two data worlds; live data directory refused inside the repo; gitignore of all data and secrets ✅ |
| Forged or disputed engagement letter signature | Low | Signature bound to a SHA-256 of the exact text signed; signed letters can't change; IP and browser recorded ✅ |
| Tampering with history | Low | Append-only audit log the database refuses to edit or delete ✅ |
| Malicious file upload | Medium | File type checked from the bytes (PDF/JPEG/PNG/WebP/HEIC only), 15 MB limit, stored outside the web root, downloaded with `nosniff` ✅ |
| Ransomware / disk failure | Medium | Encrypted, versioned backups ✅; daily schedule and a restore drill ✍️ (docs/live-runbook.md) |
| Vendor breach (Intuit, Stripe, email, tunnel) | Low–medium | Vendor oversight (§V.7); least data shared |
| Portal exposed to the internet | High once live | Admin never public; portal only through an outbound tunnel with HTTPS 🔧; sign-in, sessions and lockout 🔧 ticket 05 |

**Small-practice note.** Institutions holding information on fewer than 5,000 consumers are exempt from the
*written* risk assessment, penetration testing, the written incident response plan and the annual report
([16 CFR 314.6](https://www.law.cornell.edu/cfr/text/16/314.6)). Bell Tax keeps all four anyway: they're cheap
at this size and they're what a client or regulator will ask to see.

**Testing and monitoring** ([314.4(d)](https://www.law.cornell.edu/cfr/text/16/314.4)): automated security tests run
on every change ✅; a vulnerability check of the live machine and its dependencies ✍️ every six months; an
outside penetration test ✍️ `[decide at first annual review]`.

---

## IV. Hardware and systems inventory ([Pub 5708 Attachment E](https://www.irs.gov/pub/irs-pdf/p5708.pdf))

✍️ Complete before going live, and keep current.

| Item | Location | Client information on it | Encryption | Owner |
|---|---|---|---|---|
| `[Laptop model]` | `[home office]` | ProSeries session, live portal instance | `[FileVault on]` | Owner |
| `[Home lab / server, if used]` | `[location]` | Live portal instance | `[LUKS / FileVault]` | Owner |
| `[Backup drive / cloud bucket]` | `[location]` | Encrypted backups | `[yes]` | Owner |
| `[Phone]` | Owner | Email, MFA codes | Device encryption on | Owner |
| `[Router]` | `[home]` | None stored; carries traffic | WPA3 / WPA2-AES | Owner |

---

## V. Safeguards in place

### 1. Data collection and retention
- Collect only what preparing the return needs. The portal stores **last 4 of SSN only**, never bank account numbers;
  full values stay in ProSeries and on the uploaded documents ✅.
- **Retention.** The preparer keeps a copy or list of returns prepared for at least 3 years
  ([26 U.S.C. 6107(b)](https://www.law.cornell.edu/uscode/text/26/6107)); that record lives in ProSeries. Portal
  uploads are disposed of **no later than two years after last used**, unless still needed for the business or
  required by law ([314.4(c)(6)](https://www.law.cornell.edu/cfr/text/16/314.4)). Default: 730 days after the return
  is complete ✅ (`bun run purge`, run each January after a backup ✍️). An individual document can be given an earlier
  `purge_after` date.
- **Disposal.** Portal files are deleted and the record kept as a tombstone, so the audit trail stays intact ✅. Paper
  is cross-cut shredded. Retired drives are wiped or destroyed (Attachment A).

### 2. Data disclosure
- Client information is disclosed only as needed to prepare and file the return, or as the law requires.
  ✍️ Confirm consent requirements for any other use or disclosure under
  [IRC §7216](https://www.law.cornell.edu/uscode/text/26/7216) before, for example, marketing to past clients.
- Client information **never goes into an AI chat, a notes app, an issue tracker, a commit message or a log line**
  (project rule).

### 3. Encryption ([314.4(c)(3)](https://www.law.cornell.edu/cfr/text/16/314.4))
- **At rest:** full-disk encryption on every device in §IV ✍️. The live server refuses to start if FileVault/LUKS is off ✅. Backups are encrypted with AES-256-GCM under a passphrase kept in the password manager ✅.
- **In transit:** the portal is reachable only over HTTPS through the tunnel 🔧; the live server listens on
  `127.0.0.1` only ✅.

### 4. User access ([314.4(c)(1)](https://www.law.cornell.edu/cfr/text/16/314.4))
- Clients see only returns they file, plus households the preparer has explicitly granted, for example an adult child
  helping a parent. Grants are revocable and their history is kept ✅.
- The preparer admin is never exposed to the internet 🔧 (separate app; admin traffic accepted locally only).
- Sign-in: invite link, then a password (argon2id); 30-minute idle and 12-hour maximum sessions; lockout after
  10 failures for 15 minutes; only hashes of link and session tokens are stored ✅ (ticket 05). MFA for everyone 🔧 ticket 05b.

### 5. Multi-factor authentication ([314.4(c)(5)](https://www.law.cornell.edu/cfr/text/16/314.4))
The rule requires MFA for **any individual accessing any information system**, unless the Qualified Individual
approves equivalent or stronger controls in writing.
- ✍️ Turn on MFA for: Intuit/ProSeries, IRS e-Services, email, Stripe (when used), GitHub, the tunnel provider, and
  the password manager.
- 🔧 Portal: MFA for the preparer is required before go-live. For clients, decide between MFA (passkeys) and a
  written equivalent-controls approval, and record the decision here: ✍️ `[decision, date]`.

### 6. Network protection and remote access
- Router firmware current, default admin password changed, WPA3 (or WPA2-AES) Wi-Fi, guest network for visitors and
  smart devices ✍️.
- Never work on client data over public Wi-Fi without a VPN ✍️.
- Firewall on; no inbound ports opened. The portal is reached through an outbound-only tunnel 🔧.
- The IRS "Security Six": anti-virus, firewall, two-factor authentication, backups, drive encryption, VPN
  ([IRS](https://www.irs.gov/newsroom/tax-security-2-0-a-taxes-security-together-checklist-step-1)).

### 7. Service providers ([314.4(f)](https://www.law.cornell.edu/cfr/text/16/314.4))
Choose providers able to protect client information, require it contractually, and review them each year.

| Provider | What they see | Oversight ✍️ |
|---|---|---|
| Intuit (ProSeries) | Full return data | Review their security terms; MFA on the account |
| Stripe (🔧 ticket 09) | Name, email, amount, card data (held by Stripe, never by us) | Review their security documentation; test mode until go-live |
| Tunnel: Cloudflare or Tailscale (🔧 decision pending) | Encrypted traffic metadata | Review terms; lock the tunnel to the portal only |
| Email: your mailbox `[name]` | Anything clients email | MFA; ask clients to use the portal instead |
| Resend (practice's outgoing mail) | Recipient address, first name, sign-in links | Sending-only API key; verified domain with SPF, DKIM, DMARC; MFA on the account |
| Backup storage `[name]` | Encrypted blobs only | Encryption key never stored with the backup |
| GitHub, demo hosting | **Code and invented demo data only** | No real data, ever |

### 8. Secure development and change management ([314.4(c)(4), (c)(7)](https://www.law.cornell.edu/cfr/text/16/314.4))
- The portal enforces its business rules in the database (checks, keys, triggers) and has automated tests for each,
  including authorization tests written before the features ✅.
- Every change is tracked on the board, reviewed, and committed by the owner ✅. Schema changes to live data go
  through the migration runner, which refuses to start live if the schema is behind or an applied migration was edited ✅.
- Dependencies are updated deliberately and reviewed ✍️ quarterly.

### 9. Monitoring, logging and training ([314.4(c)(8), (e)](https://www.law.cornell.edu/cfr/text/16/314.4))
- Every change to client data is recorded in an append-only audit log: who, what, when, why ✅.
- Reads are recorded too: a document downloaded, a return opened by the preparer (once an hour), a letter read by
  a client. The admin activity feed can show them, hide them, or show only them ✅.
- Every request leaves one log line (time, portal or admin, method, route pattern, status, duration, user id),
  never a path, query string, header or body. Live keeps it in `<data>/logs/requests.log`, owner-only, rotated ✅.
- Weekly during filing season: check the EFIN activity report in e-Services for returns you didn't file ✍️.
- Annual security training for the owner, and for anyone added later, with a signed acknowledgment
  (Attachment D) ✍️. IRS resources: [Pub 4557](https://www.irs.gov/pub/irs-pdf/p4557.pdf), Security Summit alerts.

### 10. Reportable incidents
Anything suggesting client information was accessed, used or lost without authorization: an unexplained e-file
rejection for a duplicate return, EFIN activity you don't recognize, a lost device, a phishing click, an odd
portal log. Handle it with the Incident Response Plan (Attachment C).

---

## VI. Implementation and review

- Effective when signed below; binding on everyone with access to client information.
- Reviewed **at least annually** and whenever something material changes: a new system or vendor, a new
  employee, an incident, or going live ([314.4(g)](https://www.law.cornell.edu/cfr/text/16/314.4)).
- **Annual report** by the Qualified Individual ([314.4(i)](https://www.law.cornell.edu/cfr/text/16/314.4)): program
  status, risk decisions, vendor review, test results, incidents, recommended changes. For a sole practitioner,
  a dated note appended to this file.

**Before the first live client (January 2027):** ✍️ complete every `[bracket]`; 🔧 ship ticket 05 (auth) and the
tunnel; ✍️ enable MFA everywhere; ✍️ schedule daily backups and run the restore drill in `docs/live-runbook.md`.

Signed: ✍️ `[Owner name]`, Qualified Individual · Date: `[date]`

---

## Attachment A — Record retention and disposal
- Returns (copy or list): at least 3 years, in ProSeries ([26 U.S.C. 6107(b)](https://www.law.cornell.edu/uscode/text/26/6107)).
- Portal uploads: no longer than 2 years after last use unless needed or legally required. `bun run purge --confirm`
  deletes the file and keeps a dated tombstone and a system event, so the audit trail stays whole.
- Paper: cross-cut shred. Drives: wipe (encrypted-disk erase) or physically destroy at end of life.

## Attachment B — Rules of behavior ([Pub 5708](https://www.irs.gov/pub/irs-pdf/p5708.pdf); NISTIR 7621 §4)
- Don't open unexpected attachments or links. Verify "new client" emails by phone before replying.
- Business and personal devices and accounts stay separate.
- No unknown USB drives. Software only from trusted sources.
- Passwords: 12+ characters, unique per account, in a password manager; MFA everywhere.
- Never give out credentials. The IRS, Intuit and Stripe will not ask for them.
- Lock the screen when stepping away. No client data on public computers.

## Attachment C — Incident Response Plan ([314.4(h)](https://www.law.cornell.edu/cfr/text/16/314.4), [Pub 5708](https://www.irs.gov/pub/irs-pdf/p5708.pdf))

**Goal:** contain the damage, protect clients from identity theft, meet every notification deadline, learn.

1. **Contain.** Disconnect the affected device from the network (don't wipe it; evidence matters). Revoke portal
   sessions and invites; rotate passwords and MFA on affected accounts.
2. **Assess.** What information, whose, how many people, since when. Check the portal audit log and EFIN activity.
3. **Notify the IRS immediately** through your local
   [IRS Stakeholder Liaison](https://www.irs.gov/businesses/small-businesses-self-employed/stakeholder-liaison-contacts),
   who alerts IRS Criminal Investigation. Fast reporting lets the IRS block fraudulent returns
   ([IRS](https://www.irs.gov/newsroom/heres-who-tax-pros-should-contact-if-their-business-suffers-a-data-theft-or-loss)).
4. **Notify the states:** email **StateAlert@taxadmin.org** for how to report to each state where you prepare returns.
5. **FTC:** if unencrypted information of **500 or more consumers** is involved, notify the FTC as soon as possible and
   **no later than 30 days** after discovery, using the FTC's online form
   ([314.4(j)](https://www.law.cornell.edu/cfr/text/16/314.4)).
6. **California residents:** notify affected people in the most expedient time possible, and (for breaches
   discovered from 2026) within **30 calendar days**. If more than 500 California residents are notified, submit a
   sample notice to the California Attorney General
   ([Civ. Code §1798.82](https://oag.ca.gov/privacy/databreach/reporting)). ✍️ Confirm current requirements with counsel.
7. **Also:** local police report; FBI [IC3](https://www.ic3.gov) for cybercrime; Intuit/ProSeries support;
   liability insurer `[name, policy #]`; legal counsel `[name]`.
8. **Document** every step in the portal audit log or a dated incident note. Afterward, review what failed and
   update this plan (§VI).

**Contacts** ✍️: Stakeholder Liaison `[name/phone]` · Insurer `[phone]` · Counsel `[phone]` · Intuit support `[phone]`.

## Attachment D — Acknowledgment of understanding
I, `[name]`, have read this Written Information Security Plan, completed the training, and will follow it.
Signed `[name]` · Date `[date]` · Title `[title]`

---

### Sources (checked 2026-09-24)
- FTC Safeguards Rule, [16 CFR 314.4](https://www.law.cornell.edu/cfr/text/16/314.4) (amended 88 FR 77508, Nov. 13, 2023) and [314.6](https://www.law.cornell.edu/cfr/text/16/314.6)
- IRS [Publication 5708](https://www.irs.gov/pub/irs-pdf/p5708.pdf) (Rev. 8-2024), *Creating a Written Information Security Plan for your Tax & Accounting Practice*
- IRS [Publication 4557](https://www.irs.gov/pub/irs-pdf/p4557.pdf) (Rev. 6-2024), *Safeguarding Taxpayer Data*
- IRS [Form W-12](https://www.irs.gov/pub/irs-pdf/fw12.pdf) (Rev. October 2025), line 11
- IRS, [Who to contact after a data theft](https://www.irs.gov/newsroom/heres-who-tax-pros-should-contact-if-their-business-suffers-a-data-theft-or-loss); [Security Six](https://www.irs.gov/newsroom/tax-security-2-0-a-taxes-security-together-checklist-step-1)
- [26 U.S.C. 6107](https://www.law.cornell.edu/uscode/text/26/6107); [26 U.S.C. 7216](https://www.law.cornell.edu/uscode/text/26/7216)
- California Attorney General, [Data Security Breach Reporting](https://oag.ca.gov/privacy/databreach/reporting)
