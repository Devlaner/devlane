# Autonomous agent workflows

Tracked by [GitHub issue #285](https://github.com/Devlaner/devlane/issues/285).

## Purpose

Devlane already has the building blocks for agent-assisted product work:

- work items with assignees, labels, comments, activity, relations, cycles, and modules
- instance-level AI settings under the `ai` section
- GitHub App installation, repository sync, PR-to-work-item links, webhook logging, and PR-driven state updates
- RabbitMQ-backed queues for asynchronous work

This document proposes the product and technical shape for making agents first-class actors that can receive work, run bounded tasks, and report results back into Devlane with a durable audit trail.

## Implementation checkpoint

The initial Phase 1 slice now adds the core persistence, REST surface, and supervised UI:

- workspace/project agent roster records with explicit tool permissions
- a workspace settings roster for creating, editing, enabling, and scoping agents
- manual work item agent assignments that do not replace human assignees
- an issue sidebar for assigning agents, providing run instructions, and viewing run status
- queued agent run records with durable input/output/error fields
- issue activity events for agent assignment and queued runs

This intentionally stops before autonomous execution. Later phases can attach the queue consumer, model execution, approval UI, and GitHub branch/PR tooling to these records and controls.

## Goals

- Let workspace admins create reusable agents such as Bug Triage, Spec Breaker, PR Reviewer, Test Fixer, Docs Writer, Release Notes, and Coding Agent.
- Let users assign a work item to an agent without replacing human ownership.
- Let routing rules assign or recommend agents based on issue type, labels, priority, project, stale state, or GitHub activity.
- Keep every agent action visible from the work item activity feed.
- Use explicit tool permissions so agents can start read-only and graduate to supervised writes.
- Reuse the existing GitHub App integration for repository-aware coding and PR workflows.

## Non-goals

- Do not let agents make unrestricted workspace, repository, or production changes.
- Do not hide AI-generated work from users.
- Do not require a separate worker service for the first supervised release.
- Do not block the initial release on full autonomous code changes.

## Product model

### Agent

An agent is a configurable workspace or project resource.

Suggested fields:

- `id`
- `workspace_id`
- `project_id` nullable for workspace-wide agents
- `name`
- `description`
- `avatar`
- `instructions`
- `model`
- `enabled`
- `autonomy_level`
- `created_by_id`
- `updated_by_id`

Suggested autonomy levels:

- `suggest`: draft a recommendation only
- `comment`: post a visible comment after user confirmation or rule approval
- `modify_issue`: update issue fields such as labels, estimate, state, or child tasks
- `github_draft`: create branches and draft PRs only
- `github_reviewed`: update PR branches after explicit human approval

### Agent tool permission

Tool permissions keep the system auditable and safe.

Suggested fields:

- `agent_id`
- `tool`
- `scope`
- `config`

Initial tools:

- `issue.read`
- `issue.comment`
- `issue.update`
- `issue.create_child`
- `project.read`
- `github.read`
- `github.comment`
- `github.draft_pr`

### Agent assignment

An agent assignment records that a work item has been delegated to an agent.

Suggested fields:

- `issue_id`
- `agent_id`
- `assigned_by_id`
- `reason`
- `status`

Agent assignments should coexist with human assignees. Human ownership remains the source of accountability.

### Agent run

An agent run is one execution attempt.

Suggested fields:

- `id`
- `agent_id`
- `issue_id`
- `trigger`
- `status`
- `input`
- `output`
- `error`
- `queued_at`
- `started_at`
- `completed_at`
- `cancelled_at`
- `created_by_id`

Suggested statuses:

- `queued`
- `running`
- `needs_review`
- `completed`
- `failed`
- `cancelled`

### Routing rule

Routing rules let admins map work to agents.

Suggested fields:

- `workspace_id`
- `project_id`
- `agent_id`
- `enabled`
- `conditions`
- `action`

Example rules:

- Assign Bug Triage when a new work item has the `bug` type.
- Ask Spec Breaker to draft child tasks when an epic enters Backlog.
- Ask PR Reviewer to summarize GitHub activity when a linked PR changes.
- Ask Test Fixer to investigate when a linked PR comment includes a failed check summary.

## Runtime

Add a dedicated queue and task type:

- Queue: `devlane.agents`
- Task type: `agent_run`
- Payload: `agent_run_id`

The API should create an `agent_runs` row before publishing the task. The consumer loads the run, resolves the agent permissions, gathers issue/project/GitHub context, executes the allowed action, and persists output before posting any visible activity.

The first implementation can run in the existing API process alongside the current email and webhook consumers. A separate worker binary can be introduced later if run duration or isolation requires it.

## Issue activity

Agent activity should be visible where users already work.

Recommended activity events:

- agent assigned
- agent run queued
- agent run started
- agent proposed changes
- agent posted comment
- agent opened draft PR
- agent run failed
- agent run cancelled

Agent-generated comments should identify the agent, the trigger, and whether the output was AI generated.

## GitHub integration path

Current GitHub support can already:

- install a GitHub App at workspace level
- list installation repositories
- link a repository to a project
- link PRs to Devlane work items
- process PR, push, and PR comment webhooks
- update issue activity and state from PR events

Coding agents need additional GitHub client methods:

- get repository default branch
- create refs for agent branches
- read file contents or repository trees
- create blobs, trees, and commits
- update refs
- open draft pull requests
- comment on PRs with agent run links

Branch naming should include the Devlane issue reference:

```text
devlane/agent/DEV-123-short-title
```

Commit messages should include the issue reference and AI disclosure where required by the contribution policy.

## UX entry points

Suggested first surfaces:

- Workspace settings: Agent roster
- Project settings: Project-specific agent availability
- Work item detail: Assign to agent action
- Work item detail: Agent runs panel
- Command palette: Run agent on current work item
- GitHub PR sidebar: Agent-authored draft PR status

## Phased delivery

### Phase 1: supervised issue agents

- Add agent roster persistence and settings UI.
- Add manual assign-to-agent action.
- Add `agent_runs`.
- Add queue task and consumer.
- Support read-only summaries, suggested labels, child task drafts, and comments.

### Phase 2: routing and review

- Add routing rules.
- Add approval UI for proposed updates.
- Add issue activity events for agent lifecycle.
- Add run cancellation and retry.

### Phase 3: GitHub-aware agents

- Add GitHub read context to runs.
- Summarize linked PRs and push activity.
- Draft review comments or implementation plans.
- Post comments to GitHub when permitted.

### Phase 4: coding agents

- Add GitHub branch, commit, and draft PR creation.
- Require repository sync and explicit `github.draft_pr` permission.
- Keep PRs draft by default.
- Require human review before merge or follow-up branch updates.

## Safety guardrails

- Agents must never receive implicit write access.
- Every tool permission must be explicit and scoped.
- Agent outputs must be stored before side effects are applied.
- Mutating runs should be idempotent so queue retries do not duplicate comments, child tasks, or PRs.
- Long-running jobs need cancellation.
- Users should see which model and agent produced visible output.
- Repository writes should default to draft PRs, not direct default-branch commits.
- Instance admins should be able to disable all agent execution.

## Testing strategy

- Unit tests for routing rule matching.
- Unit tests for permission checks before every tool call.
- Handler tests for creating, assigning, listing, cancelling, and retrying runs.
- Queue tests for idempotent run processing.
- GitHub client tests against fake API responses for branch and PR creation.
- UI tests for agent roster, assign-to-agent, and run status rendering.

## Open questions

- Should agents be represented as users, a separate model, or both?
- Should project admins or only workspace admins create agents?
- Should agent runs count toward notification preferences?
- How should agent-generated child tasks be reviewed before creation?
- Which model defaults should be allowed at instance level?
- Should coding agents use GitHub REST-only changes or an isolated execution sandbox in a later phase?
