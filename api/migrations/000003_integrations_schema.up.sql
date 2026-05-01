-- GitHub App + integrations enhancements.
--
-- The integration tables already exist (see 000001), but they were modeled on
-- Plane's user-OAuth-token approach. For Devlane we use a GitHub App, which
-- has installation IDs (no Plane API token to associate). This migration:
--   1. Relaxes the NOT NULL on workspace_integrations.api_token_id.
--   2. Adds GitHub App columns (installation_id, account_login, ...).
--   3. Extends github_issue_syncs to support pull-request sync (state, draft,
--      branches, title cache, detection source, etc).
--   4. Adds per-repo sync settings (auto_link, auto_close_on_merge, state map).
--   5. Adds github_webhook_events for inbound webhook observability.
--   6. Seeds the integrations row for "github" and the github_app instance
--      settings section.

-- 1. Allow workspace_integrations without an API token (GitHub App auth).
ALTER TABLE workspace_integrations ALTER COLUMN api_token_id DROP NOT NULL;

-- 2. GitHub App-specific columns on workspace_integrations.
ALTER TABLE workspace_integrations ADD COLUMN IF NOT EXISTS installation_id BIGINT;
ALTER TABLE workspace_integrations ADD COLUMN IF NOT EXISTS account_login VARCHAR(255) DEFAULT '';
ALTER TABLE workspace_integrations ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT '';
ALTER TABLE workspace_integrations ADD COLUMN IF NOT EXISTS account_avatar_url TEXT DEFAULT '';
ALTER TABLE workspace_integrations ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- One installation can only map to one workspace_integration row at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_integrations_installation
    ON workspace_integrations (installation_id)
    WHERE installation_id IS NOT NULL AND deleted_at IS NULL;

-- 3. Per-repo sync settings.
ALTER TABLE github_repository_syncs ADD COLUMN IF NOT EXISTS auto_link BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE github_repository_syncs ADD COLUMN IF NOT EXISTS auto_close_on_merge BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE github_repository_syncs ADD COLUMN IF NOT EXISTS in_progress_state_id UUID REFERENCES states (id) ON DELETE SET NULL;
ALTER TABLE github_repository_syncs ADD COLUMN IF NOT EXISTS done_state_id UUID REFERENCES states (id) ON DELETE SET NULL;

-- 4. Extend github_issue_syncs to cover pull-request sync.
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS kind VARCHAR(30) NOT NULL DEFAULT 'pull_request';
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS state VARCHAR(30) NOT NULL DEFAULT 'open';
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS title VARCHAR(1024) DEFAULT '';
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS draft BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS author_login VARCHAR(255) DEFAULT '';
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS base_branch VARCHAR(255) DEFAULT '';
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS head_branch VARCHAR(255) DEFAULT '';
ALTER TABLE github_issue_syncs ADD COLUMN IF NOT EXISTS detection_source VARCHAR(30) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_github_issue_syncs_repo_issue_id
    ON github_issue_syncs (repo_issue_id);
CREATE INDEX IF NOT EXISTS idx_github_issue_syncs_repository_sync
    ON github_issue_syncs (repository_sync_id);

-- 5. Inbound webhook log (idempotent on delivery_id).
CREATE TABLE IF NOT EXISTS github_webhook_events (
    id UUID PRIMARY KEY,
    delivery_id VARCHAR(255) NOT NULL UNIQUE,
    event VARCHAR(64) NOT NULL,
    action VARCHAR(64) DEFAULT '',
    installation_id BIGINT,
    workspace_integration_id UUID REFERENCES workspace_integrations (id) ON DELETE SET NULL,
    repository_full_name VARCHAR(500) DEFAULT '',
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'received',
    error TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_installation ON github_webhook_events (installation_id);
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_created ON github_webhook_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_event ON github_webhook_events (event, action);

-- 6. Seed integration provider row + instance settings section.
INSERT INTO integrations (id, title, provider, network, description, author, verified, avatar_url, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'GitHub',
    'github',
    1,
    '{"text":"Two-way sync between GitHub pull requests and Devlane issues."}'::jsonb,
    'Devlane',
    TRUE,
    'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    NOW(),
    NOW()
)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO instance_settings (key, value) VALUES
    ('github_app', '{"app_id":"","app_name":"","client_id":"","client_secret_set":false,"private_key_set":false,"webhook_secret_set":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
