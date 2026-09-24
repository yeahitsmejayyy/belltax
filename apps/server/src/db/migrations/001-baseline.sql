-- Bell Tax Prep — schema v0.3
--
-- A household is an account. A return (engagement) is a snapshot of who was on it that year.
-- The database refuses what must never be true; the API decides what shouldn't happen yet.
-- Rule numbers (R6, R21 …) refer to the business-rules table in the docs; tests use the same numbers.
--
-- Conventions: TEXT UUIDv7 ids · TEXT ISO-8601 UTC timestamps · INTEGER cents · STRICT tables ·
-- enums mirrored from packages/schema/src/enums.ts · JSON stored as validated TEXT.
--
-- Migration 001, the baseline. Never edit this file once a live database has applied it: the runner
-- checks every applied migration's checksum. Change the schema with a new numbered file instead
-- (docs/migrations.md explains how, including rebuilding a table to change a CHECK).

-- ───────────────────────── People & access ─────────────────────────

CREATE TABLE IF NOT EXISTS households (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  created_at    TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  archived_at   TEXT CHECK (archived_at LIKE '____-__-__T__:__:__%Z')
) STRICT;

-- Identity only. Spouse / dependent are per-return facts in return_people.
CREATE TABLE IF NOT EXISTS people (
  id             TEXT PRIMARY KEY,
  household_id   TEXT REFERENCES households (id),
  first_name     TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
  middle_name    TEXT,
  last_name      TEXT NOT NULL CHECK (length(trim(last_name)) > 0),
  suffix         TEXT,
  date_of_birth  TEXT CHECK (date_of_birth LIKE '____-__-__' AND length(date_of_birth) = 10),
  ssn_last4      TEXT CHECK (ssn_last4 GLOB '[0-9][0-9][0-9][0-9]'),
  email          TEXT,
  phone          TEXT,
  created_at     TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z')
) STRICT;

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  role           TEXT NOT NULL CHECK (role IN ('client', 'preparer')),
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  person_id      TEXT UNIQUE REFERENCES people (id),                       -- R4
  password_hash  TEXT,
  activated_at   TEXT CHECK (activated_at LIKE '____-__-__T__:__:__%Z'),
  created_at     TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  CHECK ((role = 'client') = (person_id IS NOT NULL)),                      -- R5
  UNIQUE (id, person_id)                                                    -- target of R22
) STRICT;

-- Explicit, revocable delegation (adult child, caregiver). Revoking keeps the row.
CREATE TABLE IF NOT EXISTS household_access (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id),
  household_id  TEXT NOT NULL REFERENCES households (id),
  granted_by    TEXT NOT NULL REFERENCES users (id),
  granted_at    TEXT NOT NULL CHECK (granted_at LIKE '____-__-__T__:__:__%Z'),
  revoked_at    TEXT CHECK (revoked_at LIKE '____-__-__T__:__:__%Z'),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS household_access_one_active                -- R3
  ON household_access (user_id, household_id) WHERE revoked_at IS NULL;

-- ───────────────────────── Engagement letters ─────────────────────────
-- Defined before engagements, which point at their letter.

CREATE TABLE IF NOT EXISTS engagement_letters (
  id                TEXT PRIMARY KEY,
  household_id      TEXT NOT NULL REFERENCES households (id),
  tax_year          INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  template_version  INTEGER NOT NULL CHECK (template_version > 0),
  body              TEXT NOT NULL CHECK (length(body) > 0),
  body_sha256       TEXT NOT NULL CHECK (length(body_sha256) = 64 AND body_sha256 NOT GLOB '*[^0-9a-f]*'),
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'void')),
  created_at        TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  sent_at           TEXT CHECK (sent_at LIKE '____-__-__T__:__:__%Z'),
  CHECK (status NOT IN ('sent', 'signed') OR sent_at IS NOT NULL),
  UNIQUE (id, household_id, tax_year),                                      -- target of R20
  UNIQUE (id, body_sha256)                                                  -- target of R21
) STRICT;

