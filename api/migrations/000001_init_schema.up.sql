-- Initial schema

CREATE TABLE users (
    id UUID PRIMARY KEY ,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMPTZ,
    username VARCHAR(128) NOT NULL UNIQUE,
    mobile_number VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(255) DEFAULT '',
    last_name VARCHAR(255) DEFAULT '',
    avatar TEXT,
    date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_location VARCHAR(255) DEFAULT '',
    created_location VARCHAR(255) DEFAULT '',
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    is_managed BOOLEAN NOT NULL DEFAULT FALSE,
    is_password_expired BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_password_autoset BOOLEAN NOT NULL DEFAULT FALSE,
    is_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    token VARCHAR(64) DEFAULT '',
    user_timezone VARCHAR(255) NOT NULL DEFAULT 'UTC',
    last_active TIMESTAMPTZ,
    last_login_time TIMESTAMPTZ,
    last_logout_time TIMESTAMPTZ,
    last_login_ip VARCHAR(255) DEFAULT '',
    last_logout_ip VARCHAR(255) DEFAULT '',
    last_login_medium VARCHAR(20) DEFAULT 'email',
    last_workspace_id UUID,
    deleted_at TIMESTAMPTZ,
    display_name VARCHAR(255) DEFAULT '',
    cover_image TEXT DEFAULT '',
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    bot_type VARCHAR(50) DEFAULT '',
    is_email_valid BOOLEAN NOT NULL DEFAULT FALSE,
    masked_at TIMESTAMPTZ,
    is_password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_uagent TEXT DEFAULT '',
    token_updated_at TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_deleted_at ON users (deleted_at);

CREATE TABLE workspaces (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    logo TEXT,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    organization_size VARCHAR(50) DEFAULT '',
    timezone VARCHAR(255) NOT NULL DEFAULT 'UTC',
    background_color VARCHAR(255) DEFAULT ''
);
CREATE INDEX idx_workspaces_owner ON workspaces (owner_id);
CREATE INDEX idx_workspaces_deleted_at ON workspaces (deleted_at);

CREATE TABLE workspace_members (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role SMALLINT NOT NULL DEFAULT 5,
    company_role TEXT,
    view_props JSONB DEFAULT '{}',
    default_props JSONB DEFAULT '{}',
    issue_props JSONB DEFAULT '{"subscribed": true, "assigned": true, "created": true, "all_issues": true}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    getting_started_checklist JSONB DEFAULT '{}',
    tips JSONB DEFAULT '{}',
    explored_features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (workspace_id, member_id)
);
CREATE INDEX idx_workspace_members_workspace ON workspace_members (workspace_id);
CREATE INDEX idx_workspace_members_member ON workspace_members (member_id);

CREATE TABLE workspace_member_invites (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    token VARCHAR(255) NOT NULL,
    message TEXT,
    responded_at TIMESTAMPTZ,
    role SMALLINT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_workspace_member_invites_workspace ON workspace_member_invites (workspace_id);

CREATE TABLE workspace_user_properties (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    filters JSONB DEFAULT '{}',
    display_filters JSONB DEFAULT '{}',
    display_properties JSONB DEFAULT '{}',
    rich_filters JSONB DEFAULT '{}',
    navigation_project_limit INT NOT NULL DEFAULT 10,
    navigation_control_preference VARCHAR(25) NOT NULL DEFAULT 'ACCORDION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (workspace_id, user_id)
);
CREATE INDEX idx_workspace_user_properties_workspace ON workspace_user_properties (workspace_id);
CREATE INDEX idx_workspace_user_properties_user ON workspace_user_properties (user_id);

CREATE TABLE workspace_home_preferences (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (workspace_id, user_id, key)
);
CREATE INDEX idx_workspace_home_preferences_workspace ON workspace_home_preferences (workspace_id);

CREATE TABLE workspace_user_preferences (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (workspace_id, user_id, key)
);
CREATE INDEX idx_workspace_user_preferences_workspace ON workspace_user_preferences (workspace_id);

CREATE TABLE projects (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    identifier VARCHAR(12),
    slug VARCHAR(100),
    network SMALLINT NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    default_assignee_id UUID REFERENCES users (id) ON DELETE SET NULL,
    project_lead_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    emoji VARCHAR(10) DEFAULT '',
    icon_prop JSONB DEFAULT '{}',
    module_view BOOLEAN NOT NULL DEFAULT TRUE,
    cycle_view BOOLEAN NOT NULL DEFAULT TRUE,
    issue_views_view BOOLEAN NOT NULL DEFAULT TRUE,
    page_view BOOLEAN NOT NULL DEFAULT TRUE,
    intake_view BOOLEAN NOT NULL DEFAULT TRUE,
    is_time_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_issue_type_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    guest_view_all_features BOOLEAN NOT NULL DEFAULT FALSE,
    cover_image TEXT DEFAULT '',
    archive_in INT DEFAULT 0,
    close_in INT DEFAULT 0,
    logo_props JSONB DEFAULT '{}',
    archived_at TIMESTAMPTZ,
    timezone VARCHAR(255) NOT NULL DEFAULT 'UTC',
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT '',
    description_text TEXT DEFAULT '',
    description_html TEXT DEFAULT '',
    UNIQUE (name, workspace_id)
);
CREATE INDEX idx_projects_workspace ON projects (workspace_id);
CREATE INDEX idx_projects_deleted_at ON projects (deleted_at);

CREATE TABLE project_identifiers (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID NOT NULL UNIQUE REFERENCES projects (id) ON DELETE CASCADE,
    name VARCHAR(12) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX idx_project_identifiers_name_workspace ON project_identifiers (name, workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE project_members (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    member_id UUID REFERENCES users (id) ON DELETE CASCADE,
    role SMALLINT NOT NULL DEFAULT 5,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (project_id, member_id)
);
CREATE INDEX idx_project_members_project ON project_members (project_id);
CREATE INDEX idx_project_members_workspace ON project_members (workspace_id);

CREATE TABLE project_member_invites (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    token VARCHAR(255) NOT NULL,
    message TEXT,
    responded_at TIMESTAMPTZ,
    role SMALLINT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE workspace_user_links (
    id UUID PRIMARY KEY ,
    title VARCHAR(255),
    url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_workspace_user_links_workspace ON workspace_user_links (workspace_id);

CREATE TABLE states (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(255) NOT NULL,
    slug VARCHAR(100),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    sequence DOUBLE PRECISION NOT NULL DEFAULT 65535,
    "group" VARCHAR(50) DEFAULT 'backlog',
    is_triage BOOLEAN NOT NULL DEFAULT FALSE,
    "default" BOOLEAN NOT NULL DEFAULT FALSE,
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT '',
    UNIQUE (name, project_id)
);
CREATE INDEX idx_states_project ON states (project_id);
CREATE INDEX idx_states_workspace ON states (workspace_id);

CREATE TABLE labels (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    parent_id UUID REFERENCES labels (id) ON DELETE SET NULL,
    color VARCHAR(255) DEFAULT '',
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT ''
);
CREATE INDEX idx_labels_project ON labels (project_id);
CREATE INDEX idx_labels_workspace ON labels (workspace_id);
CREATE UNIQUE INDEX idx_labels_name_workspace_when_project_null ON labels (name) WHERE project_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_labels_project_name_when_not_deleted ON labels (project_id, name) WHERE project_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE cycles (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status VARCHAR(255) DEFAULT 'draft',
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    owned_by_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    view_props JSONB DEFAULT '{}',
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT '',
    progress_snapshot JSONB DEFAULT '{}',
    archived_at TIMESTAMPTZ,
    logo_props JSONB DEFAULT '{}',
    timezone VARCHAR(255) NOT NULL DEFAULT 'UTC',
    version INT NOT NULL DEFAULT 1
);
CREATE INDEX idx_cycles_project ON cycles (project_id);
CREATE INDEX idx_cycles_workspace ON cycles (workspace_id);

CREATE TABLE issues (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description JSONB,
    priority VARCHAR(30),
    start_date DATE,
    target_date DATE,
    sequence_id INT NOT NULL DEFAULT 1,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    state_id UUID REFERENCES states (id) ON DELETE SET NULL,
    parent_id UUID REFERENCES issues (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    is_draft BOOLEAN NOT NULL DEFAULT FALSE,
    description_html TEXT DEFAULT '',
    description_stripped TEXT DEFAULT '',
    description_binary BYTEA,
    point INT,
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT ''
);
CREATE INDEX idx_issues_project ON issues (project_id);
CREATE INDEX idx_issues_workspace ON issues (workspace_id);
CREATE INDEX idx_issues_state ON issues (state_id);
CREATE INDEX idx_issues_parent ON issues (parent_id);
CREATE INDEX idx_issues_deleted_at ON issues (deleted_at);

CREATE TABLE issue_assignees (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    assignee_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (issue_id, assignee_id)
);
CREATE INDEX idx_issue_assignees_issue ON issue_assignees (issue_id);

CREATE TABLE issue_labels (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_issue_labels_issue ON issue_labels (issue_id);

CREATE TABLE issue_comments (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    comment_stripped TEXT DEFAULT '',
    comment_json JSONB DEFAULT '{}',
    comment_html TEXT DEFAULT '',
    actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
    access VARCHAR(100) NOT NULL DEFAULT 'INTERNAL',
    edited_at TIMESTAMPTZ,
    parent_id UUID REFERENCES issue_comments (id) ON DELETE CASCADE,
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT '',
    attachments TEXT[] DEFAULT '{}'
);
CREATE INDEX idx_issue_comments_issue ON issue_comments (issue_id);

CREATE TABLE issue_blockers (
    id UUID PRIMARY KEY ,
    block_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    blocked_by_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_issue_blockers_block ON issue_blockers (block_id);
CREATE INDEX idx_issue_blockers_blocked_by ON issue_blockers (blocked_by_id);

CREATE TABLE issue_activities (
    id UUID PRIMARY KEY ,
    issue_id UUID REFERENCES issues (id) ON DELETE NO ACTION,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    verb VARCHAR(255) NOT NULL DEFAULT 'created',
    field VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    comment TEXT,
    attachments TEXT[] DEFAULT '{}',
    issue_comment_id UUID REFERENCES issue_comments (id) ON DELETE NO ACTION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
    old_identifier UUID,
    new_identifier UUID,
    epoch DOUBLE PRECISION
);
CREATE INDEX idx_issue_activities_issue ON issue_activities (issue_id);

CREATE TABLE issue_sequences (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL DEFAULT 1,
    issue_id UUID REFERENCES issues (id) ON DELETE SET NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_issue_sequences_project ON issue_sequences (project_id);

CREATE TABLE views (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_views_project ON views (project_id);

CREATE TABLE cycle_issues (
    id UUID PRIMARY KEY ,
    cycle_id UUID NOT NULL REFERENCES cycles (id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (cycle_id, issue_id)
);
CREATE INDEX idx_cycle_issues_cycle ON cycle_issues (cycle_id);
CREATE INDEX idx_cycle_issues_issue ON cycle_issues (issue_id);

CREATE TABLE file_assets (
    id UUID PRIMARY KEY ,
    attributes JSONB NOT NULL DEFAULT '{}',
    asset VARCHAR(800) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    user_id UUID REFERENCES users (id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues (id) ON DELETE CASCADE,
    comment_id UUID REFERENCES issue_comments (id) ON DELETE CASCADE,
    entity_type VARCHAR(255) DEFAULT '',
    entity_identifier VARCHAR(255) DEFAULT '',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    external_id VARCHAR(255) DEFAULT '',
    external_source VARCHAR(255) DEFAULT '',
    size DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_uploaded BOOLEAN NOT NULL DEFAULT FALSE,
    storage_metadata JSONB
);
CREATE INDEX idx_file_assets_deleted_at ON file_assets (deleted_at);
CREATE INDEX idx_file_assets_entity_type ON file_assets (entity_type);
CREATE INDEX idx_file_assets_entity_identifier ON file_assets (entity_identifier);
CREATE INDEX idx_file_assets_entity ON file_assets (entity_type, entity_identifier);
CREATE INDEX idx_file_assets_asset ON file_assets (asset);

CREATE TABLE social_login_connections (
    id UUID PRIMARY KEY ,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    medium VARCHAR(20) NOT NULL,
    token_data JSONB,
    extra_data JSONB,
    last_login_at TIMESTAMPTZ,
    last_received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_social_login_connections_user ON social_login_connections (user_id);

CREATE TABLE instances (
    id UUID PRIMARY KEY ,
    instance_name VARCHAR(255) NOT NULL,
    whitelist_emails TEXT,
    instance_id VARCHAR(255) NOT NULL UNIQUE,
    current_version VARCHAR(255) NOT NULL,
    latest_version VARCHAR(255),
    edition VARCHAR(255) NOT NULL DEFAULT 'COMMUNITY',
    product VARCHAR(50) NOT NULL DEFAULT 'plane-ce',
    domain TEXT DEFAULT '',
    last_checked_at TIMESTAMPTZ NOT NULL,
    namespace VARCHAR(255),
    is_telemetry_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_support_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_setup_done BOOLEAN NOT NULL DEFAULT FALSE,
    is_signup_screen_visited BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_test BOOLEAN NOT NULL DEFAULT FALSE,
    is_current_version_deprecated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_instances_instance_id ON instances (instance_id);

CREATE TABLE instance_admins (
    id UUID PRIMARY KEY ,
    instance_id UUID NOT NULL REFERENCES instances (id) ON DELETE CASCADE,
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    role INT NOT NULL DEFAULT 20,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (instance_id, user_id)
);
CREATE INDEX idx_instance_admins_instance ON instance_admins (instance_id);
CREATE INDEX idx_instance_admins_user ON instance_admins (user_id);

CREATE TABLE instance_configurations (
    id UUID PRIMARY KEY ,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    category TEXT NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_instance_configurations_key ON instance_configurations (key);

CREATE TABLE instance_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO instance_settings (key, value) VALUES
    ('general', '{"instance_name":"","admin_email":"","instance_id":""}'::jsonb),
    ('email', '{"host":"","port":"587","sender_email":"","security":"TLS","username":"","password_set":false}'::jsonb),
    ('auth', '{"allow_public_signup":true,"magic_code":true,"password":true,"google":false,"github":false,"gitlab":false}'::jsonb),
    ('ai', '{"model":"gpt-4o-mini","api_key_set":false}'::jsonb),
    ('image', '{"unsplash_access_key_set":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE users ADD COLUMN avatar_asset_id UUID REFERENCES file_assets (id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN cover_image_asset_id UUID REFERENCES file_assets (id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN default_state_id UUID REFERENCES states (id) ON DELETE SET NULL;
ALTER TABLE workspaces ADD COLUMN logo_asset_id UUID REFERENCES file_assets (id) ON DELETE SET NULL;

CREATE TABLE estimates (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    type VARCHAR(255) NOT NULL DEFAULT 'categories',
    last_used BOOLEAN NOT NULL DEFAULT FALSE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_estimates_project ON estimates (project_id);

CREATE TABLE estimate_points (
    id UUID PRIMARY KEY ,
    estimate_id UUID NOT NULL REFERENCES estimates (id) ON DELETE CASCADE,
    key INT NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    value VARCHAR(255) NOT NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_estimate_points_estimate ON estimate_points (estimate_id);

ALTER TABLE projects ADD COLUMN estimate_id UUID REFERENCES estimates (id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN cover_image_asset_id UUID REFERENCES file_assets (id) ON DELETE SET NULL;

CREATE TABLE issue_types (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    logo_props JSONB DEFAULT '{}',
    is_epic BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    level DOUBLE PRECISION NOT NULL DEFAULT 0,
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT '',
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_issue_types_workspace ON issue_types (workspace_id);

CREATE TABLE project_issue_types (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    issue_type_id UUID NOT NULL REFERENCES issue_types (id) ON DELETE CASCADE,
    level INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (project_id, issue_type_id)
);
ALTER TABLE issues ADD COLUMN type_id UUID REFERENCES issue_types (id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN estimate_point_id UUID REFERENCES estimate_points (id) ON DELETE SET NULL;

CREATE TABLE descriptions (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    description_html TEXT DEFAULT '<p></p>',
    description_json JSONB DEFAULT '{}',
    description_binary BYTEA,
    description_stripped TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE description_versions (
    id UUID PRIMARY KEY ,
    description_id UUID NOT NULL REFERENCES descriptions (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    description_html TEXT DEFAULT '<p></p>',
    description_json JSONB DEFAULT '{}',
    description_binary BYTEA,
    description_stripped TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
ALTER TABLE issue_comments ADD COLUMN description_id UUID REFERENCES descriptions (id) ON DELETE SET NULL;

CREATE TABLE sessions (
    session_key VARCHAR(40) PRIMARY KEY,
    session_data TEXT NOT NULL,
    expire_date TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions (expire_date);

CREATE TABLE profiles (
    id UUID PRIMARY KEY ,
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    role VARCHAR(300),
    last_workspace_id UUID REFERENCES workspaces (id) ON DELETE SET NULL,
    language VARCHAR(255) NOT NULL DEFAULT 'en',
    start_of_the_week SMALLINT NOT NULL DEFAULT 0,
    goals JSONB DEFAULT '{}',
    background_color VARCHAR(255) DEFAULT '#0d0d0d',
    theme JSONB DEFAULT '{}',
    is_app_rail_docked BOOLEAN NOT NULL DEFAULT TRUE,
    is_tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
    onboarding_step JSONB DEFAULT '{}',
    use_case TEXT,
    is_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    is_navigation_tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
    has_marketing_email_consent BOOLEAN NOT NULL DEFAULT FALSE,
    is_subscribed_to_changelog BOOLEAN NOT NULL DEFAULT FALSE,
    product_tour JSONB DEFAULT '{}',
    billing_address_country VARCHAR(255) DEFAULT 'INDIA',
    billing_address JSONB,
    has_billing_address BOOLEAN NOT NULL DEFAULT FALSE,
    company_name VARCHAR(255) DEFAULT '',
    notification_view_mode VARCHAR(255) NOT NULL DEFAULT 'full',
    is_smooth_cursor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_mobile_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    mobile_onboarding_step JSONB DEFAULT '{}',
    mobile_timezone_auto_set BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profiles_user ON profiles (user_id);

CREATE TABLE accounts (
    id UUID PRIMARY KEY ,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider_account_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    access_token_expired_at TIMESTAMPTZ,
    refresh_token TEXT,
    refresh_token_expired_at TIMESTAMPTZ,
    last_connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    id_token TEXT DEFAULT '',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_account_id)
);
CREATE INDEX idx_accounts_user ON accounts (user_id);

CREATE TABLE modules (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    description_text TEXT DEFAULT '',
    description_html TEXT DEFAULT '',
    start_date DATE,
    target_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'backlog',
    view_props JSONB DEFAULT '{}',
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    lead_id UUID REFERENCES users (id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_modules_project ON modules (project_id);

CREATE TABLE module_members (
    id UUID PRIMARY KEY ,
    module_id UUID NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (module_id, member_id)
);
CREATE TABLE module_issues (
    id UUID PRIMARY KEY ,
    module_id UUID NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (module_id, issue_id)
);
CREATE TABLE module_links (
    id UUID PRIMARY KEY ,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    module_id UUID NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE module_user_properties (
    id UUID PRIMARY KEY ,
    module_id UUID NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    view_props JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (module_id, user_id)
);

CREATE TABLE issue_views (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    query JSONB NOT NULL DEFAULT '{}',
    filters JSONB DEFAULT '{}',
    display_filters JSONB DEFAULT '{}',
    display_properties JSONB DEFAULT '{}',
    rich_filters JSONB DEFAULT '{}',
    access SMALLINT NOT NULL DEFAULT 1,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    logo_props JSONB DEFAULT '{}',
    owned_by_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_issue_views_workspace ON issue_views (workspace_id);
CREATE INDEX idx_issue_views_project ON issue_views (project_id);

CREATE TABLE issue_relations (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    related_issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL DEFAULT 'relates_to',
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE issue_mentions (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    mention_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (issue_id, mention_id)
);
CREATE TABLE issue_subscribers (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (issue_id, subscriber_id)
);
CREATE TABLE issue_reactions (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL,
    actor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (issue_id, reaction, actor_id)
);
CREATE TABLE comment_reactions (
    id UUID PRIMARY KEY ,
    comment_id UUID NOT NULL REFERENCES issue_comments (id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL,
    actor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (comment_id, reaction, actor_id)
);
CREATE TABLE issue_votes (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    vote INT NOT NULL DEFAULT 1,
    actor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (issue_id, actor_id)
);

CREATE TABLE issue_versions (
    id UUID PRIMARY KEY ,
    version INT NOT NULL DEFAULT 1,
    version_identifier VARCHAR(255) NOT NULL,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    phase VARCHAR(50) NOT NULL DEFAULT 'backlog',
    name VARCHAR(255) NOT NULL,
    description_html TEXT DEFAULT '',
    description_json JSONB DEFAULT '{}',
    description_binary BYTEA,
    priority VARCHAR(30),
    start_date DATE,
    target_date DATE,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    activity_id UUID REFERENCES issue_activities (id) ON DELETE SET NULL,
    owned_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE issue_description_versions (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    description_html TEXT DEFAULT '',
    description_json JSONB DEFAULT '{}',
    description_binary BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    owned_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE issue_links (
    id UUID PRIMARY KEY ,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE issue_attachments (
    id UUID PRIMARY KEY ,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES file_assets (id) ON DELETE CASCADE,
    attributes JSONB DEFAULT '{}',
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT '',
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE project_user_properties (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    filters JSONB DEFAULT '{}',
    display_filters JSONB DEFAULT '{}',
    display_properties JSONB DEFAULT '{}',
    rich_filters JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (project_id, user_id)
);

CREATE TABLE pages (
    id UUID PRIMARY KEY ,
    name TEXT DEFAULT '',
    description_html TEXT DEFAULT '<p></p>',
    description_json JSONB DEFAULT '{}',
    description_binary BYTEA,
    description_stripped TEXT,
    owned_by_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    access SMALLINT NOT NULL DEFAULT 0,
    color VARCHAR(255) DEFAULT '',
    parent_id UUID REFERENCES pages (id) ON DELETE CASCADE,
    archived_at TIMESTAMPTZ,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    view_props JSONB DEFAULT '{}',
    logo_props JSONB DEFAULT '{}',
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    moved_to_page UUID,
    moved_to_project UUID,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    external_id VARCHAR(255) DEFAULT '',
    external_source VARCHAR(255) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_pages_workspace ON pages (workspace_id);
CREATE INDEX idx_pages_parent ON pages (parent_id);

CREATE TABLE page_logs (
    id UUID PRIMARY KEY ,
    page_id UUID NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    transaction UUID NOT NULL ,
    entity_name VARCHAR(30) NOT NULL,
    entity_identifier UUID,
    entity_type VARCHAR(30),
    title VARCHAR(255) NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (page_id, transaction)
);
CREATE INDEX idx_page_logs_entity_type ON page_logs (entity_type);
CREATE INDEX idx_page_logs_entity_identifier ON page_logs (entity_identifier);
CREATE TABLE page_labels (
    id UUID PRIMARY KEY ,
    label_id UUID NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE project_pages (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (project_id, page_id)
);
CREATE TABLE page_versions (
    id UUID PRIMARY KEY ,
    page_id UUID NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    owned_by_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    description_binary BYTEA,
    description_html TEXT DEFAULT '<p></p>',
    description_stripped TEXT,
    description_json JSONB DEFAULT '{}',
    sub_pages_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE file_assets ADD COLUMN page_id UUID REFERENCES pages (id) ON DELETE CASCADE;
ALTER TABLE file_assets ADD COLUMN draft_issue_id UUID;

CREATE TABLE draft_issues (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description_html TEXT DEFAULT '<p></p>',
    description_json JSONB DEFAULT '{}',
    description_binary BYTEA,
    description_stripped TEXT DEFAULT '',
    priority VARCHAR(30),
    start_date DATE,
    target_date DATE,
    state_id UUID REFERENCES states (id) ON DELETE SET NULL,
    parent_id UUID REFERENCES issues (id) ON DELETE SET NULL,
    estimate_point_id UUID REFERENCES estimate_points (id) ON DELETE SET NULL,
    type_id UUID REFERENCES issue_types (id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_draft_issues_project ON draft_issues (project_id);
ALTER TABLE file_assets ADD CONSTRAINT fk_file_assets_draft_issue FOREIGN KEY (draft_issue_id) REFERENCES draft_issues (id) ON DELETE CASCADE;

CREATE TABLE draft_issue_assignees (
    id UUID PRIMARY KEY ,
    draft_issue_id UUID NOT NULL REFERENCES draft_issues (id) ON DELETE CASCADE,
    assignee_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (draft_issue_id, assignee_id)
);
CREATE TABLE draft_issue_labels (
    id UUID PRIMARY KEY ,
    draft_issue_id UUID NOT NULL REFERENCES draft_issues (id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE draft_issue_modules (
    id UUID PRIMARY KEY ,
    draft_issue_id UUID NOT NULL REFERENCES draft_issues (id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (draft_issue_id, module_id)
);
CREATE TABLE draft_issue_cycles (
    id UUID PRIMARY KEY ,
    draft_issue_id UUID NOT NULL REFERENCES draft_issues (id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES cycles (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (draft_issue_id, cycle_id)
);

CREATE TABLE intakes (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    view_props JSONB DEFAULT '{}',
    logo_props JSONB DEFAULT '{}',
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE intake_issues (
    id UUID PRIMARY KEY ,
    intake_id UUID NOT NULL REFERENCES intakes (id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    status INT NOT NULL DEFAULT -2,
    snoozed_till TIMESTAMPTZ,
    duplicate_to_id UUID REFERENCES issues (id) ON DELETE SET NULL,
    source VARCHAR(255) DEFAULT 'IN_APP',
    source_email TEXT,
    external_source VARCHAR(255) DEFAULT '',
    external_id VARCHAR(255) DEFAULT '',
    extra JSONB DEFAULT '{}',
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY ,
    title TEXT NOT NULL,
    message JSONB,
    message_html TEXT DEFAULT '<p></p>',
    message_stripped TEXT,
    sender VARCHAR(255) DEFAULT 'system',
    triggered_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    receiver_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    data JSONB,
    entity_identifier UUID,
    entity_name VARCHAR(255) DEFAULT '',
    read_at TIMESTAMPTZ,
    snoozed_till TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notif_entity_identifier_idx ON notifications (entity_identifier);
CREATE INDEX notif_entity_name_idx ON notifications (entity_name);
CREATE INDEX notif_read_at_idx ON notifications (read_at);
CREATE INDEX notif_receiver_status_idx ON notifications (receiver_id, workspace_id, read_at, created_at);
CREATE TABLE user_notification_preferences (
    id UUID PRIMARY KEY ,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces (id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects (id) ON DELETE SET NULL,
    property_change BOOLEAN NOT NULL DEFAULT TRUE,
    state_change BOOLEAN NOT NULL DEFAULT TRUE,
    comment BOOLEAN NOT NULL DEFAULT TRUE,
    mention BOOLEAN NOT NULL DEFAULT TRUE,
    issue_completed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, workspace_id, project_id)
);
CREATE TABLE email_notification_logs (
    id UUID PRIMARY KEY ,
    receiver_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    triggered_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    subject TEXT,
    entity_identifier UUID,
    entity_name VARCHAR(255),
    data JSONB,
    processed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    entity VARCHAR(200),
    old_value VARCHAR(300),
    new_value VARCHAR(300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE api_tokens (
    id UUID PRIMARY KEY ,
    label VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used TIMESTAMPTZ,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_type SMALLINT NOT NULL DEFAULT 0,
    workspace_id UUID REFERENCES workspaces (id) ON DELETE CASCADE,
    expired_at TIMESTAMPTZ,
    is_service BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_rate_limit VARCHAR(255) NOT NULL DEFAULT '60/min',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE api_activity_logs (
    id UUID PRIMARY KEY ,
    token_identifier VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    query_params TEXT,
    headers TEXT,
    body TEXT,
    response_code INT NOT NULL,
    response_body TEXT,
    ip_address INET,
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE webhooks (
    id UUID PRIMARY KEY ,
    url VARCHAR(1024) NOT NULL,
    secret_key VARCHAR(255) DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    project BOOLEAN NOT NULL DEFAULT FALSE,
    issue BOOLEAN NOT NULL DEFAULT FALSE,
    module BOOLEAN NOT NULL DEFAULT FALSE,
    cycle BOOLEAN NOT NULL DEFAULT FALSE,
    issue_comment BOOLEAN NOT NULL DEFAULT FALSE,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    version VARCHAR(50) NOT NULL DEFAULT 'v1',
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_webhooks_workspace ON webhooks (workspace_id);
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY ,
    webhook_id UUID NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    event_type VARCHAR(255),
    request_method VARCHAR(10),
    request_headers TEXT,
    request_body TEXT,
    response_status TEXT,
    response_headers TEXT,
    response_body TEXT,
    retry_count SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE project_webhooks (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    webhook_id UUID NOT NULL REFERENCES webhooks (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (project_id, webhook_id)
);

CREATE TABLE analytic_views (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    query JSONB NOT NULL DEFAULT '{}',
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE exporters (
    id UUID PRIMARY KEY ,
    name VARCHAR(255),
    type VARCHAR(50) NOT NULL DEFAULT 'issue_exports',
    provider VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    reason TEXT DEFAULT '',
    key TEXT DEFAULT '',
    url TEXT,
    token VARCHAR(255) UNIQUE,
    filters JSONB,
    rich_filters JSONB DEFAULT '{}',
    project_ids UUID[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    initiated_by_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE importers (
    id UUID PRIMARY KEY ,
    service VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    metadata JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}',
    data JSONB DEFAULT '{}',
    imported_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    initiated_by_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE user_favorites (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_identifier UUID NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    parent_id UUID REFERENCES user_favorites (id) ON DELETE CASCADE
);
CREATE TABLE user_recent_visits (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    entity_identifier UUID,
    entity_name VARCHAR(30) NOT NULL DEFAULT '',
    last_visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE devices (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    device_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE device_sessions (
    id UUID PRIMARY KEY ,
    device_id UUID NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    session_id VARCHAR(40) NOT NULL REFERENCES sessions (session_key) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stickies (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50) NOT NULL DEFAULT '#0d0d0d',
    description TEXT DEFAULT '',
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 65535,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE deploy_boards (
    id UUID PRIMARY KEY ,
    entity_identifier UUID,
    entity_name VARCHAR(30),
    anchor VARCHAR(255) NOT NULL UNIQUE ,
    is_comments_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_reactions_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_votes_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    view_props JSONB DEFAULT '{}',
    is_activity_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    intake_id UUID REFERENCES intakes (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX idx_deploy_boards_entity ON deploy_boards (entity_name, entity_identifier) WHERE deleted_at IS NULL;

CREATE TABLE workspace_themes (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name VARCHAR(300) NOT NULL,
    theme_key VARCHAR(255) NOT NULL DEFAULT 'system',
    colors JSONB DEFAULT '{}',
    actor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (workspace_id, name)
);
CREATE TABLE teams (
    id UUID PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(50) NOT NULL,
    description TEXT DEFAULT '',
    logo_props JSONB DEFAULT '{}',
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE team_members (
    id UUID PRIMARY KEY ,
    team_id UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (team_id, member_id)
);
CREATE TABLE project_public_members (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (project_id, member_id)
);
CREATE TABLE project_deploy_boards (
    id UUID PRIMARY KEY ,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    anchor VARCHAR(255) NOT NULL UNIQUE ,
    comments BOOLEAN NOT NULL DEFAULT FALSE,
    reactions BOOLEAN NOT NULL DEFAULT FALSE,
    intake_id UUID REFERENCES intakes (id) ON DELETE SET NULL,
    votes BOOLEAN NOT NULL DEFAULT FALSE,
    views JSONB DEFAULT '{"list": true, "kanban": true, "calendar": true, "gantt": true, "spreadsheet": true}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE cycle_user_properties (
    id UUID PRIMARY KEY ,
    cycle_id UUID NOT NULL REFERENCES cycles (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    filters JSONB DEFAULT '{}',
    display_filters JSONB DEFAULT '{}',
    display_properties JSONB DEFAULT '{}',
    rich_filters JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (cycle_id, user_id)
);

CREATE TABLE integrations (
    id UUID PRIMARY KEY ,
    title VARCHAR(400) NOT NULL,
    provider VARCHAR(400) NOT NULL UNIQUE,
    network INT NOT NULL DEFAULT 1,
    description JSONB DEFAULT '{}',
    author VARCHAR(400) DEFAULT '',
    webhook_url TEXT DEFAULT '',
    webhook_secret TEXT DEFAULT '',
    redirect_url TEXT DEFAULT '',
    metadata JSONB DEFAULT '{}',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE workspace_integrations (
    id UUID PRIMARY KEY ,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
    api_token_id UUID NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (workspace_id, integration_id)
);

CREATE TABLE slack_project_syncs (
    id UUID PRIMARY KEY ,
    access_token VARCHAR(300) NOT NULL,
    scopes TEXT NOT NULL,
    bot_user_id VARCHAR(50) NOT NULL,
    webhook_url VARCHAR(1000) NOT NULL,
    data JSONB DEFAULT '{}',
    team_id VARCHAR(30) NOT NULL,
    team_name VARCHAR(300) NOT NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (team_id, project_id)
);

CREATE TABLE github_repositories (
    id UUID PRIMARY KEY ,
    name VARCHAR(500) NOT NULL,
    url TEXT,
    config JSONB DEFAULT '{}',
    repository_id BIGINT NOT NULL,
    owner VARCHAR(500) NOT NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE github_repository_syncs (
    id UUID PRIMARY KEY ,
    repository_id UUID NOT NULL REFERENCES github_repositories (id) ON DELETE CASCADE,
    credentials JSONB DEFAULT '{}',
    actor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations (id) ON DELETE CASCADE,
    label_id UUID REFERENCES labels (id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (project_id, repository_id)
);
CREATE TABLE github_issue_syncs (
    id UUID PRIMARY KEY ,
    repo_issue_id BIGINT NOT NULL,
    github_issue_id BIGINT NOT NULL,
    issue_url TEXT NOT NULL,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    repository_sync_id UUID NOT NULL REFERENCES github_repository_syncs (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (repository_sync_id, issue_id)
);
CREATE TABLE github_comment_syncs (
    id UUID PRIMARY KEY ,
    repo_comment_id BIGINT NOT NULL,
    comment_id UUID NOT NULL REFERENCES issue_comments (id) ON DELETE CASCADE,
    issue_sync_id UUID NOT NULL REFERENCES github_issue_syncs (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (issue_sync_id, comment_id)
);

CREATE TABLE changelogs (
    id UUID PRIMARY KEY ,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    version VARCHAR(255) NOT NULL DEFAULT '',
    tags JSONB DEFAULT '[]',
    release_date TIMESTAMPTZ,
    is_release_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
