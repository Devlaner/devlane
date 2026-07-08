DROP INDEX IF EXISTS idx_agent_runs_workspace_status;
DROP INDEX IF EXISTS idx_agent_runs_issue;
DROP INDEX IF EXISTS idx_agent_runs_agent;
DROP TABLE IF EXISTS agent_runs;

DROP INDEX IF EXISTS idx_agent_issue_assignments_issue_agent_active;
DROP INDEX IF EXISTS idx_agent_issue_assignments_workspace;
DROP INDEX IF EXISTS idx_agent_issue_assignments_agent;
DROP INDEX IF EXISTS idx_agent_issue_assignments_issue;
DROP TABLE IF EXISTS agent_issue_assignments;

DROP INDEX IF EXISTS idx_agent_tool_permissions_agent_tool_scope_active;
DROP INDEX IF EXISTS idx_agent_tool_permissions_agent;
DROP TABLE IF EXISTS agent_tool_permissions;

DROP INDEX IF EXISTS idx_agents_project_name_active;
DROP INDEX IF EXISTS idx_agents_workspace_name_active;
DROP INDEX IF EXISTS idx_agents_deleted_at;
DROP INDEX IF EXISTS idx_agents_project;
DROP INDEX IF EXISTS idx_agents_workspace;
DROP TABLE IF EXISTS agents;