-- R24: once sent, the words are frozen.
CREATE TRIGGER IF NOT EXISTS engagement_letters_frozen_text
BEFORE UPDATE OF body, body_sha256, household_id, tax_year, template_version ON engagement_letters
WHEN OLD.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'engagement letter text is frozen once sent');
END;

CREATE TRIGGER IF NOT EXISTS engagement_letters_status_forward
BEFORE UPDATE OF status ON engagement_letters
WHEN (OLD.status <> 'draft' AND NEW.status = 'draft') OR (OLD.status = 'void' AND NEW.status <> 'void')
BEGIN
  SELECT RAISE(ABORT, 'engagement letter status cannot move backward');
END;

CREATE TRIGGER IF NOT EXISTS engagement_letters_no_delete
BEFORE DELETE ON engagement_letters
WHEN OLD.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'only draft engagement letters can be deleted; void it instead');
END;

-- ───────────────────────── Returns ─────────────────────────

CREATE TABLE IF NOT EXISTS engagements (
  id                TEXT PRIMARY KEY,
  household_id      TEXT NOT NULL REFERENCES households (id),
  tax_year          INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),          -- R14
  kind              TEXT NOT NULL DEFAULT 'original' CHECK (kind IN ('original', 'amended')),
  amends_id         TEXT,
  filing_status     TEXT CHECK (filing_status IN ('single', 'mfj', 'mfs', 'hoh', 'qss')),  -- R14
  stage             TEXT NOT NULL DEFAULT 'invited' CHECK (stage IN ('invited', 'intake', 'documents', 'ready', 'preparing', 'review', 'filed', 'complete')),
  stage_changed_at  TEXT NOT NULL CHECK (stage_changed_at LIKE '____-__-__T__:__:__%Z'),  -- cache of the latest stage event
  letter_id         TEXT,
  created_at        TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  CHECK ((kind = 'amended') = (amends_id IS NOT NULL)),                      -- R35
  CHECK (amends_id IS NULL OR amends_id <> id),
  UNIQUE (id, tax_year),                                                    -- target of R11, R16, R35
  UNIQUE (id, tax_year, kind),                                              -- target of R11
  UNIQUE (id, household_id, tax_year),
  FOREIGN KEY (amends_id, tax_year) REFERENCES engagements (id, tax_year),                          -- R35
  FOREIGN KEY (letter_id, household_id, tax_year) REFERENCES engagement_letters (id, household_id, tax_year)  -- R20
) STRICT;

-- R35: an amendment points at an original return, not at another amendment.
CREATE TRIGGER IF NOT EXISTS engagements_amends_original_insert
BEFORE INSERT ON engagements
WHEN NEW.amends_id IS NOT NULL AND (SELECT kind FROM engagements WHERE id = NEW.amends_id) <> 'original'
BEGIN
  SELECT RAISE(ABORT, 'an amended return must point at an original return');
END;

CREATE TRIGGER IF NOT EXISTS engagements_amends_original_update
BEFORE UPDATE OF amends_id ON engagements
WHEN NEW.amends_id IS NOT NULL AND (SELECT kind FROM engagements WHERE id = NEW.amends_id) <> 'original'
BEGIN
  SELECT RAISE(ABORT, 'an amended return must point at an original return');
END;

