INSERT INTO integrations (id, title, provider, network, verified, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Slack',
    'slack',
    1,
    true,
    now(),
    now()
)
ON CONFLICT (provider) DO NOTHING;

-- Create slack_channel_links table --
CREATE TABLE slack_channel_links (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_integration_id  UUID NOT NULL REFERENCES workspace_integrations (id) ON DELETE CASCADE,
    project_id                UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id              UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    channel_id                VARCHAR(64)  NOT NULL,
    channel_name              VARCHAR(255) NOT NULL,
    events                    JSONB NOT NULL DEFAULT '{}',
    actor_id                  UUID NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ,
    created_by_id             UUID,
    updated_by_id             UUID,
    UNIQUE (project_id, deleted_at)
);
