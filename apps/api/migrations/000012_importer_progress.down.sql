DROP INDEX IF EXISTS idx_importers_project;

ALTER TABLE importers
    DROP COLUMN IF EXISTS total_count,
    DROP COLUMN IF EXISTS processed_count,
    DROP COLUMN IF EXISTS error_count,
    DROP COLUMN IF EXISTS error_message,
    DROP COLUMN IF EXISTS source_filename;

-- Restore the NOT NULL constraint on token_id. This only succeeds if no rows
-- with a null token_id remain (true on a clean rollback).
ALTER TABLE importers ALTER COLUMN token_id SET NOT NULL;
