# Slack Integration — Implementation Plan

Delivering Devlane notifications to Slack channels. This plan follows the task
spec in [`Taks.md`](./Taks.md) and mirrors two existing, fully-wired patterns in
the codebase:

- **GitHub integration** → the *integration scaffolding* (OAuth, install flow,
  provider package, `integrations` / `workspace_integrations` storage, layered
  `handler → service → store`, workspace-scoped nested routes with trailing
  slashes, instance-settings credential resolution).
- **Email notifications** → the *delivery mechanism* (fan-out in
  `service/notification.go`, background `queue.Publisher` → RabbitMQ →
  `queue.Consumer` with the built-in 3-retry machinery, graceful degradation
  when RabbitMQ is absent).

The result fuses the two: Slack install/config looks like GitHub; Slack message
posting rides the same queue path as email.

---

## 1. Scope (v1)

**In scope**
- Register `slack` as an integration provider and let a workspace connect it via
  Slack OAuth.
- Store the bot token + team info per workspace install; link a **Slack channel
  per project**.
- On notification events (assigned / state changed / commented / mentioned /
  field changed), post a formatted message to the linked channel via
  `chat.postMessage`, routed through the background queue.
- Instance-admin UI to store Slack app credentials in `instance_settings`.
- Web UI: Slack provider card (Connect/Disconnect) + per-project channel
  select/unlink.

**Out of scope (v1)** — matches `Taks.md`
- Per-user DMs / mapping Devlane users ↔ Slack users (channel-level only).
- Two-way sync, slash commands, interactive actions.
- Threaded conversation mirroring.

> Note on behavior: v1 posts to a **shared project channel**, not a DM to the
> assignee. The email/in-app notifications remain the per-user path.

---

## 2. Architecture at a glance

```
Issue mutation (assign / state / comment / field change)
  → IssueService / CommentService
    → NotificationService.Issue*   (service/notification.go)
      → emit()  ── in-app rows (unchanged)
              ├─ enqueueNotificationEmails → queue.PublishSendEmail  (existing)
              └─ enqueueSlackNotifications → queue.PublishSlackPost   (NEW)
                                                   │
                          RabbitMQ "devlane.slack" queue (NEW)
                                                   │
                        queue.Consumer → HandleSlackPost (NEW)
                                                   │
                        slack.PostMessage → chat.postMessage (NEW)
```

Credential/config resolution mirrors GitHub: Slack **app** creds (client id /
secret / signing secret) live in `instance_settings` under a new `slack` key;
the per-workspace **bot token** lives on the `workspace_integrations` row; the
per-project **channel** lives in a new table.

---

## 3. Backend

### 3.1 Data model + migration

**New migration:** `apps/api/migrations/000007_slack_integration.{up,down}.sql`
(next free number after `000006_instance_admins`). Never edit merged migrations;
ship both up and down.

- **Seed the provider row** into `integrations` (mirrors how `github` is
  registered):
  ```sql
  INSERT INTO integrations (title, provider, network, verified)
  VALUES ('Slack', 'slack', 1, true)
  ON CONFLICT (provider) DO NOTHING;
  ```
- **Reuse `workspace_integrations`** for the install. Store on the existing row:
  - `account_login` → Slack team/workspace name
  - `metadata` (jsonb) → `{ "team_id": "T…", "bot_user_id": "U…", "scope": "…" }`
  - `config` (jsonb) → bot access token, encrypted. Follow the
    `WebhookSecret` / `Credentials` `json:"-"` rule so the token is **never**
    serialized to the client.
- **New table `slack_channel_links`** (per project ↔ channel), mirroring
  `github_repository_syncs`:
  ```sql
  CREATE TABLE slack_channel_links (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_integration_id  UUID NOT NULL REFERENCES workspace_integrations (id) ON DELETE CASCADE,
    project_id                UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    workspace_id              UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    channel_id                VARCHAR(64)  NOT NULL,   -- Slack "C…" id
    channel_name              VARCHAR(255) NOT NULL,
    events                    JSONB NOT NULL DEFAULT '{}',  -- per-event enable flags
    actor_id                  UUID NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ,
    created_by_id             UUID,
    updated_by_id             UUID,
    UNIQUE (project_id, deleted_at)   -- one active channel link per project
  );
  ```

**New model file:** `apps/api/internal/model/slack.go`
- `type SlackChannelLink struct { … }` with `TableName() "slack_channel_links"`
  and a `BeforeCreate` UUID hook — copy the shape from
  `model/integration.go`'s `GithubRepositorySync`. Keep the token field
  (if any is duplicated here) `json:"-"`.

