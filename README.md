![Devlane](./ui/public/devlane-1-dark.png)

**Issue tracking and project management for development teams.**

Devlane helps you organize work in workspaces and projects: track issues, assign owners, group work into cycles and modules, and keep everything in sync with a clear activity feed and rich comments.

---

## Installation

You can run Devlane in two ways:

- **Self-hosted** — Run the API and UI on your own infrastructure. You need PostgreSQL, Redis, and optionally RabbitMQ and MinIO (see the API and UI READMEs for environment variables and setup).
- **From source** — Clone the repo and run the API and UI for local development or your own deployment.

| Method        | Notes |
| ------------- | ----- |
| Docker        | Use the API and UI Dockerfiles (or compose) with the required env and database migrations. |
| From source   | See [Local development](#local-development) below. |

Instance administrators can manage workspaces and instance settings from the instance-admin area after initial setup.

---

## Features

- **Issues (work items)** — Create and manage issues with description, state, priority, assignees, labels, and parent/child links. Sub-issues and a properties sidebar keep context in one place.
- **Cycles** — Group issues into time-boxed cycles and track progress.
- **Modules** — Break projects into modules for clearer scope and status.
- **Views** — Filter and save views so you can focus on the right issues.
- **Activity and comments** — Each issue has an activity feed. Add and edit comments with a rich text editor (bold, lists, code blocks). Edit and delete comments with relative timestamps.
- **Pages** — Lightweight docs and notes linked to your workspace.
- **Analytics** — Overview and work-item analytics to see progress and trends.
- **Workspace settings** — Manage members (with display names), projects, and workspace-level configuration.

---

## Local development

1. **API** — From the `api` directory, copy `.env.example` to `.env`, set your PostgreSQL and Redis (and optional RabbitMQ/MinIO) settings, run migrations, then start the server (see `api/README.md`).
2. **UI** — From the `ui` directory, run `npm install` and `npm run dev`. Point the UI at your local API using the configured base URL.
3. **First run** — Complete instance setup in the browser (create admin account, then create a workspace and project).

For contribution workflow and code style, see [CONTRIBUTING](CONTRIBUTING.md) if present.

---

## Built with

[![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev/)
[![Gin](https://img.shields.io/badge/Gin-008ECF?style=for-the-badge&logo=go&logoColor=white)](https://gin-gonic.com/)
[![GORM](https://img.shields.io/badge/GORM-000000?style=for-the-badge&logo=go&logoColor=white)](https://gorm.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![MinIO](https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white)](https://min.io/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![React Router](https://img.shields.io/badge/React%20Router-CA4245?logo=react-router&style=for-the-badge&logoColor=white)](https://reactrouter.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TipTap](https://img.shields.io/badge/TipTap-000000?style=for-the-badge&logo=prosemirror&logoColor=white)](https://tiptap.dev/)
[![Recharts](https://img.shields.io/badge/Recharts-FF7300?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://recharts.org/)

---

## Documentation

- **API** — See `api/README.md` for setup, env vars, and running the server.
- **UI** — See `ui/README.md` for front-end setup and scripts.

---

## Contributing

Contributions are welcome. Please open an issue for bugs or feature ideas, and read [CONTRIBUTING](CONTRIBUTING.md) for pull request and development guidelines.

---

## Repo Activity
![Devlane Repo Activity](https://repobeats.axiom.co/api/embed/8d9a7f7b4ce8af0dcc5a88f41ace0966b6c32ae8.svg "Repobeats analytics image")

## Contributors

<a href="https://github.com/Devlaner/devlane/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Devlaner/devlane" />
</a>

## Star History

<a href="https://www.star-history.com/?repos=Devlaner%2Fdevlane&type=date&logscale=&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=Devlaner/devlane&type=date&theme=dark&logscale&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=Devlaner/devlane&type=date&logscale&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=Devlaner/devlane&type=date&logscale&legend=top-left" />
 </picture>
</a>

## License

This project is licensed under the **Devlane Software License**. It grants you broad use and modification rights (MIT-style) but does not allow selling the software or offering it as a hosted/subscription service to third parties. See [LICENSE](LICENSE) for the full text. This license is not OSI-approved open source.
