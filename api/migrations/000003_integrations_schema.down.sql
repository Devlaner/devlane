DELETE FROM instance_settings WHERE key = 'github_app';
DELETE FROM integrations WHERE provider = 'github';

DROP INDEX IF EXISTS idx_github_webhook_events_event;
DROP INDEX IF EXISTS idx_github_webhook_events_created;
DROP INDEX IF EXISTS idx_github_webhook_events_installation;
DROP TABLE IF EXISTS github_webhook_events;

DROP INDEX IF EXISTS idx_github_issue_syncs_repository_sync;
DROP INDEX IF EXISTS idx_github_issue_syncs_repo_issue_id;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS detection_source;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS head_branch;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS base_branch;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS author_login;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS closed_at;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS merged_at;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS draft;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS title;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS state;
ALTER TABLE github_issue_syncs DROP COLUMN IF EXISTS kind;

ALTER TABLE github_repository_syncs DROP COLUMN IF EXISTS done_state_id;
ALTER TABLE github_repository_syncs DROP COLUMN IF EXISTS in_progress_state_id;
ALTER TABLE github_repository_syncs DROP COLUMN IF EXISTS auto_close_on_merge;
ALTER TABLE github_repository_syncs DROP COLUMN IF EXISTS auto_link;

DROP INDEX IF EXISTS idx_workspace_integrations_installation;
ALTER TABLE workspace_integrations DROP COLUMN IF EXISTS suspended_at;
ALTER TABLE workspace_integrations DROP COLUMN IF EXISTS account_avatar_url;
ALTER TABLE workspace_integrations DROP COLUMN IF EXISTS account_type;
ALTER TABLE workspace_integrations DROP COLUMN IF EXISTS account_login;
ALTER TABLE workspace_integrations DROP COLUMN IF EXISTS installation_id;
-- NOTE: cannot safely re-apply NOT NULL on api_token_id if rows exist with NULL.
-- ALTER TABLE workspace_integrations ALTER COLUMN api_token_id SET NOT NULL;
