# PRD — Slack Integration for Channel Notifications

| Field | Value |
| --- | --- |
| **Product** | Devlane |
| **Feature** | Slack Integration (channel notifications) |
| **Type** | Feature |
| **Priority** | Medium |
| **Area** | Integrations (API + Web) |
| **Status** | Draft |
| **Author** | — |
| **Related docs** | [`Taks.md`](./Taks.md) (task spec), [`SLACK_INTEGRATION_PLAN.md`](./SLACK_INTEGRATION_PLAN.md) (implementation plan) |

---

## 1. Overview

Devlane's issue activity (assignments, state changes, comments, mentions, field
changes) currently flows only to **in-app notifications** and **email**. Teams
coordinate in Slack, but there is no supported way to surface that activity in a
Slack channel. This feature lets a workspace connect Slack and post configured
issue events to a **project-linked channel**, so a team sees relevant updates
where they already work.

The integration reuses Devlane's existing patterns: the **GitHub integration**
for connect/config scaffolding, and the **email notification pipeline** (async
queue with retries) for delivery.

---

## 2. Problem statement

- Activity that matters to a team (e.g. "issue moved to In Review", "someone
  commented") is invisible in Slack, where the team actually coordinates.
- Users who want this today must build their own polling or webhook tooling.
- This is a gap relative to comparable tools and relative to Devlane's own
  GitHub integration, which is fully productionized while Slack "exists in name
  only" (a doc comment referencing `slack` with no model, OAuth, package, or UI).

---

## 3. Goals & non-goals

### Goals
- G1. A workspace admin can connect Slack to a workspace via OAuth in a few
  clicks and see it as "Connected".
- G2. A project member can link one Slack channel per project and choose which
  event types post there.
- G3. Configured issue events post a correctly formatted message to the linked
  channel, reliably and without blocking the user's action.
- G4. Credentials and tokens are handled securely and never exposed to clients.
- G5. Disconnecting Slack cleanly stops all delivery.

### Non-goals (v1)
- N1. Per-user DMs / mapping Devlane users to Slack users (channel-level only).
- N2. Two-way sync — creating Devlane issues from Slack, slash commands,
  interactive message actions.
- N3. Threaded conversation mirroring.
- N4. Multiple channels per project or cross-project routing rules.

---

## 4. Users & personas

| Persona | Needs | Involvement |
| --- | --- | --- |
| **Instance admin** | Configure the Slack app credentials once for the whole instance | Stage 1 (setup) |
| **Workspace admin** | Connect/disconnect Slack for their workspace | Stage 2 (connect) |
| **Project member / lead** | Link a channel to a project and choose events | Stage 3 (config) |
| **Team member** | Passively receives issue updates in the shared channel | Stage 4 (consumption) |

---

## 5. User stories

- As an **instance admin**, I can enter Slack app credentials (client id, client
  secret, signing secret) in instance settings so workspaces can connect.
- As a **workspace admin**, I can click "Connect" on a Slack card, approve access
  in Slack, and return to see "Connected as <team>".
- As a **project lead**, I can pick a Slack channel for my project from a list of
  channels the bot can post to, and toggle which event types are delivered.
- As a **project lead**, I can unlink a channel to stop posting for that project.
- As a **team member**, I see messages like "Priya moved ALP-42 from Todo to In
  Progress" in our project channel, with a link back to the issue.
- As a **workspace admin**, I can disconnect Slack and be confident all delivery
  stops immediately.

---

## 6. Functional requirements

### 6.1 Instance configuration
- FR-1. Instance admin UI provides fields for Slack `client_id`,
  `client_secret`, `signing_secret`.
- FR-2. Secrets are stored encrypted in `instance_settings` (key `slack`) and
  are write-only from the UI (masked, `*_set` indicators), consistent with SMTP
  and GitHub App credential handling.
- FR-3. Saving new credentials takes effect without an API restart.

### 6.2 Workspace connect (OAuth)
- FR-4. A "Connect" action starts a Slack OAuth v2 install (full-page redirect).
- FR-5. The callback verifies state (CSRF), exchanges the code for a bot token,
  and stores the token + team metadata against the workspace.
- FR-6. On success the user returns to
  `/<workspace>/settings?section=integrations` with a success indicator; on
  failure, with an error message.
- FR-7. The Integrations page shows Slack as "Connected as <team>" with a
  Disconnect action, alongside the existing GitHub card.

### 6.3 Project channel linking
- FR-8. Users can list channels the bot can post to (via Slack
  `conversations.list`).
- FR-9. Users can link exactly one channel per project.
- FR-10. Users can configure which event types (assigned, state changed,
  commented, mentioned, field changed) post to the channel.
- FR-11. Users can unlink the channel for a project.

### 6.4 Notification delivery
- FR-12. When a configured issue event occurs and the project has a linked
  channel with that event enabled, Devlane posts a formatted message to the
  channel.
- FR-13. Delivery is asynchronous (background queue) and must never block or roll
  back the originating user action.
- FR-14. Failed posts retry automatically up to 3 times, then are dropped and
  logged (reusing the existing queue retry mechanism).
- FR-15. Messages include: actor, issue reference + title, the change
  (e.g. before → after for state), and a link back to the issue.
- FR-16. Delivery is channel-scoped: one message per issue event per linked
  channel (not one per recipient).

### 6.5 Disconnect / teardown
- FR-17. Disconnecting Slack removes the workspace install and unlinks all
  channels for that workspace; no further messages are sent.

---

## 7. Experience flow (summary)

1. **Setup (instance admin, one-time):** enter Slack app creds → stored
   encrypted.
2. **Connect (workspace admin):** Connect → Slack consent → callback stores bot
   token → "Connected".
3. **Configure (project lead):** pick channel + event toggles per project.
4. **Runtime (automatic):** issue event → notification fan-out → queue → Slack
   `chat.postMessage` → message appears in channel.
5. **Disconnect:** removes install + channel links → delivery stops.

_Full technical sequence for each stage is in [`SLACK_INTEGRATION_PLAN.md`](./SLACK_INTEGRATION_PLAN.md)._

---

## 8. Non-functional requirements

- **Security:** Bot tokens and app secrets never serialized to clients
  (`json:"-"`); secrets encrypted at rest; OAuth state verified to prevent CSRF.
- **Reliability:** Slack or RabbitMQ outages degrade gracefully — the user's
  action always succeeds; delivery retries and fails silently (logged).
- **Consistency:** Follows the layered architecture (handler → service → store),
  workspace-scoped nested URLs with trailing slashes, and instance-settings
  credential resolution used elsewhere.
- **Performance:** Posting is off the request hot path (queued), so it adds no
  latency to issue edits.
- **Observability:** Send attempts, successes, and failures are logged (mirroring
  the mail path's `LogSendAttempt` / `LogSent` / `LogFailed`).

---

## 9. Success metrics

- **Adoption:** # of workspaces that connect Slack; # of projects with a linked
  channel.
- **Delivery health:** Slack post success rate (target > 99% excluding invalid
  channels); retry/drop counts stay low.
- **Engagement (proxy):** click-throughs from Slack messages back into Devlane
  issues.
- **Reliability guardrail:** zero incidents of a Slack/queue failure blocking or
  rolling back an issue action.

---

## 10. Dependencies & assumptions

- A registered **Slack app** (created in the Slack dashboard) providing
  `client_id`, `client_secret`, `signing_secret`, and declared bot scopes
  (`chat:write`, `channels:read`, `groups:read`, optionally `channels:join`).
- A **publicly reachable API URL** for Slack's OAuth redirect
  (`/auth/slack/callback`) — requires a tunnel (e.g. ngrok) for local dev.
- **RabbitMQ** for the async delivery path (optional infra; feature degrades
  gracefully without it — no delivery, but no errors).
- Existing notification fan-out in `service/notification.go` as the trigger
  point.

---

## 11. Risks & mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Slack API logical failures return HTTP 200 with `ok:false` | Silent non-delivery | Client checks `ok`; return error so retries engage |
| Bot not in target channel / private channel | Post fails | Surface clear error in channel-select UI; optionally `conversations.join` for public channels |
| OAuth redirect can't reach localhost | Blocks local testing | Document tunnel requirement; provide setup steps |
| Token leakage | Security incident | `json:"-"` on token fields; encrypted at rest; never in API responses |
| Message spam in busy projects | Channel noise | Per-event toggles; channel-scoped (not per-user); consider future rate limiting |

---

## 12. Milestones (delivery order)

1. **M1 — Foundation:** migration `000007`, model, store (no behavior).
2. **M2 — Credentials:** instance-settings `slack` key + admin UI.
3. **M3 — Connect:** OAuth provider, install/callback, routes, Connect/Disconnect UI.
4. **M4 — Channels:** list/link/unlink channel per project + event toggles UI.
5. **M5 — Delivery:** queue task, consumer, Slack client, notification hook.
6. **M6 — Hardening:** tests, error states, `npm run validate`, docs.

Each milestone leaves the app in a working, reviewable state (one PR each).

---

## 13. Acceptance criteria

- [ ] Instance admin can enter and save Slack app credentials (secrets masked).
- [ ] Workspace admin can connect Slack via OAuth and see "Connected as <team>".
- [ ] A user can link and unlink a Slack channel per project.
- [ ] Configured events post a correctly formatted message to the linked channel.
- [ ] Slack access tokens are never returned to the client.
- [ ] A Slack API failure or missing RabbitMQ never blocks or rolls back the
      originating Devlane action; failures are logged.
- [ ] Disconnecting Slack unlinks channels and stops delivery.
- [ ] New endpoints follow layered architecture + workspace-scoped URL/trailing-
      slash conventions; migrations ship with up + down files; `npm run validate`
      passes.

---

## 14. Open questions

1. **Trigger semantics** — post on every configured event when a channel is
   linked (team-channel model), or only when there's at least one in-app
   receiver?
2. **Default events** — which event types are enabled by default per project?
3. **Public vs private channels** — require inviting the bot, or auto-join public
   channels via `channels.join`?
4. **Message richness** — plain text vs Block Kit formatting for v1.
5. **Multiple channels per project** — confirmed out of scope for v1; revisit
   later?
