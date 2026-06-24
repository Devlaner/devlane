-- The instance_admins table already exists from 000001 with a NOT NULL
-- instance_id FK to `instances`. Devlane is single-instance and tracks instance
-- info in instance_settings, so it never populates `instances`. Adapt the
-- existing table to key admins on user_id:
--   1. allow a NULL instance_id (no instances row required),
--   2. add a soft-delete column,
--   3. add a partial unique index so one user maps to one active admin row.
ALTER TABLE instance_admins ALTER COLUMN instance_id DROP NOT NULL;
ALTER TABLE instance_admins ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_instance_admins_user_active
    ON instance_admins (user_id)
    WHERE deleted_at IS NULL;
