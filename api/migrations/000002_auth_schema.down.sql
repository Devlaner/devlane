-- Reverse order: accounts legacy shape first, then drop password_reset_tokens.

DROP INDEX IF EXISTS idx_accounts_provider;

ALTER TABLE accounts ALTER COLUMN id DROP DEFAULT;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS access_token_expired_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS refresh_token_expired_at TIMESTAMPTZ;

UPDATE accounts
SET access_token_expired_at = token_expires_at
WHERE access_token_expired_at IS NULL AND token_expires_at IS NOT NULL;

ALTER TABLE accounts DROP COLUMN IF EXISTS token_expires_at;

UPDATE accounts SET access_token = COALESCE(access_token, '') WHERE access_token IS NULL;
ALTER TABLE accounts ALTER COLUMN access_token SET NOT NULL;

UPDATE accounts SET last_connected_at = COALESCE(last_connected_at, NOW()) WHERE last_connected_at IS NULL;
ALTER TABLE accounts ALTER COLUMN last_connected_at SET DEFAULT NOW();
ALTER TABLE accounts ALTER COLUMN last_connected_at SET NOT NULL;

DROP TABLE IF EXISTS password_reset_tokens;
