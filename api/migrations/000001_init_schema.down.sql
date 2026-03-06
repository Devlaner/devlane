-- Drop in reverse dependency order (child tables first).

DROP TABLE IF EXISTS changelogs;
DROP TABLE IF EXISTS github_comment_syncs;
DROP TABLE IF EXISTS github_issue_syncs;
DROP TABLE IF EXISTS github_repository_syncs;
DROP TABLE IF EXISTS github_repositories;
DROP TABLE IF EXISTS slack_project_syncs;
DROP TABLE IF EXISTS workspace_integrations;
DROP TABLE IF EXISTS integrations;

DROP TABLE IF EXISTS cycle_user_properties;
DROP TABLE IF EXISTS project_deploy_boards;
DROP TABLE IF EXISTS project_public_members;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS workspace_themes;
DROP TABLE IF EXISTS deploy_boards;
DROP TABLE IF EXISTS stickies;

DROP TABLE IF EXISTS device_sessions;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS user_recent_visits;
DROP TABLE IF EXISTS user_favorites;

DROP TABLE IF EXISTS importers;
DROP TABLE IF EXISTS exporters;
DROP TABLE IF EXISTS analytic_views;
DROP TABLE IF EXISTS project_webhooks;
DROP TABLE IF EXISTS webhook_logs;
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS api_activity_logs;
DROP TABLE IF EXISTS api_tokens;

DROP TABLE IF EXISTS email_notification_logs;
DROP TABLE IF EXISTS user_notification_preferences;
DROP TABLE IF EXISTS notifications;

DROP TABLE IF EXISTS intake_issues;
DROP TABLE IF EXISTS intakes;
DROP TABLE IF EXISTS draft_issue_cycles;
DROP TABLE IF EXISTS draft_issue_modules;
DROP TABLE IF EXISTS draft_issue_labels;
DROP TABLE IF EXISTS draft_issue_assignees;
DROP TABLE IF EXISTS draft_issues;

DROP TABLE IF EXISTS page_versions;
DROP TABLE IF EXISTS project_pages;
DROP TABLE IF EXISTS page_labels;
DROP TABLE IF EXISTS page_logs;
DROP TABLE IF EXISTS pages;

DROP TABLE IF EXISTS project_user_properties;
DROP TABLE IF EXISTS issue_attachments;
DROP TABLE IF EXISTS issue_links;
DROP TABLE IF EXISTS issue_description_versions;
DROP TABLE IF EXISTS issue_versions;
DROP TABLE IF EXISTS issue_votes;
DROP TABLE IF EXISTS comment_reactions;
DROP TABLE IF EXISTS issue_reactions;
DROP TABLE IF EXISTS issue_subscribers;
DROP TABLE IF EXISTS issue_mentions;
DROP TABLE IF EXISTS issue_relations;
DROP TABLE IF EXISTS issue_views;

DROP TABLE IF EXISTS module_user_properties;
DROP TABLE IF EXISTS module_links;
DROP TABLE IF EXISTS module_issues;
DROP TABLE IF EXISTS module_members;
DROP TABLE IF EXISTS modules;

DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS sessions;

DROP TABLE IF EXISTS description_versions;
DROP TABLE IF EXISTS descriptions;

DROP TABLE IF EXISTS project_issue_types;
DROP TABLE IF EXISTS issue_types;
DROP TABLE IF EXISTS estimate_points;
DROP TABLE IF EXISTS estimates;

DROP TABLE IF EXISTS instance_settings;
DROP TABLE IF EXISTS instance_configurations;
DROP TABLE IF EXISTS instance_admins;
DROP TABLE IF EXISTS instances;

DROP TABLE IF EXISTS social_login_connections;

DROP TABLE IF EXISTS cycle_issues;
DROP TABLE IF EXISTS views;
DROP TABLE IF EXISTS issue_sequences;
DROP TABLE IF EXISTS issue_activities;
DROP TABLE IF EXISTS issue_blockers;
DROP TABLE IF EXISTS issue_comments;
DROP TABLE IF EXISTS issue_labels;
DROP TABLE IF EXISTS issue_assignees;
DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS cycles;
DROP TABLE IF EXISTS labels;
DROP TABLE IF EXISTS states;

DROP TABLE IF EXISTS project_member_invites;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS project_identifiers;

ALTER TABLE projects DROP COLUMN IF EXISTS default_state_id;
ALTER TABLE projects DROP COLUMN IF EXISTS cover_image_asset_id;
ALTER TABLE projects DROP COLUMN IF EXISTS estimate_id;
DROP TABLE IF EXISTS projects;

DROP TABLE IF EXISTS workspace_user_links;
DROP TABLE IF EXISTS workspace_user_properties;
DROP TABLE IF EXISTS workspace_home_preferences;
DROP TABLE IF EXISTS workspace_user_preferences;
DROP TABLE IF EXISTS workspace_member_invites;
DROP TABLE IF EXISTS workspace_members;

ALTER TABLE workspaces DROP COLUMN IF EXISTS logo_asset_id;
DROP TABLE IF EXISTS workspaces;

ALTER TABLE users DROP COLUMN IF EXISTS avatar_asset_id;
ALTER TABLE users DROP COLUMN IF EXISTS cover_image_asset_id;
DROP TABLE IF EXISTS file_assets;
DROP TABLE IF EXISTS users;
