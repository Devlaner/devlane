# Devlane API

Go backend for Devlane (Gin + GORM + PostgreSQL). Module path
`github.com/Devlaner/devlane/api`.

## Prerequisites

- Go 1.26+ (see `go.mod` for the exact version)
- Local infra from the repo root: `docker compose up -d` (Postgres, Redis,
  RabbitMQ, MinIO)

## Local setup

1. From the repo root, start infra: `docker compose up -d`. Postgres is
   published on host port **15432**, not the default 5432.
2. Copy `.env.example` to `.env` in this directory and set at least
   `DB_PORT=15432`, plus your Postgres/Redis credentials if you changed the
   defaults in `docker-compose.yml`.
3. Run the API: `go run ./cmd/api`. Migrations under `migrations/` are applied
   automatically on startup — no separate migration command needed.
4. The API listens on `:8080` by default.

Redis, RabbitMQ, and MinIO are optional: if any of them fail to connect at
startup, the API logs a warning and continues — features that depend on them
(caching, magic-link login, background email/webhook delivery, file uploads)
degrade gracefully rather than crashing the process.

## Environment variables

See `internal/config/config.go` for the full list and defaults. The most
commonly changed ones for local dev:

| Variable         | Purpose                                   | Local default        |
| ---------------- | ------------------------------------------ | --------------------- |
| `DB_PORT`        | Postgres port                              | `15432` (via `.env`)  |
| `DB_HOST`        | Postgres host                              | `localhost`           |
| `REDIS_ADDR`     | Redis address                              | `localhost:6379`      |
| `RABBITMQ_URL`   | RabbitMQ connection string                 | `amqp://guest:guest@localhost:5672/` |
| `MINIO_ENDPOINT` | MinIO endpoint                             | `localhost:9000`      |
| `CORS_ORIGIN`    | Allowed origin for the web app in dev      | `http://localhost:5173` |

## Commands

```sh
go run ./cmd/api                              # start the API server (auto-runs migrations)
go run ./cmd/api seed                          # seed a demo workspace/project/issues for local dev
go run ./cmd/api admin grant <email>           # grant instance-admin to an existing user
go vet ./...                                   # static analysis
go test ./...                                  # run all tests
go test ./internal/auth -run TestMagicCode     # run a single package/test
```

The `seed` command creates a demo user (`demo@devlane.test` / `Demo1234!`), a
workspace, a project with default workflow states, and sample work items so a
fresh database has something to explore. It's idempotent (a no-op once the demo
user exists). Local-only demo credentials — never use them in a real deployment.

## Migrations

Add paired files under `migrations/`: `NNNNNN_<name>.up.sql` and
`NNNNNN_<name>.down.sql`. They're applied automatically at startup via
`internal/database`. Never edit a migration after it has been merged — add a
new one instead.

## Conventions

Layering is `handler → service → store` (handlers never touch GORM directly;
stores never call services). See the repo-root `CLAUDE.md` for the full
architecture overview and `CONTRIBUTING.md` for commit/PR conventions.