-- Who was on a return that year, and in what role.
-- tax_year and engagement_kind are copied from the return on purpose: the partial unique indexes
-- below need them, and the composite FK guarantees the copies can't disagree (R11).
CREATE TABLE IF NOT EXISTS return_people (
  engagement_id      TEXT NOT NULL,
  person_id          TEXT NOT NULL REFERENCES people (id),
  tax_year           INTEGER NOT NULL,
  engagement_kind    TEXT NOT NULL CHECK (engagement_kind IN ('original', 'amended')),
  role               TEXT NOT NULL CHECK (role IN ('primary', 'spouse', 'dependent')),
  relationship       TEXT,
  months_lived_with  INTEGER CHECK (months_lived_with BETWEEN 0 AND 12),
  PRIMARY KEY (engagement_id, person_id),                                   -- R9
  FOREIGN KEY (engagement_id, tax_year, engagement_kind) REFERENCES engagements (id, tax_year, kind),  -- R11
  CHECK (role = 'dependent' OR (relationship IS NULL AND months_lived_with IS NULL))
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS return_people_one_primary                 -- R10
  ON return_people (engagement_id) WHERE role = 'primary';
CREATE UNIQUE INDEX IF NOT EXISTS return_people_one_spouse                  -- R10
  ON return_people (engagement_id) WHERE role = 'spouse';
CREATE UNIQUE INDEX IF NOT EXISTS return_people_files_once_per_year          -- R6
  ON return_people (person_id, tax_year) WHERE role IN ('primary', 'spouse') AND engagement_kind = 'original';
CREATE UNIQUE INDEX IF NOT EXISTS return_people_claimed_once_per_year        -- R7 (R8: separate from R6)
  ON return_people (person_id, tax_year) WHERE role = 'dependent' AND engagement_kind = 'original';

CREATE TABLE IF NOT EXISTS intake_responses (
  engagement_id  TEXT PRIMARY KEY REFERENCES engagements (id),
  form_version   INTEGER NOT NULL CHECK (form_version > 0),
  answers        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(answers)),
  updated_at     TEXT NOT NULL CHECK (updated_at LIKE '____-__-__T__:__:__%Z'),
  submitted_at   TEXT CHECK (submitted_at LIKE '____-__-__T__:__:__%Z')
) STRICT;

-- ───────────────────────── Sources ─────────────────────────
-- Things that produce tax documents year after year. Identity only; amounts stay in ProSeries.

CREATE TABLE IF NOT EXISTS sources (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL REFERENCES households (id),
  kind          TEXT NOT NULL CHECK (kind IN ('employer', 'brokerage', 'bank', 'rental_property', 'business', 'ihss_provider', 'retirement', 'other')),
  label         TEXT NOT NULL CHECK (length(trim(label)) > 0),
  first_year    INTEGER CHECK (first_year BETWEEN 2000 AND 2100),
  last_year     INTEGER CHECK (last_year BETWEEN 2000 AND 2100),
  created_at    TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  CHECK (first_year IS NULL OR last_year IS NULL OR last_year >= first_year)
) STRICT;

CREATE TABLE IF NOT EXISTS source_owners (
  source_id  TEXT NOT NULL REFERENCES sources (id),
  person_id  TEXT NOT NULL REFERENCES people (id),
  PRIMARY KEY (source_id, person_id)
) STRICT;

CREATE TABLE IF NOT EXISTS return_sources (
  engagement_id  TEXT NOT NULL REFERENCES engagements (id),
  source_id      TEXT NOT NULL REFERENCES sources (id),
  note           TEXT,
  PRIMARY KEY (engagement_id, source_id)                                    -- target of R37
) STRICT;

-- ───────────────────────── Requests & documents ─────────────────────────

-- R39: forms are rows, not a CHECK list, so adding one needs no schema change.
CREATE TABLE IF NOT EXISTS document_kinds (
  code       TEXT PRIMARY KEY CHECK (length(code) > 0 AND code NOT GLOB '*[^a-z0-9_]*'),
  form_name  TEXT NOT NULL,
  label      TEXT NOT NULL,
  category   TEXT NOT NULL CHECK (category IN ('income', 'deduction', 'credit', 'identity', 'prior_year', 'property', 'business', 'other')),
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
) STRICT;

