-- 003: practice settings move from code into the database (ticket 28).
-- The engagement letter template is versioned: publishing adds a version, and past versions are frozen,
-- so every letter can always be traced to the exact wording it was rendered from.
-- The fee schedule is editable; invoices copy amounts into their own lines, so issued invoices never change.

CREATE TABLE IF NOT EXISTS letter_templates (
  version     INTEGER PRIMARY KEY CHECK (version > 0),
  body        TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at  TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  created_by  TEXT REFERENCES users (id)                                    -- NULL for the shipped default
) STRICT;

CREATE TRIGGER IF NOT EXISTS letter_templates_frozen_update
BEFORE UPDATE ON letter_templates
BEGIN
  SELECT RAISE(ABORT, 'a published letter template never changes; publish a new version');
END;

CREATE TRIGGER IF NOT EXISTS letter_templates_frozen_delete
BEFORE DELETE ON letter_templates
BEGIN
  SELECT RAISE(ABORT, 'a published letter template never changes; publish a new version');
END;

INSERT INTO letter_templates (version, body, created_at, created_by) VALUES (1, 'Engagement letter — tax year {{tax_year}}{{amended_note}}

Prepared {{date}} for the {{household_name}} household
Filing: {{returns}}

1. What we''ll do
{{practice_name}} will prepare the federal and California individual income tax returns listed above for tax year {{tax_year}}, using the documents and answers you provide through the client portal. We don''t audit or verify the information you give us, though we may ask questions when something looks incomplete.

2. What you''ll do
You''re responsible for giving us complete and accurate information, keeping the records that support your return, and reviewing the finished return before it''s filed. The tax return is yours: you''re responsible for what it says, even though we prepare it.

3. Filing
We''ll file electronically once you''ve reviewed the return and signed the separate IRS and California e-file authorizations. Those are signed through our tax software, not this portal.

4. Fees
Our fees for this work are shown on your invoice in the portal. Fees are due before the return is filed unless we agree otherwise in writing.

5. Your information
We keep your information confidential and protect it under our written information security plan. We only share it with taxing authorities as needed to file your return, or as the law requires.

6. Ending this engagement
Either of us can end this engagement in writing at any time. You''ll pay for work completed up to that point.

Signed by each person filing: {{filers}}', '2026-09-24T00:00:00.000Z', NULL);

CREATE TABLE IF NOT EXISTS fee_schedule (
  code               TEXT PRIMARY KEY CHECK (length(code) > 0 AND code NOT GLOB '*[^a-z0-9_]*'),
  description        TEXT NOT NULL CHECK (length(trim(description)) > 0),
  unit_amount_cents  INTEGER NOT NULL CHECK (unit_amount_cents > 0),
  active             INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  position           INTEGER NOT NULL CHECK (position > 0),
  updated_at         TEXT NOT NULL CHECK (updated_at LIKE '____-__-__T__:__:__%Z')
) STRICT;

INSERT INTO fee_schedule (code, description, unit_amount_cents, position, updated_at) VALUES
  ('federal',    'Federal return (Form 1040)',     25000, 1, '2026-09-24T00:00:00.000Z'),
  ('state',      'California return (Form 540)',   10000, 2, '2026-09-24T00:00:00.000Z'),
  ('schedule_c', 'Schedule C · self-employment',   15000, 3, '2026-09-24T00:00:00.000Z'),
  ('schedule_e', 'Schedule E · rental property',   12500, 4, '2026-09-24T00:00:00.000Z'),
  ('schedule_d', 'Schedule D · investments',        7500, 5, '2026-09-24T00:00:00.000Z'),
  ('amended',    'Amended return (Form 1040-X)',   20000, 6, '2026-09-24T00:00:00.000Z');
