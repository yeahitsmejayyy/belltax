-- 006: pricing becomes packages + add-ons (ticket 36), as designed in
-- .assets/screens/admin/desktop/32-settings-settings-pricing.png and 23-dialogs-and-sheets-dlg-invoice.png.
--
-- A package is the base fee for one return, chosen by filing status. An add-on is extra work on top of
-- it; its price may be NULL, meaning "Included": the work is covered and the client is told so, but it's
-- never a $0 line (R26 keeps invoice lines positive). Prices change freely; issued invoices don't, because
-- their lines are frozen copies (R27). Once used, a package or add-on is retired, never deleted, so the
-- history of what was charged still reads.

CREATE TABLE IF NOT EXISTS price_packages (
  code               TEXT PRIMARY KEY CHECK (length(code) BETWEEN 1 AND 40 AND code NOT GLOB '*[^a-z0-9_]*'),
  filing_status      TEXT NOT NULL CHECK (filing_status IN ('single', 'mfj', 'mfs', 'hoh')),
  name               TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description        TEXT NOT NULL DEFAULT '',
  unit_amount_cents  INTEGER NOT NULL CHECK (unit_amount_cents > 0),
  active             INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  position           INTEGER NOT NULL CHECK (position > 0),
  retired_at         TEXT CHECK (retired_at LIKE '____-__-__T__:__:__%Z'),
  updated_at         TEXT NOT NULL CHECK (updated_at LIKE '____-__-__T__:__:__%Z'),
  CHECK (retired_at IS NULL OR active = 0)
) STRICT;

CREATE TABLE IF NOT EXISTS price_addons (
  code               TEXT PRIMARY KEY CHECK (length(code) BETWEEN 1 AND 40 AND code NOT GLOB '*[^a-z0-9_]*'),
  name               TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description        TEXT NOT NULL DEFAULT '',
  unit_amount_cents  INTEGER CHECK (unit_amount_cents IS NULL OR unit_amount_cents > 0), -- NULL: included
  -- What on a return pre-checks it on a new invoice; NULL means the preparer adds it by hand.
  applies_when       TEXT CHECK (applies_when IS NULL OR applies_when IN
                       ('self_employment', 'rental', 'investments', 'ihss', 'covered_california', 'other_state', 'amended')),
  active             INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  position           INTEGER NOT NULL CHECK (position > 0),
  retired_at         TEXT CHECK (retired_at LIKE '____-__-__T__:__:__%Z'),
  updated_at         TEXT NOT NULL CHECK (updated_at LIKE '____-__-__T__:__:__%Z'),
  CHECK (retired_at IS NULL OR active = 0)
) STRICT;

-- One namespace for codes, so a line's price_code always means one thing.
CREATE TRIGGER IF NOT EXISTS price_packages_code_unique BEFORE INSERT ON price_packages
WHEN EXISTS (SELECT 1 FROM price_addons WHERE code = NEW.code)
BEGIN SELECT RAISE(ABORT, 'that code is already an add-on'); END;
CREATE TRIGGER IF NOT EXISTS price_addons_code_unique BEFORE INSERT ON price_addons
WHEN EXISTS (SELECT 1 FROM price_packages WHERE code = NEW.code)
BEGIN SELECT RAISE(ABORT, 'that code is already a package'); END;

-- Which package or add-on a line came from, for "This year" usage. NULL for lines typed by hand (and for
-- invoices from before this migration).
ALTER TABLE invoice_lines ADD COLUMN price_code TEXT CHECK (price_code IS NULL OR length(price_code) BETWEEN 1 AND 40);

-- Included add-ons on an invoice: named, not charged. Frozen with the invoice like its lines (R27).
CREATE TABLE IF NOT EXISTS invoice_included (
  invoice_id  TEXT NOT NULL REFERENCES invoices (id),
  price_code  TEXT NOT NULL CHECK (length(price_code) BETWEEN 1 AND 40),
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  PRIMARY KEY (invoice_id, price_code)
) STRICT;

CREATE TRIGGER IF NOT EXISTS invoice_included_frozen_insert BEFORE INSERT ON invoice_included
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'what an invoice includes is frozen once it is issued'); END;
CREATE TRIGGER IF NOT EXISTS invoice_included_frozen_delete BEFORE DELETE ON invoice_included
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'what an invoice includes is frozen once it is issued'); END;
CREATE TRIGGER IF NOT EXISTS invoice_included_frozen_update BEFORE UPDATE ON invoice_included
BEGIN SELECT RAISE(ABORT, 'what an invoice includes is frozen once it is issued'); END;

CREATE INDEX IF NOT EXISTS invoice_lines_price ON invoice_lines (price_code) WHERE price_code IS NOT NULL;

-- The practice's starting prices, as in the design. PJ edits them in Settings → Services & pricing.
INSERT INTO price_packages (code, filing_status, name, description, unit_amount_cents, position, updated_at) VALUES
  ('single', 'single', 'Single',                    'One filer · federal and California',                     22500, 1, '2026-09-28T00:00:00.000Z'),
  ('hoh',    'hoh',    'Head of household',         'One filer with dependents · federal and California',     31000, 2, '2026-09-28T00:00:00.000Z'),
  ('mfj',    'mfj',    'Married filing jointly',    'Two filers, one return · federal and California',        34000, 3, '2026-09-28T00:00:00.000Z'),
  ('mfs',    'mfs',    'Married filing separately', 'Priced per return',                                      24500, 4, '2026-09-28T00:00:00.000Z');

INSERT INTO price_addons (code, name, description, unit_amount_cents, applies_when, active, position, updated_at) VALUES
  ('side_work',   'Side work or gig income', 'Schedule C for 1099-NEC or app-based work',   8500,  'self_employment',    1, 1, '2026-09-28T00:00:00.000Z'),
  ('ihss',        'IHSS home care income',   'Paystub review for IHSS caregivers',          NULL,  'ihss',               1, 2, '2026-09-28T00:00:00.000Z'),
  ('covered_ca',  'Covered California',      'Form 1095-A and premium tax credit',          4000,  'covered_california', 1, 3, '2026-09-28T00:00:00.000Z'),
  ('extra_state', 'Each additional state',   'Part-year or nonresident state return',       6000,  'other_state',        1, 4, '2026-09-28T00:00:00.000Z'),
  ('rental',      'Rental property',         'Schedule E, per property',                    12500, 'rental',             1, 5, '2026-09-28T00:00:00.000Z'),
  ('investments', 'Investments',             'Schedule D for sales of stocks or funds',     7500,  'investments',        1, 6, '2026-09-28T00:00:00.000Z'),
  ('amended',     'Amended return',          'Form 1040-X for a prior year',                15000, 'amended',            0, 7, '2026-09-28T00:00:00.000Z');

-- The per-form schedule from 003 is replaced. Its history stays in the events log (settings.fee_updated).
DROP TABLE IF EXISTS fee_schedule;