### 3.2 Instance settings (Slack app credentials)

**`apps/api/internal/handler/instance.go`**
- Add `slack` to `allowedSettingKeys` (line ~25) and to the section list in
  `GetSettings` (line ~272).
- Add a `defaultSettingValue("slack")` case:
  ```go
  case "slack":
      return model.JSONMap{"client_id": "", "client_secret_set": false, "signing_secret_set": false}
  ```
- Register encrypted fields in `secretKeysBySection` (line ~281):
  ```go
  "slack": {"client_secret", "signing_secret"},
  ```
- Add a merge/encrypt branch in `UpdateSetting` for `key == "slack"` that
  encrypts `client_secret` / `signing_secret` via `crypto.EncryptOrPlain` and
  sets the `*_set` booleans (copy the `github_app` / `email` branch pattern).

### 3.3 Slack OAuth provider

**New file:** `apps/api/internal/oauth/slack.go` — implement the same interface
as `oauth/github.go` (`Name`, `AuthURL`, `Exchange`, `GetUserInfo` where
relevant). For Slack use the **v2** OAuth endpoints:
- Authorize: `https://slack.com/oauth/v2/authorize`
- Token exchange: `https://slack.com/api/oauth.v2.access`
- Bot scopes: `chat:write`, `channels:read`, `groups:read` (and
  `channels:join` if auto-joining public channels).
- The token response returns `access_token` (bot token, `xoxb-…`), `team.id`,
  `team.name`, `bot_user_id`, `scope` — capture these into `TokenData` +
  workspace-integration metadata.

> Slack's OAuth is workspace-install-oriented (not "login as user"), so unlike
> the GitHub *login* provider this is only used for the **install** flow, not
> auth. Keep the provider minimal.

### 3.4 Slack client package

**New package:** `apps/api/internal/slack/` (mirrors `internal/github/`)
- `client.go` — thin HTTP client for the Slack Web API:
  - `PostMessage(ctx, token, channelID, text string, blocks any) error` →
    `POST https://slack.com/api/chat.postMessage`. Slack returns HTTP 200 with a
    JSON `{ "ok": false, "error": "…" }` on logical failures — **must** check
    the `ok` field and return an error so the queue retry logic engages.
  - `ListChannels(ctx, token string, cursor string) ([]Channel, nextCursor, error)`
    → `conversations.list` (for the channel-select UI).
- `verify.go` — `VerifySignature(signingSecret, timestamp, body, header)` using
  Slack's `v0=` HMAC-SHA256 scheme (mirror `github/webhook.go`'s
  `VerifySignature`). Only needed if/when inbound events are added; include the
  stub now for parity but it's optional for v1 (no inbound events in scope).
- `notification.go` — `BuildSlackMessage(sender string, data …) (text, blocks)`
  mirroring `mail/notification.go`'s `BuildNotificationEmail`, producing Slack
  Block Kit blocks (issue ref, title, actor, before/after, link).

### 3.5 Store layer

**New file:** `apps/api/internal/store/slack.go` — `SlackChannelLinkStore`
(pure DB, no service calls):
- `Create`, `GetByProject`, `Update`, `SoftDelete`, `ListByWorkspaceIntegration`.
- Copy the structure of `store/*` github stores.

### 3.6 Service layer

**New file:** `apps/api/internal/service/slack.go` — `SlackService`
(business logic; enforces workspace/project membership like `IntegrationService`
and `GithubSyncService`):
- `InstallSlack(ctx, workspaceSlug, userID, tokenData)` — creates/updates the
  `workspace_integrations` row for provider `slack`, stores encrypted bot token.
- `Uninstall` path — reuse `IntegrationService.Uninstall` (already generic on
  `:provider`), and **cascade**: soft-delete all `slack_channel_links` for the
  workspace so delivery stops (acceptance criterion).
- `ListChannels(ctx, workspaceSlug, userID)` — proxies `slack.ListChannels`
  using the stored bot token.
- `LinkChannel` / `GetChannelForProject` / `UnlinkChannel` — per-project channel
  management.
- `LoadSlackAppCredsFromSettings(ctx, settings)` helper — mirrors
  `service.LoadGitHubAppNameFromSettings` / `LoadGitHubWebhookSecretFromSettings`.
- Define sentinel errors (`ErrSlackNotConfigured`, `ErrSlackNotInstalled`,
  `ErrChannelLinkNotFound`, …) and map them in `writeIntegrationError`.

