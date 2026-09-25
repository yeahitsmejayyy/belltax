-- 002: the preparer has read a client's answer. Clears it from the admin Inbox (ticket 27).
-- A question can only be acknowledged once it has been answered.
ALTER TABLE requests ADD COLUMN acknowledged_at TEXT
  CHECK (acknowledged_at IS NULL OR (acknowledged_at LIKE '____-__-__T__:__:__%Z' AND responded_at IS NOT NULL));