INSERT OR IGNORE INTO document_kinds (code, form_name, label, category) VALUES
  ('w2',                'Form W-2',        'Wage and tax statement',          'income'),
  ('1099_nec',          'Form 1099-NEC',   'Nonemployee compensation',        'income'),
  ('1099_k',            'Form 1099-K',     'Payment card and app payments',   'income'),
  ('1099_misc',         'Form 1099-MISC',  'Miscellaneous income',            'income'),
  ('1099_int',          'Form 1099-INT',   'Interest income',                 'income'),
  ('1099_div',          'Form 1099-DIV',   'Dividends',                       'income'),
  ('1099_b',            'Form 1099-B',     'Brokerage proceeds',              'income'),
  ('1099_r',            'Form 1099-R',     'Retirement distributions',        'income'),
  ('1099_g',            'Form 1099-G',     'Unemployment and state refunds',  'income'),
  ('ssa_1099',          'Form SSA-1099',   'Social Security benefits',        'income'),
  ('ihss_paystub',      'IHSS paystub',    'IHSS provider paystub',           'income'),
  ('k1',                'Schedule K-1',    'Partner or shareholder share',    'income'),
  ('1098',              'Form 1098',       'Mortgage interest',               'deduction'),
  ('1098_e',            'Form 1098-E',     'Student loan interest',           'deduction'),
  ('1098_t',            'Form 1098-T',     'Tuition statement',               'credit'),
  ('1095_a',            'Form 1095-A',     'Marketplace health coverage',     'credit'),
  ('childcare_receipt', 'Receipt',         'Childcare provider receipt',      'credit'),
  ('property_tax',      'Statement',       'Property tax bill',               'property'),
  ('rent_ledger',       'Ledger',          'Rental income and expenses',      'property'),
  ('expense_summary',   'Summary',         'Business expense summary',        'business'),
  ('prior_return',      'Form 1040',       'Last year''s tax return',         'prior_year'),
  ('photo_id',          'ID',              'Photo ID',                        'identity'),
  ('ssn_card',          'Card',            'Social Security card',            'identity'),
  ('other',             'Other',           'Other document',                  'other');

CREATE TABLE IF NOT EXISTS requests (
  id             TEXT PRIMARY KEY,
  engagement_id  TEXT NOT NULL REFERENCES engagements (id),
  person_id      TEXT REFERENCES people (id),
  source_id      TEXT,
  kind           TEXT NOT NULL CHECK (kind IN ('document', 'question')),
  document_kind  TEXT REFERENCES document_kinds (code),                     -- R39
  title          TEXT NOT NULL CHECK (length(trim(title)) > 0),
  note           TEXT,
  response       TEXT,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'cancelled')),
  created_by     TEXT NOT NULL REFERENCES users (id),
  created_at     TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  responded_at   TEXT CHECK (responded_at LIKE '____-__-__T__:__:__%Z'),
  closed_at      TEXT CHECK (closed_at LIKE '____-__-__T__:__:__%Z'),
  CHECK ((kind = 'document') = (document_kind IS NOT NULL)),                -- R18
  CHECK ((response IS NULL) = (responded_at IS NULL)),
  CHECK ((status = 'open') = (closed_at IS NULL)),
  UNIQUE (id, engagement_id),                                               -- target of R19
  FOREIGN KEY (engagement_id, source_id) REFERENCES return_sources (engagement_id, source_id)  -- R37
) STRICT;

