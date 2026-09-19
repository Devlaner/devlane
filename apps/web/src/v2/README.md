# v2 interface

The whole v2 web interface lives in this directory, and nothing else does.

v2 is **a preference, not a route**. Both interfaces answer to the same URLs;
which one a reader gets is stored in `localStorage` under
`devlane-interface-version`. There is no `/app-v2` prefix, no separate router,
and no redirect between the two.

For the visual and interaction direction (shadcn/ui, AdminCN references,
component rules), read [`AGENTS.md`](../../../../AGENTS.md) at the repo root.
This file is about how the two interfaces coexist in code.

## How a page gets picked

`src/routes/index.tsx` declares every path once and chooses the element:

```tsx
{
  path: 'issues',
  element: <Variant v1={<IssueListPage />} v2={<ProjectWorkItemsPageV2 />} />,
}
```

`Variant` (`src/routes/InterfaceVariant.tsx`) reads the preference from
[`contexts/InterfaceContext.tsx`](contexts/InterfaceContext.tsx) and renders one
side. Both elements are constructed on every render, but constructing an element
is just an object — the lazy component behind it is only imported when React
renders it, so a reader on v1 never downloads a v2 chunk.

Switching the preference does not navigate. The route tree re-renders the other
interface at the same URL.

## Directory layout mirrors `src/`

| v1                                                       | v2                                          |
| -------------------------------------------------------- | ------------------------------------------- |
| `src/pages/IssueListPage.tsx`                            | `src/v2/pages/IssueListPage.tsx`            |
| `src/components/layout/AppShell.tsx`                     | `src/v2/components/layout/AppShell.tsx`     |
| `src/components/ui/`                                     | `src/v2/components/ui/` (shadcn primitives) |
| `src/contexts/`, `src/hooks/`, `src/lib/`, `src/styles/` | same names under `src/v2/`                  |

A v2 page carries the **same filename and the same export name** as the v1 page
it replaces — `v2/pages/LoginPage.tsx` exports `LoginPage`, just like
`pages/LoginPage.tsx`. `routes/index.tsx` is the only place both are in scope,
and it aliases the v2 side locally (`LoginPageV2`, `AppShellV2`, …).

Files that exist only here — `contexts/AppShellHeaderContext.tsx`,
`hooks/useProjectIssuesController.ts`, `lib/filterProjectsList.ts` — have no v1
counterpart and are named for what they do.

## The isolation rule

Nothing outside `src/v2/` and `src/routes/` may import from `src/v2/`. This is
enforced by `no-restricted-imports` in `apps/web/eslint.config.js`, and it
covers both `@/v2/...` and relative `../v2/...` specifiers.

`src/routes/` is the exception because it is the composition root that mounts
both interfaces.

The reverse direction is open and intentional: v2 reuses v1's `services/`,
`api/` types, `AuthContext`/`ThemeContext`/`FavoritesContext`, `i18n`, and domain
components such as `components/work-item/*`. Those files are shared
infrastructure, not v1 design.

**v1 files must stay as they would be without v2.** The single exception is
`<InterfaceSwitch />` in `pages/SettingsPage.tsx` — two lines, whose
implementation lives in `src/routes/InterfaceSwitch.tsx` so the v1 page needs no
v2 knowledge.

## URLs

The shipped v1 URL shapes are canonical. A v2 page is reached at the v1 address:

- a project's work items are at `/:slug/projects/:id/issues`, not `work-items`
- `/:slug/projects/:id/board` redirects to `issues?layout=board` (v2 folds the
  board into the work items page as a layout; v1 keeps its own board page)

This is why password-reset links, invite links and existing bookmarks kept
working when v2 stopped being a separate route tree — they never had to change.

## Styles

[`styles/index.css`](styles/index.css) is a **separate Tailwind entry**, imported
by the two components every v2 page renders inside:
`components/layout/AppShell.tsx` and `components/auth-page-shell.tsx`. Both are
lazily loaded, so v1 never downloads the v2 stylesheet — the build emits two CSS
files and `index.html` links only v1's.

It has to be its own entry rather than an `@import` in the app's global
`index.css`: `shadcn-bridge.css` carries the `@theme inline` block naming the
shadcn tokens, and utilities like `bg-primary` are only emitted in the
stylesheet whose entry can see that block. `source(none)` plus an explicit
`@source '../../v2'` keeps the scan to this directory.

## Adding a page

1. Create `v2/pages/<Name>.tsx`, named after its v1 counterpart, exporting the
   same symbol.
2. In `src/routes/index.tsx`, add a `lazy()` const suffixed `V2` and pass it to
   the existing route's `<Variant>` — do not add a second route entry.
3. Link to it with v1 URL shapes.
4. Reuse primitives from `components/ui/` before adding new ones; new shadcn
   components land there via `npx shadcn add` (`components.json` aliases
   `@/v2/components`).

Some surfaces are deliberately v1-only: first-run setup and the instance-admin
tree. Their routes use a plain `<Suspense>` rather than `<Variant>`.