### 3.7 Notification fan-out hook (the delivery leg)

**`apps/api/internal/queue/queue.go`**
- Add queue + task constants:
  ```go
  QueueSlack     = "devlane.slack"
  TaskSlackPost  = "slack_post"
  ```
- Declare `QueueSlack` in `NewPublisher` (add to the queue slice + `queues` map).
- Add `type SlackPostPayload struct { WorkspaceIntegrationID, ChannelID, Text string; Blocks any; Kind string }`
  and `PublishSlackPost(ctx, payload)` (mirror `PublishSendEmail`).

**`apps/api/internal/queue/consumer.go`**
- Add `HandleSlackPost(log, poster func(ctx, token, channelID, text, blocks) error) TaskHandler`
  mirroring `HandleSendEmail` (decode → resolve token → post → return err so the
  existing `maxRetries = 3` republish logic applies).

**`apps/api/internal/service/notification.go`**
- Add `s.slackQueue`/config wiring + `SetSlack…` setters next to the email ones.
- In `emit()` (after `enqueueNotificationEmails`, ~line 332), add:
  ```go
  if s.slackEnabled() {
      s.enqueueSlackNotifications(ctx, allowed, params, actorName, issueRef)
  }
  ```
  Gate it exactly like email (`queue != nil && appURL != ""`) so a Slack outage
  or missing RabbitMQ never blocks the user's action.
- Implement `enqueueSlackNotifications`: resolve the issue's **project →
  channel link**; if the project has a linked channel and the event type is
  enabled in `events`, build the message and `PublishSlackPost`. Note this is
  **channel-scoped** (one post per project channel), not per-receiver — so it
  runs once per issue event, not once per receiver like email.

> Because delivery is channel-based, the natural trigger key is the issue's
> project, not the receiver set. Consider posting whenever the event fires and a
> channel is linked (independent of who the in-app receivers are), which better
> matches "team channel" semantics. Confirm this product choice before building.

### 3.8 Wiring & routes

**`apps/api/cmd/api/main.go`**
- Build the Slack poster (`slack.NewClient`) and register the consumer handler:
  ```go
  consumer.Register(queue.QueueSlack, queue.HandleSlackPost(log, slackPoster))
  consumer.Run(ctx, []string{queue.QueueEmails, queue.QueueWebhooks, queue.QueueSlack})
  ```

**`apps/api/internal/router/router.go`**
- Construct `slackSvc := service.NewSlackService(...)`, add it to
  `IntegrationHandler` (extend the struct), wire the queue into
  `notificationSvc` (a `SetSlackQueue` alongside `SetQueue`).
- Add a hot-reload hook for the `slack` settings key (mirror the `github_app`
  reload at router.go ~line 219).
- Register routes (mirror the GitHub block, trailing slashes intentional):
  ```
  GET    /auth/slack/install?workspace=:slug                                  (RequireAuth) → SlackInstallStart
  GET    /auth/slack/callback                                                 (RequireAuth) → SlackInstallCallback
  GET    /api/workspaces/:slug/integrations/slack/channels/                                 → SlackListChannels
  GET    /api/workspaces/:slug/projects/:projectId/integrations/slack/channel/              → SlackGetChannel
  POST   /api/workspaces/:slug/projects/:projectId/integrations/slack/channel/              → SlackLinkChannel
  PATCH  /api/workspaces/:slug/projects/:projectId/integrations/slack/channel/              → SlackUpdateChannel  (event toggles)
  DELETE /api/workspaces/:slug/projects/:projectId/integrations/slack/channel/              → SlackUnlinkChannel
  ```
  Uninstall reuses the existing generic
  `DELETE /api/workspaces/:slug/integrations/:provider/`.

**`apps/api/internal/handler/integration.go`** (or a new `integration_slack.go`)
- Add `SlackInstallStart` / `SlackInstallCallback` mirroring
  `GitHubInstallStart` / `GitHubInstallCallback`: carry workspace slug in a
  state cookie, redirect back to
  `/<slug>/settings?section=integrations` with `?connected=slack` / `?error=…`
  (reuse the `redirectIntegration` helper, generalizing the hardcoded
  `connected=github`).

---

## 4. Frontend (`apps/web`)