CREATE TABLE IF NOT EXISTS documents (
  id             TEXT PRIMARY KEY,
  person_id      TEXT REFERENCES people (id),
  engagement_id  TEXT REFERENCES engagements (id),
  tax_year       INTEGER CHECK (tax_year BETWEEN 2000 AND 2100),
  request_id     TEXT,
  source_id      TEXT REFERENCES sources (id),
  supersedes_id  TEXT REFERENCES documents (id),
  kind           TEXT NOT NULL REFERENCES document_kinds (code),             -- R39
  label          TEXT,
  status         TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'accepted', 'rejected')),
  reject_reason  TEXT,
  filename       TEXT NOT NULL CHECK (length(filename) > 0),
  mime_type      TEXT NOT NULL CHECK (length(mime_type) > 0),
  size_bytes     INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256         TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  storage_key    TEXT UNIQUE,
  uploaded_by    TEXT NOT NULL REFERENCES users (id),
  created_at     TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  reviewed_at    TEXT CHECK (reviewed_at LIKE '____-__-__T__:__:__%Z'),
  purge_after    TEXT CHECK (purge_after LIKE '____-__-__' AND length(purge_after) = 10),
  purged_at      TEXT CHECK (purged_at LIKE '____-__-__T__:__:__%Z'),
  CHECK (person_id IS NOT NULL OR engagement_id IS NOT NULL),               -- R15
  CHECK (engagement_id IS NULL OR tax_year IS NOT NULL),                    -- R16
  CHECK (request_id IS NULL OR engagement_id IS NOT NULL),                  -- R19
  CHECK (status <> 'rejected' OR reject_reason IS NOT NULL),                -- R17
  CHECK ((status = 'uploaded') = (reviewed_at IS NULL)),
  CHECK ((purged_at IS NULL) = (storage_key IS NOT NULL)),                  -- R34
  CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  FOREIGN KEY (engagement_id, tax_year) REFERENCES engagements (id, tax_year),                -- R16
  FOREIGN KEY (request_id, engagement_id) REFERENCES requests (id, engagement_id),           -- R19
  FOREIGN KEY (engagement_id, source_id) REFERENCES return_sources (engagement_id, source_id)  -- R37
) STRICT;

-- ───────────────────────── Signatures ─────────────────────────

CREATE TABLE IF NOT EXISTS signatures (
  id            TEXT PRIMARY KEY,
  letter_id     TEXT NOT NULL,
  person_id     TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  body_sha256   TEXT NOT NULL,
  typed_name    TEXT NOT NULL CHECK (length(trim(typed_name)) > 0),
  consent_text  TEXT NOT NULL CHECK (length(consent_text) > 0),
  ip            TEXT NOT NULL,
  user_agent    TEXT NOT NULL,
  signed_at     TEXT NOT NULL CHECK (signed_at LIKE '____-__-__T__:__:__%Z'),
  UNIQUE (letter_id, person_id),                                            -- R23
  FOREIGN KEY (letter_id, body_sha256) REFERENCES engagement_letters (id, body_sha256),  -- R21
  FOREIGN KEY (user_id, person_id) REFERENCES users (id, person_id)                      -- R22
) STRICT;

CREATE TRIGGER IF NOT EXISTS signatures_only_on_sent_letters
BEFORE INSERT ON signatures
WHEN (SELECT status FROM engagement_letters WHERE id = NEW.letter_id) NOT IN ('sent', 'signed')
BEGIN
  SELECT RAISE(ABORT, 'only a sent engagement letter can be signed');
END;

CREATE TRIGGER IF NOT EXISTS signatures_no_update
BEFORE UPDATE ON signatures
BEGIN
  SELECT RAISE(ABORT, 'signatures are permanent');
END;

CREATE TRIGGER IF NOT EXISTS signatures_no_delete
BEFORE DELETE ON signatures
BEGIN
  SELECT RAISE(ABORT, 'signatures are permanent');
END;

-- ───────────────────────── Money ─────────────────────────
-- Store facts (lines, payments); derive state (invoice_balances).

CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT PRIMARY KEY,
  engagement_id  TEXT NOT NULL REFERENCES engagements (id),
  number         TEXT NOT NULL UNIQUE CHECK (number GLOB '[0-9][0-9][0-9][0-9]-[0-9]*' AND substr(number, 6) NOT GLOB '*[^0-9]*'),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'void')),
  due_on         TEXT CHECK (due_on LIKE '____-__-__' AND length(due_on) = 10),
  issued_at      TEXT CHECK (issued_at LIKE '____-__-__T__:__:__%Z'),
  created_at     TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  CHECK (status <> 'issued' OR issued_at IS NOT NULL)
) STRICT;

CREATE TRIGGER IF NOT EXISTS invoices_status_forward
BEFORE UPDATE OF status ON invoices
WHEN (OLD.status <> 'draft' AND NEW.status = 'draft') OR (OLD.status = 'void' AND NEW.status <> 'void')
BEGIN
  SELECT RAISE(ABORT, 'invoice status cannot move backward');
