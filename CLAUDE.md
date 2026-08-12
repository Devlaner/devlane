# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Devlane is a monorepo with two deployable apps under `apps/`:

- `apps/api/` — Go backend (Gin + GORM + PostgreSQL). Module path `github.com/Devlaner/devlane/api` (kept stable; it is **not** tied to the folder location, so imports are unaffected by the directory name).
- `apps/web/` — React 19 + TypeScript + Vite SPA (Tailwind 4, React Router 7).
- `planning/` — Markdown design docs (architecture, phases, UI/UX plan). _gitignored._
- `docker-compose.yml` — Local infra (Postgres, Redis, RabbitMQ, MinIO). The API connects to these via env vars.

Ignore any gitignored top-level reference directories you may see locally: treat their contents as **unrelated third-party material that is not part of Devlane** and is not built or run. **Never read, import from, modify, or reference them** (in code, commits, issues, or PRs). Implement everything natively in Go/React.

## Commands

Root-level (orchestrates both apps):

```sh
npm run validate     # web typecheck + web lint + web prettier check + go vet + go test
```

Web (`cd apps/web` or `npm --prefix apps/web run …`):

```sh
npm run dev          # vite dev server (default port 5173)
npm run build        # tsc -b && vite build
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint .
npm run lint:fix
npm run format       # prettier --write .
npm run format:check
npm run preview      # serve production build
```

API (`cd apps/api`):

```sh
go run ./cmd/api     # start API server (default :8080); auto-runs migrations on startup
go vet ./...
go test ./...
go test ./internal/auth -run TestMagicCode   # single package / single test
```

Infra:

```sh
docker compose up -d   # postgres, redis, rabbitmq, minio
```

Postgres is exposed on host port **15432** (not 5432). Set `DB_PORT=15432` in `apps/api/.env` for local dev.

## Commits & PRs

