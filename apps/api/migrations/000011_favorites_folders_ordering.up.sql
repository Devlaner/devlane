-- Extend user_favorites for folders and ordering. parent_id already exists.
ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS is_folder BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535;