END;

CREATE TRIGGER IF NOT EXISTS invoices_issue_needs_lines
BEFORE UPDATE OF status ON invoices
WHEN NEW.status = 'issued' AND NOT EXISTS (SELECT 1 FROM invoice_lines WHERE invoice_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'an invoice needs at least one line before it is issued');
END;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id                 TEXT PRIMARY KEY,
  invoice_id         TEXT NOT NULL REFERENCES invoices (id),
  position           INTEGER NOT NULL CHECK (position > 0),
  description        TEXT NOT NULL CHECK (length(trim(description)) > 0),
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),       -- R26
  unit_amount_cents  INTEGER NOT NULL CHECK (unit_amount_cents > 0),        -- R26
  UNIQUE (invoice_id, position)
) STRICT;

-- R27: an issued invoice's lines are frozen.
CREATE TRIGGER IF NOT EXISTS invoice_lines_frozen_insert
BEFORE INSERT ON invoice_lines
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'invoice lines are frozen once the invoice is issued');
END;

CREATE TRIGGER IF NOT EXISTS invoice_lines_frozen_update
BEFORE UPDATE ON invoice_lines
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft'
  OR (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'invoice lines are frozen once the invoice is issued');
END;

CREATE TRIGGER IF NOT EXISTS invoice_lines_frozen_delete
BEFORE DELETE ON invoice_lines
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'invoice lines are frozen once the invoice is issued');
END;

-- Two ways money arrives: Stripe Checkout (ticket 09) or recorded by hand (cash, check, Zelle).
-- Each path carries only its own fields, and the CHECKs keep them from mixing.
CREATE TABLE IF NOT EXISTS payments (
  id                   TEXT PRIMARY KEY,
  invoice_id           TEXT NOT NULL REFERENCES invoices (id),
  provider             TEXT NOT NULL CHECK (provider IN ('stripe', 'manual')),
  checkout_session_id  TEXT UNIQUE,                                          -- stripe only
  payment_intent_id    TEXT,                                                 -- stripe only
  method               TEXT CHECK (method IN ('cash', 'check', 'zelle', 'other')),  -- manual only
  received_on          TEXT CHECK (received_on LIKE '____-__-__' AND length(received_on) = 10),  -- manual only
  note                 TEXT,
  recorded_by          TEXT REFERENCES users (id),                           -- manual only: who entered it
  amount_cents         INTEGER NOT NULL CHECK (amount_cents > 0),            -- R26
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  failure_message      TEXT,
  created_at           TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  updated_at           TEXT NOT NULL CHECK (updated_at LIKE '____-__-__T__:__:__%Z'),
  CHECK ((provider = 'stripe') = (checkout_session_id IS NOT NULL)),
  CHECK (provider = 'stripe' OR payment_intent_id IS NULL),
  CHECK ((provider = 'manual') = (method IS NOT NULL AND received_on IS NOT NULL AND recorded_by IS NOT NULL)),
  CHECK (provider = 'manual' OR (method IS NULL AND received_on IS NULL AND recorded_by IS NULL)),
  CHECK (provider = 'stripe' OR status = 'succeeded')                        -- money in hand is simply received
) STRICT;

CREATE TRIGGER IF NOT EXISTS payments_only_on_issued_invoices
BEFORE INSERT ON payments
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'issued'
BEGIN
  SELECT RAISE(ABORT, 'payments can only be taken on an issued invoice');
END;

-- R29: a webhook handler inserts here first; a duplicate delivery fails and is ignored.
CREATE TABLE IF NOT EXISTS webhook_receipts (
  provider     TEXT NOT NULL CHECK (provider IN ('stripe')),
  event_id     TEXT NOT NULL,
  received_at  TEXT NOT NULL CHECK (received_at LIKE '____-__-__T__:__:__%Z'),
  PRIMARY KEY (provider, event_id)
) STRICT;

