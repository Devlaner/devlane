CREATE TABLE agents (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    model VARCHAR(100) NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    autonomy_level VARCHAR(50) NOT NULL DEFAULT 'suggest',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_agents_workspace ON agents (workspace_id);
CREATE INDEX idx_agents_project ON agents (project_id);
CREATE INDEX idx_agents_deleted_at ON agents (deleted_at);
CREATE UNIQUE INDEX idx_agents_workspace_name_active
    ON agents (workspace_id, lower(name))
    WHERE project_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_agents_project_name_active
    ON agents (project_id, lower(name))
    WHERE project_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE agent_tool_permissions (
    id UUID PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
    tool VARCHAR(100) NOT NULL,
    scope VARCHAR(100) NOT NULL DEFAULT 'workspace',
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_agent_tool_permissions_agent ON agent_tool_permissions (agent_id);
CREATE UNIQUE INDEX idx_agent_tool_permissions_agent_tool_scope_active
    ON agent_tool_permissions (agent_id, tool, scope)
    WHERE deleted_at IS NULL;

CREATE TABLE agent_issue_assignments (
    id UUID PRIMARY KEY,
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    assigned_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_agent_issue_assignments_issue ON agent_issue_assignments (issue_id);
CREATE INDEX idx_agent_issue_assignments_agent ON agent_issue_assignments (agent_id);
CREATE INDEX idx_agent_issue_assignments_workspace ON agent_issue_assignments (workspace_id);
CREATE UNIQUE INDEX idx_agent_issue_assignments_issue_agent_active
    ON agent_issue_assignments (issue_id, agent_id)
    WHERE deleted_at IS NULL;

CREATE TABLE agent_runs (
    id UUID PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    trigger VARCHAR(100) NOT NULL DEFAULT 'manual',
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB NOT NULL DEFAULT '{}',
    error TEXT NOT NULL DEFAULT '',
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_agent_runs_agent ON agent_runs (agent_id);
CREATE INDEX idx_agent_runs_issue ON agent_runs (issue_id);
CREATE INDEX idx_agent_runs_workspace_status ON agent_runs (workspace_id, status);
