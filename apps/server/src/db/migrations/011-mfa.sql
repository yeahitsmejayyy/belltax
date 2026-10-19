-- 011: MFA for everyone (ticket 05b). A passkey is the way in; an authenticator app (TOTP) is the fallback, paired with
-- a password; the preparer keeps both, plus one-time recovery codes. Credentials are never exported (export/household.ts).

-- A passkey: the public half of a key pair whose private half stays on the person's device (or their iCloud Keychain /
-- Google Password Manager). Nothing here can sign anyone in. Removing one deletes the row; the event log keeps the story.
CREATE TABLE IF NOT EXISTS passkeys (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users (id),
  credential_id  TEXT NOT NULL UNIQUE CHECK (length(credential_id) BETWEEN 16 AND 1400),  -- base64url, from the device
  public_key     BLOB NOT NULL,                                                           -- COSE key
  counter        INTEGER NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports     TEXT,                                                                    -- comma-separated hints
  rp_id          TEXT NOT NULL,                                                           -- the host it was made for
  backed_up      INTEGER NOT NULL CHECK (backed_up IN (0, 1)),                            -- synced to a cloud keychain
  name           TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  created_at     TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  last_used_at   TEXT CHECK (last_used_at LIKE '____-__-__T__:__:__%Z')
) STRICT;
CREATE INDEX IF NOT EXISTS passkeys_by_user ON passkeys (user_id);

-- An authenticator app's shared secret (RFC 6238). It has to be readable to check a code, so it can't be hashed; it is
-- useless without the password, which is. last_step stops a code being used twice.
CREATE TABLE IF NOT EXISTS totp_secrets (
  user_id     TEXT PRIMARY KEY REFERENCES users (id),
  secret      TEXT NOT NULL CHECK (length(secret) = 32),   -- 20 random bytes, base32
  last_step   INTEGER NOT NULL DEFAULT 0 CHECK (last_step >= 0),
  created_at  TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z')
) STRICT;

-- The preparer's recovery codes: shown once, stored as SHA-256, each used once. A new set replaces the old one.
CREATE TABLE IF NOT EXISTS recovery_codes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id),
  code_hash   TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  created_at  TEXT NOT NULL CHECK (created_at LIKE '____-__-__T__:__:__%Z'),
  used_at     TEXT CHECK (used_at LIKE '____-__-__T__:__:__%Z')
) STRICT;
CREATE INDEX IF NOT EXISTS recovery_codes_by_user ON recovery_codes (user_id, used_at);