-- ───────────────────────── Audit ─────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,
  occurred_at    TEXT NOT NULL CHECK (occurred_at LIKE '____-__-__T__:__:__%Z'),
  actor_kind     TEXT NOT NULL CHECK (actor_kind IN ('client', 'preparer', 'system', 'stripe')),
  actor_user_id  TEXT REFERENCES users (id),
  household_id   TEXT REFERENCES households (id),
  engagement_id  TEXT REFERENCES engagements (id),
  type           TEXT NOT NULL CHECK (type GLOB '[a-z]*.[a-z]*' AND type NOT GLOB '*[^a-z_.]*'),
  subject_type   TEXT NOT NULL,
  subject_id     TEXT NOT NULL,
  reason         TEXT,
  data           TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
  CHECK ((actor_kind IN ('client', 'preparer')) = (actor_user_id IS NOT NULL))
) STRICT;

-- R31: append-only. A mistake is corrected by a new event, never an edit.
CREATE TRIGGER IF NOT EXISTS events_no_update
BEFORE UPDATE ON events
BEGIN
  SELECT RAISE(ABORT, 'events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS events_no_delete
BEFORE DELETE ON events
BEGIN
  SELECT RAISE(ABORT, 'events are append-only');
END;

-- ───────────────────────── Views ─────────────────────────

-- R28: totals, amounts paid and balances are derived, never stored.
CREATE VIEW IF NOT EXISTS invoice_balances AS
WITH sums AS (
  SELECT
    i.id AS invoice_id,
    i.engagement_id,
    i.status,
    COALESCE((SELECT SUM(l.quantity * l.unit_amount_cents) FROM invoice_lines l WHERE l.invoice_id = i.id), 0) AS total_cents,
    COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'succeeded'), 0) AS paid_cents,
    (SELECT p.status FROM payments p WHERE p.invoice_id = i.id ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS last_payment_status
  FROM invoices i
)
SELECT
  invoice_id,
  engagement_id,
  status,
  total_cents,
  paid_cents,
  total_cents - paid_cents AS balance_cents,
  last_payment_status,
  CASE
    WHEN status = 'void' THEN 'void'
    WHEN status = 'draft' THEN 'draft'
    WHEN paid_cents >= total_cents THEN 'paid'
    WHEN last_payment_status = 'failed' THEN 'failed_last_attempt'
    WHEN paid_cents > 0 THEN 'partial'
    ELSE 'unpaid'
  END AS settlement
FROM sums;

-- R2: every (user, return) pair a client may open. canAccess() is one lookup here.
-- Filer path is permanent (survives divorce or a move); grant path is revocable.
CREATE VIEW IF NOT EXISTS client_access AS
SELECT u.id AS user_id, rp.engagement_id, 'filer' AS via
FROM users u
JOIN return_people rp ON rp.person_id = u.person_id AND rp.role IN ('primary', 'spouse')
UNION
SELECT ha.user_id, e.id AS engagement_id, 'grant' AS via
FROM household_access ha
JOIN engagements e ON e.household_id = ha.household_id
WHERE ha.revoked_at IS NULL;

-- The Pipeline board and table read only this.
CREATE VIEW IF NOT EXISTS pipeline_rows AS
SELECT
  e.id AS engagement_id,
  e.household_id,
  h.display_name AS household_name,
  e.tax_year,
  e.kind,
  e.filing_status,
  e.stage,
  e.stage_changed_at,
  (SELECT group_concat(p.first_name, ' & ')
     FROM return_people rp JOIN people p ON p.id = rp.person_id
    WHERE rp.engagement_id = e.id AND rp.role IN ('primary', 'spouse')) AS filers,
  (SELECT COUNT(*) FROM requests r WHERE r.engagement_id = e.id AND r.status = 'open') AS open_requests,
  COALESCE((SELECT SUM(b.balance_cents) FROM invoice_balances b WHERE b.engagement_id = e.id AND b.status = 'issued'), 0) AS balance_cents
