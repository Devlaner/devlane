DROP INDEX IF EXISTS idx_issues_is_epic;
ALTER TABLE issues DROP COLUMN IF EXISTS is_epic;
