-- 012: a mailbox, not a vault (ticket 49). The portal holds a household's files only until the return is filed and the
-- household has been copied to the offline record (bun run export, bun run season:close). Then it forgets: uploads are
-- purged 30 days after filing, a photo ID as soon as it's verified, and a signed letter's text moves to the record,
-- the portal keeping its fingerprint and dates. Rows stay as tombstones and every step is an event (live/purge.ts).

-- Every offline copy that was made: the proof a purge looks for. Never edited, never deleted.
CREATE TABLE IF NOT EXISTS household_exports (
  id              TEXT PRIMARY KEY,
  household_id    TEXT NOT NULL REFERENCES households (id),
  exported_at     TEXT NOT NULL CHECK (exported_at LIKE '____-__-__T__:__:__%Z'),   -- the snapshot's moment
  file_name       TEXT NOT NULL CHECK (length(file_name) > 0),                       -- the name, never the path
  sha256          TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),  -- sealed file, or record.json
  encrypted       INTEGER NOT NULL CHECK (encrypted IN (0, 1)),
  documents       INTEGER NOT NULL CHECK (documents >= 0)                            -- files it holds
) STRICT;

CREATE INDEX IF NOT EXISTS household_exports_household ON household_exports (household_id, exported_at);

CREATE TRIGGER IF NOT EXISTS household_exports_no_update BEFORE UPDATE ON household_exports
BEGIN SELECT RAISE(ABORT, 'an export record is permanent'); END;
CREATE TRIGGER IF NOT EXISTS household_exports_no_delete BEFORE DELETE ON household_exports
BEGIN SELECT RAISE(ABORT, 'an export record is permanent'); END;

-- A signed letter whose text has moved to the offline record. The body becomes a short note; body_sha256 stays, so
-- every signature still names exactly which words were signed (R21).
ALTER TABLE engagement_letters ADD COLUMN archived_at TEXT CHECK (archived_at LIKE '____-__-__T__:__:__%Z');

-- R24 still holds, with one way through: archiving a signed letter replaces its body, once, and nothing else.
DROP TRIGGER IF EXISTS engagement_letters_frozen_text;
CREATE TRIGGER engagement_letters_frozen_text
BEFORE UPDATE OF body, body_sha256, household_id, tax_year, template_version ON engagement_letters
WHEN OLD.status <> 'draft'
  AND NOT (OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL AND OLD.status = 'signed'
           AND NEW.body_sha256 = OLD.body_sha256 AND NEW.household_id = OLD.household_id
           AND NEW.tax_year = OLD.tax_year AND NEW.template_version = OLD.template_version)
BEGIN
  SELECT RAISE(ABORT, 'engagement letter text is frozen once sent');
END;

CREATE TRIGGER IF NOT EXISTS engagement_letters_archive_once
BEFORE UPDATE OF archived_at ON engagement_letters
WHEN OLD.archived_at IS NOT NULL OR (NEW.archived_at IS NOT NULL AND OLD.status <> 'signed')
BEGIN
  SELECT RAISE(ABORT, 'only a signed letter is archived, and only once');
END;
