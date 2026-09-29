-- 007: the practice's own details (ticket 37, .assets/screens/admin/desktop/31-settings-settings-practice.png),
-- stored once and used wherever they appear: letters, invoices and receipts, the invite email, the portal
-- footer, the marketing site. One row; every save is an event with what changed, which is the audit trail.
-- None of this is client data.

CREATE TABLE IF NOT EXISTS practice_settings (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  practice_name        TEXT NOT NULL CHECK (length(trim(practice_name)) BETWEEN 1 AND 80),
  preparer_name        TEXT NOT NULL CHECK (length(trim(preparer_name)) BETWEEN 1 AND 80),
  preparer_credential  TEXT CHECK (preparer_credential IS NULL OR length(trim(preparer_credential)) BETWEEN 1 AND 80), -- "EA", "CTEC A123456"
  reply_to_email       TEXT NOT NULL CHECK (reply_to_email LIKE '%_@_%._%'),
  phone                TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 10 AND 20), -- for client texts
  city                 TEXT CHECK (city IS NULL OR length(trim(city)) BETWEEN 1 AND 60),
  state                TEXT CHECK (state IS NULL OR (length(state) = 2 AND state NOT GLOB '*[^A-Z]*')),
  updated_at           TEXT NOT NULL CHECK (updated_at LIKE '____-__-__T__:__:__%Z')
) STRICT;

-- Starting values from the design. On a live install, PJ replaces them in Settings → Practice before the
-- first invite goes out (live:check says so while the email is still an .example address).
INSERT INTO practice_settings (id, practice_name, preparer_name, preparer_credential, reply_to_email, phone, city, state, updated_at)
VALUES (1, 'BellTaxPrep', 'Patrick J. Bell', NULL, 'pj@belltaxprep.example', '(555) 010-0142', 'Los Angeles', 'CA', '2026-09-28T00:00:00.000Z');