### 4.1 Service + types
- **`src/services/integrationService.ts`** — add:
  - `slackInstallUrl(workspaceSlug)` (top-level navigation, like
    `githubInstallUrl`).
  - `slackListChannels(workspaceSlug)`
  - `slackGetProjectChannel` / `slackLinkProjectChannel` /
    `slackUpdateProjectChannel` / `slackUnlinkProjectChannel`
    (404 → null pattern, as `githubGetProjectSync` does).
- **`src/api/types.ts`** — add `SlackChannel`, `SlackChannelLinkResponse`, and
  extend the integration provider union to include `slack`.

### 4.2 Integrations UI
- **`src/components/integrations/IntegrationsSection.tsx`** — currently
  hardcoded to `installed.find((wi) => wi.provider === 'github')`. Generalize to
  render a list/registry of providers and add a **Slack card** (Connect /
  Disconnect + "Connected as <team>").
- **New `src/components/integrations/SlackChannelSettingsModal.tsx`** — per
  project: list channels the bot can post to, link/unlink, and event toggles.
  Model it on `RepoSyncSettingsModal.tsx`.

### 4.3 Instance admin
- **New `src/pages/instance-admin/InstanceAdminIntegrationSlackPage.tsx`** —
  form for Slack app `client_id`, `client_secret`, `signing_secret` (write-only
  secret pattern with `*_set` masks, exactly like `InstanceAdminEmailPage` /
  the GitHub App page).
- Register it in `src/pages/instance-admin/index.ts` and add the lazy route +
  nav entry in `src/routes/index.tsx` (mirror
  `InstanceAdminIntegrationGitHubPage`, route
  `instance-admin/integrations/slack`).

---

## 5. Testing & validation

- **Go unit tests** (`go test ./...`): `slack` signature verify (if included),
  `BuildSlackMessage`, service membership enforcement, channel link CRUD. Mirror
  `github/refparse_test.go` and `service` test patterns.
- **Queue retry**: reuse existing `consumer` behavior; add a test asserting a
  failing `chat.postMessage` republishes with incremented `x-retry-count` and
  discards after 3.
- **Local manual test**: connect Slack in a dev workspace, link a channel, then
  assign/comment on an issue and confirm the message posts. (For a fully offline
  loop, a stub Slack endpoint can stand in for `chat.postMessage`, analogous to
  the Mailpit setup used for email.)
- **`npm run validate`** must pass (web typecheck + lint + prettier + go vet +
  go test).
- Conventional Commits; branch + PR (don't commit to `main`); disclose AI
  assistance per `CONTRIBUTING.md`.

---

## 6. Acceptance criteria (from `Taks.md`) → where satisfied

| Criterion | Satisfied by |
| --- | --- |
| Admin enters Slack app creds in instance settings | §3.2 + §4.3 |
| Workspace admin connects Slack via OAuth, sees "Connected" | §3.3 + §3.8 + §4.2 |
| Link/unlink a Slack channel per project | §3.5–3.6 + §4.2 |
| Configured events post a formatted message to the channel | §3.4 + §3.7 |
| Slack tokens never returned to client | §3.1 (`json:"-"` on token fields) |
| Slack/RabbitMQ failure never blocks the originating action | §3.7 (queue path + gating + graceful degrade) |
| Disconnecting Slack unlinks channels & stops delivery | §3.6 (cascade soft-delete) |
| Layered arch, workspace-scoped URLs w/ trailing slashes, up+down migrations, `npm run validate` | §3.8 + §3.1 + §5 |

---

## 7. Suggested delivery order (PR-sized steps)

1. **Migration + model + store** (`000007`, `model/slack.go`, `store/slack.go`) — no behavior yet.
2. **Instance settings `slack` key** (backend + admin UI) — creds can be saved.
3. **OAuth provider + install/callback handler + routes** — Connect/Disconnect works end-to-end; token stored.
4. **Channel list + per-project link/unlink** (service + routes + web modal).
5. **Queue task + consumer + `slack.PostMessage` + notification hook** — messages actually post.
6. **Polish**: event toggles, error states, tests, `npm run validate`.

Each step is independently reviewable and leaves the app in a working state.

---

## 8. Open questions to confirm before building

1. **Trigger semantics**: post to the channel on every configured event
   regardless of in-app receivers (team-channel model), or only when there's at
   least one in-app receiver? (§3.7)
2. **Which events** are channel-worthy by default (all five, or a subset like
   created/state-changed)? Drives the `events` jsonb defaults.
3. **Public vs private channels**: require the bot to be invited, or attempt
   `channels.join` for public channels automatically? (affects OAuth scopes)
4. **Message format**: plain text vs Block Kit richness for v1.
