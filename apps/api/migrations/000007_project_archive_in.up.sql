-- Auto-archive: number of months after which settled (completed/cancelled) work
-- items are archived. 0 disables the automation for the project.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archive_in INT NOT NULL DEFAULT 0;
