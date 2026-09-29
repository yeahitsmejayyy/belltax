-- 008: e-file status (ticket 40). ProSeries has no API, so the preparer records each e-file by hand: submitted,
-- then accepted or rejected by the IRS (federal) or the FTB (state).
--
-- One row per attempt, never deleted. A resubmission after a rejection is a new row, so a return keeps its
-- whole story (rejected once for a code, fixed, accepted). A row changes once, from submitted to its answer;
-- a trigger holds that. The return's status for a jurisdiction is its latest attempt.

CREATE TABLE IF NOT EXISTS efile_submissions (
  id              TEXT PRIMARY KEY,
  engagement_id   TEXT NOT NULL REFERENCES engagements (id),
  jurisdiction    TEXT NOT NULL CHECK (jurisdiction IN ('federal', 'state')),
  status          TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected')),
  submitted_at    TEXT NOT NULL CHECK (submitted_at LIKE '____-__-__T__:__:__%Z'),
  decided_at      TEXT CHECK (decided_at LIKE '____-__-__T__:__:__%Z'),
  rejection_code  TEXT CHECK (rejection_code IS NULL OR length(trim(rejection_code)) BETWEEN 1 AND 40), -- e.g. IND-031-04
  rejection_note  TEXT CHECK (rejection_note IS NULL OR length(trim(rejection_note)) BETWEEN 3 AND 500),
  CHECK ((status = 'submitted') = (decided_at IS NULL)),
  CHECK ((status = 'rejected') = (rejection_code IS NOT NULL AND rejection_note IS NOT NULL)),
  CHECK (decided_at IS NULL OR decided_at >= submitted_at)
) STRICT;

CREATE INDEX IF NOT EXISTS efile_by_return ON efile_submissions (engagement_id, jurisdiction, submitted_at);

-- An attempt is answered once; after that it's history.
CREATE TRIGGER IF NOT EXISTS efile_answer_once BEFORE UPDATE ON efile_submissions
WHEN OLD.status <> 'submitted' OR NEW.engagement_id <> OLD.engagement_id OR NEW.jurisdiction <> OLD.jurisdiction OR NEW.submitted_at <> OLD.submitted_at
BEGIN SELECT RAISE(ABORT, 'an e-file attempt is answered once; resubmitting is a new attempt'); END;
CREATE TRIGGER IF NOT EXISTS efile_no_delete BEFORE DELETE ON efile_submissions
BEGIN SELECT RAISE(ABORT, 'e-file attempts are never deleted'); END;
-- No second attempt while one is still waiting for its answer.
CREATE TRIGGER IF NOT EXISTS efile_one_pending BEFORE INSERT ON efile_submissions
WHEN EXISTS (SELECT 1 FROM efile_submissions WHERE engagement_id = NEW.engagement_id AND jurisdiction = NEW.jurisdiction AND status = 'submitted')
BEGIN SELECT RAISE(ABORT, 'that return already has an e-file waiting for an answer'); END;
