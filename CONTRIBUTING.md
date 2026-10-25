# Contributing to Devlane

Thanks for your interest in contributing! This guide covers the repo layout, local setup, and the conventions we expect on every change.

## Repository layout

Devlane is a monorepo with two deployable apps under `apps/`:

- **`apps/api/`** — Go backend (Gin + GORM + PostgreSQL).
- **`apps/web/`** — React 19 + TypeScript + Vite single-page app.
- **`docker-compose.yml`** — local infrastructure (Postgres, Redis, RabbitMQ, MinIO).

## Local development

1. **Infra** — `docker compose up -d` (Postgres is published on host port **15432**, not 5432).
2. **API** — from `apps/api`, copy `.env.example` to `.env`, set `DB_PORT=15432` plus your Postgres/Redis (and optional RabbitMQ/MinIO) settings, then `go run ./cmd/api`. Migrations run automatically on startup.
3. **Web** — from `apps/web`, run `npm install` then `npm run dev` (defaults to port 5173).
4. **First run** — either complete instance setup in the browser (create the admin account, then a workspace and project), **or** seed a ready-to-explore instance from `apps/api`:

   ```sh
   go run ./cmd/api seed
   ```

   This creates a demo user (`demo@devlane.test` / `Demo1234!`), a **Demo Workspace**, a **Getting Started** project with the standard workflow states, and a handful of sample work items. It's idempotent — re-running it is a no-op once the demo user exists. Sign in with those credentials at the web app. (Local-only demo credentials; never use them in a real deployment.)

Before pushing, run the full check from the repo root:

```sh
npm run validate   # web typecheck + lint + prettier check, then go vet + go test
```

## Branching & pull requests

- Branch off `main`; **don't commit directly to `main`**.
- Use a descriptive branch name, e.g. `feat/board-drag-and-drop`, `fix/calendar-timezone`.
- Open a PR against `main`. CI (`api-ci`, `ui-ci`) must pass.
- Fill out the PR template. Specialty templates exist — append `?template=feature.md`, `?template=bugfix.md`, or `?template=refactor.md` to the PR URL.
- Link the issue you're resolving with `Closes #123` / `Fixes #123`.
- Keep PRs focused. Open follow-up issues for out-of-scope cleanup rather than expanding the PR.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint via the `commit-msg` Git hook. The header must be ≤ 100 characters.

Common prefixes: `feat(scope):`, `fix(scope):`, `refactor(scope):`, `perf(scope):`, `docs:`, `test:`, `chore:`, `style:`.

Git hooks (Husky) run automatically:

- **pre-commit** — `lint-staged` (ESLint + Prettier on staged web files, `gofmt` on staged Go files); then a typecheck + lint for web changes and `go vet` + `go test` for Go changes.
- **pre-push** — web typecheck + `go test ./...`.

Don't bypass hooks with `--no-verify`. If a hook fails, fix the underlying lint/type/test failure.

## Use of AI assistance

**AI-assisted contributions are welcome — but they must be disclosed.** Tools like Claude Code, GitHub Copilot, Cursor, and similar are allowed for writing code, tests, and docs. Transparency is the only requirement:

1. **In commits** — add a co-author trailer to any commit an AI tool materially helped produce:

   ```
   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```

   (Name whichever tool you used.)

2. **In the pull request** — the PR templates include an **AI assistance** section. Tick it and name the tool(s) used. If no AI was involved, say so.

You remain responsible for everything you submit: understand the change, make sure it meets the acceptance criteria, and verify it with `npm run validate` (and a manual smoke test) before requesting review. AI-generated code held to a lower standard than hand-written code will be sent back.

## Database migrations

- Add paired files: `apps/api/migrations/NNNNNN_<name>.up.sql` **and** `.down.sql`.
- Migrations are applied automatically at startup by `database.RunMigrations`.
- Never edit a migration after it has been merged — add a new one.

## Reporting bugs & requesting features

Use the issue templates under **New issue**. Please **do not** file security vulnerabilities as public issues — disclose them privately via the link in [SECURITY.md](SECURITY.md).
