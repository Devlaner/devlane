-- Adapt the pre-existing (unused) importers table for user-initiated bulk
-- imports. The table was scaffolded around a token-based flow (token_id NOT
-- NULL referencing api_tokens); a CSV import is initiated by a signed-in user
-- through the UI and has no API token, so relax that constraint and add the
-- progress/columns the importer service tracks.
ALTER TABLE importers ALTER COLUMN token_id DROP NOT NULL;

ALTER TABLE importers
    ADD COLUMN IF NOT EXISTS total_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS processed_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS source_filename VARCHAR(512);

CREATE INDEX IF NOT EXISTS idx_importers_project ON importers (project_id, created_at DESC);
