# Devlane Web

React 19 + TypeScript + Vite single-page app for Devlane (Tailwind 4, React
Router 7).

## Prerequisites

- Node.js (see the root `package.json`/CI config for the version used)
- The Devlane API running locally (see `apps/api/README.md`) — or set
  `VITE_API_BASE_URL` to point at a different instance.

## Local setup

1. `npm install`
2. `npm run dev` — starts the Vite dev server on `http://localhost:5173` by
   default. API calls go directly (no dev-server proxy) to
   `http://localhost:8080` unless `VITE_API_BASE_URL` is set (see
   `src/api/client.ts`); the API must allow that origin via `CORS_ORIGIN`.
3. On first run, complete instance setup in the browser (create the admin
   account, then a workspace and project).

## Environment variables

| Variable            | Purpose                     | Default (dev)           |
| ------------------- | --------------------------- | ----------------------- |
| `VITE_API_BASE_URL` | Base URL of the Devlane API | `http://localhost:8080` |

## Commands

```sh
npm run dev            # start the Vite dev server (HMR)
npm run build           # tsc -b && vite build
npm run typecheck       # tsc -b --noEmit
npm run lint            # eslint .
npm run lint:fix        # eslint --fix .
npm run format          # prettier --write .
npm run format:check    # prettier --check .
npm run preview         # serve the production build locally
```

## Conventions

API calls always go through a service in `src/services/`, which uses the
shared `apiClient` in `src/api/client.ts` (`withCredentials: true` for cookie
sessions — don't create new axios instances). Routing is workspace-scoped
(`/:workspaceSlug/...`). See the repo-root `CLAUDE.md` for the full frontend
architecture overview and `CONTRIBUTING.md` for commit/PR conventions.

## V2 design system

The v2 interface (`src/pages/*V2.tsx`, `src/components/shadcn/**`) is built on
shadcn/ui — `new-york` style, slate base color, lucide icons, configured in
`components.json`. The reference sources and the rules for using them are in
the repo-root `AGENTS.md`; read it before adding or restyling v2 UI.