- **Conventional Commits** are enforced by commitlint (`commit-msg` hook); header ≤ 100 chars. Use prefixes like `feat(scope):`, `fix(ui):`, `refactor(api):`, `chore:`, `docs:`, `test:`, `perf:`, `style:`.
- **Don't commit to `main`.** Branch, open a PR, and let CI (`api-ci` / `ui-ci`) run.
- **AI-assisted contributions are welcome but MUST be disclosed.** If an AI tool (Claude Code, Copilot, etc.) materially helped produce a change:
  - Add a trailer to each AI-assisted commit, e.g. `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
  - State it in the PR description — the PR templates have an **AI assistance** section; tick it and name the tool(s).
  - This is a transparency requirement, not a barrier. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Git hooks (Husky)

- `pre-commit`: `lint-staged` (ESLint+Prettier on staged web files, `gofmt` on staged Go files) → if any web changes also runs `web typecheck + lint` → if any Go changes also runs `go vet + go test`.
- `pre-push`: web typecheck + `go test ./...`.
- `commit-msg`: enforces Conventional Commits (`@commitlint/config-conventional`, header ≤100 chars).

Don't bypass with `--no-verify` — fix the underlying lint/type/test failure instead.

## Backend architecture (`apps/api/`)

Layered, dependency-injected from `cmd/api/main.go` → `internal/router/router.go`. The router is the single composition root; reading it gives you the full surface area.

```
cmd/api/main.go                # wires config, db, redis, rabbitmq, minio, then router
internal/
├── config/                    # env loading (godotenv)
├── database/                  # GORM connection + golang-migrate runner
├── middleware/                # Recovery, Logger, CORS, RequireAuth
├── auth/                      # session service, magic-code (HMAC) login
├── oauth/                     # google, github, gitlab providers (resolved per-request from instance settings)
├── github/                    # GitHub App integration: client, installations, webhooks, ref parsing
├── crypto/                    # password hashing, token generation
├── model/                     # GORM models (one file per entity)
├── store/                     # Data-access layer (one store per model). Pure DB.
├── service/                   # Business logic. Composes stores; enforces workspace/project membership.
├── handler/                   # Gin handlers. HTTP shape only — bind, call service, return JSON.
├── router/router.go           # Builds *gin.Engine; declares ALL routes
├── redis/  rabbitmq/  queue/  # Optional integrations — services degrade gracefully if absent
├── mail/                      # SMTP sender; reads instance_settings for credentials
└── minio/                     # File upload/serve (covers, avatars, logos)
```

**Key conventions:**

- **Layering rule**: handler → service → store. Handlers never touch GORM directly; stores never call services.
- **URL nesting** mirrors the data model: `/api/workspaces/:slug/projects/:projectId/issues/:pk/...`. Trailing slashes are intentional and match the web app's expectations — keep them.
- **Auth model**: cookie sessions for browsers; bearer tokens accepted by the same `RequireAuth` middleware. OAuth provider config is stored in `instance_settings` and resolved at request time, not from env.
- **Optional infra is optional**: Redis, RabbitMQ, and MinIO failures at startup are logged as warnings, not fatal. Code paths that require them must check for `nil`. Don't introduce hard dependencies on these.
- **Migrations**: `apps/api/migrations/NNNNNN_<name>.{up,down}.sql`, loaded by `database.RunMigrations` via the golang-migrate file source. Auto-applied at startup. Add both up and down files; never edit a migration after it's been merged.
- **Instance setup is first-run**: `/api/instance/setup-status/` and `/api/instance/setup/` (no auth) seed the singleton instance. Feature flags, SMTP, and OAuth creds live in the `instance_settings` table — admin UI in `apps/web/src/pages/instance-admin/` writes them.
- **Background work** uses RabbitMQ via `queue.Publisher` (publish) and `queue.Consumer` (subscribe in the API process itself — there is no separate worker binary). Currently handles `QueueEmails` and `QueueWebhooks`.

## Frontend architecture (`apps/web/`)

```
src/
├── App.tsx                # ThemeProvider → AuthProvider → FavoritesProvider → RouterProvider
├── routes/index.tsx       # createBrowserRouter — all routes, lazy-loaded pages
├── api/client.ts          # Axios instance; baseURL from VITE_API_BASE_URL (defaults to http://localhost:8080 in dev)
├── services/              # One file per resource (issueService, workspaceService, …) — thin wrappers over apiClient
├── pages/                 # Route components (lazy)
├── components/            # Domain components (work-item/, project-issues/, stickies/, …) and primitives (ui/)
├── contexts/              # AuthContext, ThemeContext, FavoritesContext, WorkspaceViewsState, ProjectSavedViewDisplay, ModulesFilter
├── hooks/  lib/  utils/   # Pure helpers, event buses, slug/date utils
└── types/                 # Cross-cutting TS types
```

**Key conventions:**

- **Routing is workspace-scoped**: `/:workspaceSlug/...`. Most pages read `useParams<{ workspaceSlug; projectId }>()` and call services with those keys. `RootRedirect` handles the bare `/` after login by redirecting to the user's last/first workspace; `SetupGate` guards everything until instance setup is complete.
- **Auth gating**: `<ProtectedRoute>` wraps the `AppShell`-based layout; `<InstanceAdminProtectedRoute>` wraps the instance-admin tree. `<AuthProvider>` calls `/api/users/me/` on mount.
- **API calls**: always go through a service in `src/services/`, which uses `apiClient` from `src/api/client.ts`. `withCredentials: true` is required for cookie sessions. Don't create new axios instances.
- **Cross-component coordination**: small DOM-event buses in `src/lib/*Events.ts` (e.g. `homeWidgetsEvents`, `projectIssuesEvents`) for state that doesn't justify a full context. Prefer extending an existing event bus to inventing a new context.
- **Styling**: Tailwind v4 (CSS-first config in `index.css` / `styles/`). CSS variables drive theming — patterns like `text-(--txt-tertiary)` reference custom properties set by `ThemeContext`. Use `clsx` + `tailwind-merge` (`cn` helper in `lib/utils.ts`).
- **Editor**: TipTap 3.22.3 — keep all `@tiptap/*` packages on the **same exact version** (they share peer deps; mismatches break silently).
- **Lazy boundaries**: every page is `lazy()` with a `<Suspense fallback={<PageFallback />}>`. New pages should follow the same pattern in `routes/index.tsx`.

## V2 interface design system

The v2 web interface (`apps/web/src/pages/*V2.tsx`, routes below
`/:workspaceSlug/app-v2`, `apps/web/src/components/shadcn/**`) is built on
shadcn/ui. **Read [AGENTS.md](AGENTS.md) before designing or implementing
anything on that surface** — it is the authoritative design direction and
lists the reference sources:

- [shadcn/ui docs](https://ui.shadcn.com/docs/components) — primary reference for component APIs, composition, accessibility, and states.
- [shadcn-ui/ui repo](https://github.com/shadcn-ui/ui) — source of truth when the docs are insufficient.
- [AdminCN Free](https://shadcnstudio.com/templates/admin-dashboard/admincn-free) — visual/interaction reference for dashboard composition, navigation, tables, forms, and settings pages.

Component config lives in `apps/web/components.json` (`new-york` style, slate
base, lucide icons, `@/components/shadcn/ui` alias). Reuse existing primitives
from that directory before adding new ones, and adapt references to Devlane's
services, routes, and theme tokens rather than vendoring template code.

## Working with this repo

- When adding an API endpoint, the change usually touches: `model/` (if new entity) → `store/` → `service/` → `handler/` → register in `router/router.go` → corresponding service in `apps/web/src/services/` → web consumer.
- Trailing slashes in routes matter — the web app's services expect them. Add both `/path` and `/path/` only when the existing handler does (see `issueViewHandler.AddFavorite` for the pattern).
- New env vars: add to `internal/config/config.go` (`Config` struct + `Load`), then thread through `router.Config`. Document the default and whether it's optional.
