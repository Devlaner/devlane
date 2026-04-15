-- Password reset tokens + OAuth accounts columns (single migration after init).
-- If schema_migrations is already 2 from an older password-only 000002, this file will not run again;
-- apply the accounts section manually or coordinate a follow-up migration.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token) WHERE used_at IS NULL;

-- Align public.accounts with model.Account (legacy init columns -> token_expires_at, nullable tokens / last_connected_at).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'access_token_expired_at'
  ) THEN
    UPDATE accounts
    SET token_expires_at = access_token_expired_at
    WHERE token_expires_at IS NULL AND access_token_expired_at IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'refresh_token_expired_at'
  ) THEN
    UPDATE accounts
    SET token_expires_at = refresh_token_expired_at
    WHERE token_expires_at IS NULL AND refresh_token_expired_at IS NOT NULL;
  END IF;
END $$;

ALTER TABLE accounts DROP COLUMN IF EXISTS access_token_expired_at;
ALTER TABLE accounts DROP COLUMN IF EXISTS refresh_token_expired_at;

ALTER TABLE accounts ALTER COLUMN access_token SET DEFAULT '';
ALTER TABLE accounts ALTER COLUMN access_token DROP NOT NULL;
UPDATE accounts SET access_token = '' WHERE access_token IS NULL;

ALTER TABLE accounts ALTER COLUMN last_connected_at DROP DEFAULT;
ALTER TABLE accounts ALTER COLUMN last_connected_at DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts (provider, user_id);

ALTER TABLE accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();
