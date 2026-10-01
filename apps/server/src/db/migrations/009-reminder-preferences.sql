-- 009: reminder preferences (ticket 42). What a client wants to be nudged about, and how: one row per login
-- per kind of reminder. No row means the default (email on, text off). Sending reminders is its own ticket;
-- this stores the choice the portal's Settings screen makes.

CREATE TABLE IF NOT EXISTS reminder_preferences (
  user_id     TEXT NOT NULL REFERENCES users (id),
  kind        TEXT NOT NULL CHECK (kind IN ('requests', 'letter', 'invoice')),
  by_email    INTEGER NOT NULL CHECK (by_email IN (0, 1)),
  by_text     INTEGER NOT NULL CHECK (by_text IN (0, 1)),
  updated_at  TEXT NOT NULL CHECK (updated_at LIKE '____-__-__T__:__:__%Z'),
  PRIMARY KEY (user_id, kind)
) STRICT;
