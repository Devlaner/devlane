-- At most one default intake per project. The partial unique index makes
-- GetOrCreateDefault race-safe: a concurrent creator hits a conflict and the
-- caller re-reads the winning row.
CREATE UNIQUE INDEX IF NOT EXISTS ux_intakes_default_per_project
    ON intakes (project_id)
    WHERE is_default AND deleted_at IS NULL;
