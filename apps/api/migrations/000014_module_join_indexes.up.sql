-- The module join tables had no indexes, so every lookup by module_id or
-- issue_id did a sequential scan (ListModuleIssueIDs, RemoveModuleIssue,
-- CountIssuesByModuleIDs, ListMemberIDsByModuleIDs, the progress join, etc.).
-- The cycle join tables already have the equivalent indexes; add them here.
CREATE INDEX IF NOT EXISTS idx_module_issues_module ON module_issues (module_id);
CREATE INDEX IF NOT EXISTS idx_module_issues_issue ON module_issues (issue_id);
CREATE INDEX IF NOT EXISTS idx_module_members_module ON module_members (module_id);
CREATE INDEX IF NOT EXISTS idx_module_links_module ON module_links (module_id);
