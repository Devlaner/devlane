# Slack Integration for Channel Notifications

| Field | Value |
| --- | --- |
| **Type** | Feature |
| **Priority** | Medium |
| **Area** | Integrations (API + Web) |
| **Status** | Proposed |

## Summary

Devlane has no Slack integration. Teams cannot post issue/project notifications to
Slack channels, so activity that already flows through Devlane's in-app notification
system (assignments, state changes, comments, etc.) has no path into the chat tools
where teams actually coordinate. GitHub is the only integration that is fully wired
end-to-end; Slack exists in name only.

## Current State (Evidence)

- **Model:** `apps/api/internal/model/integration.go` references `slack` only in a
  doc comment on the `Integration` struct (`"a registered integration provider
  (github, slack, ...)"`). There is no Slack-specific model, no per-project channel
  table, and no token storage.
- **OAuth:** `apps/api/internal/oauth/` contains providers for `google`, `github`,
  and `gitlab` only (`google.go`, `github.go`, `gitlab.go`). There is no Slack OAuth
  provider and no Slack app install/callback flow.
- **Provider package:** `apps/api/internal/github/` implements a complete provider
  (client, app, installations, webhook, ref parsing). There is no equivalent
  `slack/` package.
- **Handlers:** `apps/api/internal/handler/integration.go` exposes generic
  integration endpoints plus GitHub-specific install/sync/webhook flows. No Slack
  handler or routes exist.
- **Services:** `apps/api/internal/service/` has `integration.go`, `github_sync.go`,
  and `github_events.go`, plus `notification.go` (which fans out in-app/email
  notifications via `Emit*` methods and the RabbitMQ `queue.Publisher`). Nothing
  sends to Slack.
- **Instance settings:** `apps/api/internal/model/instance_setting.go` is the
  key-value (JSONB) store used for SMTP and OAuth provider credentials, resolved at
  request time. There is no Slack app credential key.
- **Web UI:** `apps/web/src/components/integrations/` contains only GitHub
  components (`IntegrationsSection.tsx`, `RepoSyncSettingsModal.tsx`).
  `IntegrationsSection` is hardcoded to a single `github` provider (`installed.find(
  (wi) => wi.provider === 'github')`) with no Slack card, connect button, or
  channel-select UI.

**GitHub integration is complete** and is the reference pattern to follow for
layering, routing conventions, and instance-settings-based credential resolution.

## Problem

There is no supported way to deliver Devlane notifications to Slack. Users who want
issue activity surfaced in a Slack channel must build their own polling or webhook
tooling. This is a gap relative to comparable tools and relative to Devlane's own
GitHub integration, which is fully productionized.

## Proposed Scope

Deliver Slack notifications following the existing GitHub integration patterns
(handler → service → store layering, workspace-scoped nested URLs with trailing
slashes, instance-settings credential resolution, graceful degradation when optional
infra is absent).

1. **Data model + migration** (`apps/api/internal/model/`, `apps/api/migrations/`):
   - A per-project Slack channel/token model (workspace + project scoped) holding the
     Slack team/workspace id, channel id + name, and the bot/OAuth access token
     (stored in a way consistent with how existing secrets/credentials are handled —
     tokens must never be serialized back to the client, matching the
     `WebhookSecret` / `Credentials` `json:"-"` pattern).
   - Reuse `integrations` / `workspace_integrations` where it fits (register `slack`
     as a provider row; store the install under `workspace_integrations`), mirroring
     GitHub.
   - Add both `NNNNNN_<name>.up.sql` and `.down.sql`; never edit merged migrations.

2. **Slack OAuth + install handler** (`apps/api/internal/oauth/slack.go`,
   `apps/api/internal/slack/`, `apps/api/internal/handler/`):
   - Slack OAuth provider and an install/callback flow that mirrors the GitHub
     install handler, redirecting back to
     `/<slug>/settings?section=integrations` with `?connected=slack` / `?error=...`.
   - App credentials (client id/secret, signing secret) resolved from
     `instance_settings` at request time, not env.

3. **Notification sender** (`apps/api/internal/slack/` + `apps/api/internal/service/`):
   - A Slack client that posts messages to a channel (`chat.postMessage`).
   - Hook into the notification fan-out so relevant events (config-driven per
     project) are delivered to the linked channel. Prefer routing through the
     existing background `queue.Publisher` path (as email notifications do) so a
     Slack outage can't block or roll back the user's action; degrade gracefully if
     RabbitMQ is absent.

4. **Web UI** (`apps/web/src/components/integrations/`,
   `apps/web/src/services/integrationService.ts`, `apps/web/src/api/types.ts`):
   - Add a Slack provider card to `IntegrationsSection` (Connect / Disconnect),
     generalizing the currently GitHub-only lookup.
   - A per-project channel-select UI (list channels the app can post to; link/unlink
     a channel per project), following the linked-repositories panel pattern.
   - New service methods on `integrationService` (install URL, list channels, link /
     unlink channel), calling through `apiClient`.

5. **Instance admin settings**
   (`apps/web/src/pages/instance-admin/`, `instance_settings`):
   - Admin UI + backend key to store Slack app credentials, matching how SMTP/OAuth
     provider creds are configured today.

## Out of Scope (initial)

- Two-way sync (creating Devlane issues from Slack, slash commands, interactive
  message actions).
- Slack DMs / per-user notification routing (channel-level only for v1).
- Threaded conversation mirroring.

## Acceptance Criteria

- An instance admin can enter Slack app credentials in instance settings.
- A workspace admin can connect Slack via OAuth and see it as "Connected" alongside
  GitHub in workspace settings → Integrations.
- A user can select/link a Slack channel per project and unlink it.
- Configured notification events post a correctly formatted message to the linked
  channel.
- Slack access tokens are never returned to the client.
- A Slack API failure (or missing RabbitMQ) never blocks or rolls back the
  originating Devlane action; failures are logged.
- Disconnecting Slack unlinks channels and stops delivery.
- New endpoints follow the layered architecture and workspace-scoped URL/trailing-
  slash conventions; migrations ship with up + down files; `npm run validate` passes.

## Touched Areas (per repo conventions)

`model/` → migration → `store/` → `service/` → `handler/` → register in
`router/router.go` → `oauth/slack.go` + new `slack/` package → web
`services/integrationService.ts` → `components/integrations/` → instance-admin UI +
`instance_settings` key.
