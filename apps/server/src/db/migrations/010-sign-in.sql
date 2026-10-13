-- 010: real sign-in (ticket 05). One-time links that set a password, sessions, and lockout after repeated failures.
-- Neither table stores a usable secret: a link's token and a session's token live only in the browser (or the URL
-- the preparer copies); here they are SHA-256 hashes. Credentials are never exported (export/household.ts).

-- A one-time link that sets a password: an invite for a new login, or a reset (issued by the preparer, or by the
-- CLI for the preparer's own account). Used once; a newer link for the same login replaces older ones.
CREATE TABLE IF NOT EXISTS invites (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id),
  purpose     TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
  token_hash  TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_by  TEXT REFERENCES users (id),                              -- NULL: issued from the command line
  created_at  TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  expires_at  TEXT NOT NULL CHECK (expires_at LIKE '____-__-__T__:__:__%Z'),
  used_at     TEXT CHECK (used_at LIKE '____-__-__T__:__:__%Z'),
  revoked_at  TEXT CHECK (revoked_at LIKE '____-__-__T__:__:__%Z'),
  CHECK (expires_at > created_at),
  CHECK (used_at IS NULL OR revoked_at IS NULL)                        -- a link is used or withdrawn, never both
) STRICT;
CREATE INDEX IF NOT EXISTS invites_by_user ON invites (user_id, created_at);

-- A signed-in browser on one surface (the portal or the admin). 30 minutes idle, 12 hours at most, revocable.
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  token_hash    TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  user_id       TEXT NOT NULL REFERENCES users (id),
  surface       TEXT NOT NULL CHECK (surface IN ('portal', 'admin')),
  created_at    TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  last_seen_at  TEXT NOT NULL CHECK (last_seen_at LIKE '____-__-__T__:__:__%Z'),
  expires_at    TEXT NOT NULL CHECK (expires_at LIKE '____-__-__T__:__:__%Z'),
  revoked_at    TEXT CHECK (revoked_at LIKE '____-__-__T__:__:__%Z'),
  ip            TEXT,
  user_agent    TEXT,
  CHECK (expires_at > created_at)
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions (user_id, revoked_at);

-- Lockout: 10 failures in a row lock the login for 15 minutes. A success clears the count.
ALTER TABLE users ADD COLUMN failed_sign_ins INTEGER NOT NULL DEFAULT 0 CHECK (failed_sign_ins >= 0);
ALTER TABLE users ADD COLUMN locked_until TEXT CHECK (locked_until LIKE '____-__-__T__:__:__%Z');
ALTER TABLE users ADD COLUMN last_sign_in_at TEXT CHECK (last_sign_in_at LIKE '____-__-__T__:__:__%Z');
