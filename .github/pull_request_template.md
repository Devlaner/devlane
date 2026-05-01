<!--
  Default PR template. For specialty templates, append `?template=<name>.md`
  to the PR URL — e.g. `?template=feature.md`, `?template=bugfix.md`,
  `?template=refactor.md`.

  Title must follow Conventional Commits (commitlint enforces this on the
  merge commit too): feat(scope): …, fix(api): …, refactor(ui): …, etc.
  Header ≤ 100 chars.
-->

## Summary

<!-- One or two sentences: what this PR changes and why. Skip the play-by-play; the diff already says what. -->

## Linked issues

<!-- Use "Closes #123" / "Fixes #123" so the issue auto-closes on merge. -->
Closes #

## Type of change

<!-- Tick exactly one. -->
- [ ] Feature (`feat:`) — user-visible new capability
- [ ] Bug fix (`fix:`) — corrects broken behavior
- [ ] Refactor (`refactor:`) — no behavior change, internal only
- [ ] Performance (`perf:`) — measurable improvement
- [ ] Documentation (`docs:`) — README / CLAUDE.md / planning docs only
- [ ] Tests (`test:`) — adds or corrects tests
- [ ] Chore (`chore:`) — deps, tooling, CI, formatting
- [ ] Style (`style:`) — visual / theming polish only

## Surface

<!-- Tick all that apply. -->
- [ ] API (`api/`)
- [ ] UI (`ui/`)
- [ ] Database migration (`api/migrations/`)
- [ ] Background jobs (RabbitMQ / queue)
- [ ] Instance settings / Admin UI
- [ ] Infra / Docker / CI

## What changed

<!-- Bulleted list of the meaningful changes. Group by file/module if it helps. -->
-
-

## Why this approach

<!-- Briefly: tradeoffs considered, alternatives ruled out, why this one. -->

## Database / migrations

<!-- Required if you added a migration. Otherwise: "No schema changes". -->
- [ ] Added `api/migrations/NNNNNN_<name>.up.sql` AND matching `.down.sql`
- [ ] Migration is idempotent / safe to re-run on a fresh DB
- [ ] Migration applied cleanly via `database.RunMigrations` on startup

## Breaking changes

- [ ] No
- [ ] Yes — described below

<!-- If yes: which API contract / DB schema / instance setting / env var changed, and what consumers must do. -->

## Test plan

<!-- Specific commands you ran. CI runs the same set; verify locally first. -->
- [ ] `npm run validate` (root) — typecheck + lint + prettier + go vet + go test
- [ ] Manual smoke test of the affected flow:
  -

## Screenshots / recordings (UI changes)

<!-- Drag-and-drop images here. Before / after pairs are ideal. -->

| Before | After |
| ------ | ----- |
|        |       |

## Rollout notes

<!-- Anything reviewers / deployer needs to know:
     - new env var? document default in api/internal/config/config.go and here
     - new instance_settings field? note where it's edited in the admin UI
     - feature flag / gating? say so
     - data backfill required after deploy? say so
     Otherwise: "None". -->

## Checklist

- [ ] PR title follows Conventional Commits and is ≤ 100 chars
- [ ] Hooks ran cleanly (no `--no-verify` bypass)
- [ ] Trailing slashes on new routes match the surrounding pattern
- [ ] New env vars added to `internal/config/config.go` and documented above
- [ ] No secrets, tokens, or `.env` values committed