FROM engagements e
JOIN households h ON h.id = e.household_id;

-- Derived "simple / involved" label and pricing inputs. Nobody maintains a tier by hand.
CREATE VIEW IF NOT EXISTS return_complexity AS
SELECT
  e.id AS engagement_id,
  e.filing_status,
  e.kind = 'amended' AS is_amended,
  (SELECT COUNT(*) FROM return_people rp WHERE rp.engagement_id = e.id AND rp.role = 'dependent') AS dependents,
  (SELECT COUNT(*) FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = e.id AND s.kind IN ('employer', 'ihss_provider')) AS wage_sources,
  (SELECT COUNT(*) FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = e.id AND s.kind IN ('brokerage', 'bank', 'retirement')) AS investment_sources,
  (SELECT COUNT(*) FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = e.id AND s.kind = 'rental_property') AS rentals,
  (SELECT COUNT(*) FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = e.id AND s.kind = 'business') AS businesses,
  CASE
    WHEN e.kind = 'amended'
      OR EXISTS (SELECT 1 FROM return_sources rs JOIN sources s ON s.id = rs.source_id
                  WHERE rs.engagement_id = e.id AND s.kind IN ('brokerage', 'rental_property', 'business'))
    THEN 'involved'
    ELSE 'simple'
  END AS label
FROM engagements e;

-- R38: a returning client's checklist. Sources reported last year on an original return by any of
-- this return's filers, still open this year, and not yet attached. The API turns each into requests.
CREATE VIEW IF NOT EXISTS expected_documents AS
SELECT DISTINCT
  e.id AS engagement_id,
  s.id AS source_id,
  s.kind AS source_kind,
  s.label AS source_label
FROM engagements e
JOIN return_people me ON me.engagement_id = e.id AND me.role IN ('primary', 'spouse')
JOIN return_people last ON last.person_id = me.person_id
                       AND last.tax_year = e.tax_year - 1
                       AND last.role IN ('primary', 'spouse')
                       AND last.engagement_kind = 'original'
JOIN return_sources rs ON rs.engagement_id = last.engagement_id
JOIN sources s ON s.id = rs.source_id
WHERE (s.last_year IS NULL OR s.last_year >= e.tax_year)
  AND NOT EXISTS (SELECT 1 FROM return_sources cur WHERE cur.engagement_id = e.id AND cur.source_id = s.id);

-- ───────────────────────── Indexes ─────────────────────────

CREATE INDEX IF NOT EXISTS people_household ON people (household_id);
CREATE INDEX IF NOT EXISTS household_access_household ON household_access (household_id);
CREATE INDEX IF NOT EXISTS engagements_pipeline ON engagements (tax_year, stage);
CREATE INDEX IF NOT EXISTS engagements_household ON engagements (household_id, tax_year);
CREATE INDEX IF NOT EXISTS return_people_person ON return_people (person_id, tax_year);
CREATE INDEX IF NOT EXISTS sources_household ON sources (household_id);
CREATE INDEX IF NOT EXISTS source_owners_person ON source_owners (person_id);
CREATE INDEX IF NOT EXISTS return_sources_source ON return_sources (source_id);
CREATE INDEX IF NOT EXISTS requests_engagement ON requests (engagement_id, status);
CREATE INDEX IF NOT EXISTS documents_engagement ON documents (engagement_id, status);
CREATE INDEX IF NOT EXISTS documents_person ON documents (person_id);
CREATE INDEX IF NOT EXISTS signatures_letter ON signatures (letter_id);
CREATE INDEX IF NOT EXISTS invoices_engagement ON invoices (engagement_id);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice ON invoice_lines (invoice_id);
CREATE INDEX IF NOT EXISTS payments_invoice ON payments (invoice_id, status);
CREATE INDEX IF NOT EXISTS events_engagement ON events (engagement_id, occurred_at);
CREATE INDEX IF NOT EXISTS events_household ON events (household_id, occurred_at);
CREATE INDEX IF NOT EXISTS events_time ON events (occurred_at);
