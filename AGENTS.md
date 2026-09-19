# Repository instructions for coding agents

Read and follow `CLAUDE.md` for the repository architecture, commands, and
contribution rules. The instructions below add the design direction for the
v2 web interface.

## V2 web design direction

These rules apply to everything under `apps/web/src/v2/**` — the whole v2
interface lives there and nothing else does:

- `apps/web/src/v2/pages/**` — one file per v1 page, same filename
- `apps/web/src/v2/components/**` — shadcn primitives in `ui/`, the v2 shell in `layout/`
- `apps/web/src/v2/{contexts,hooks,lib,styles}/**`

Nothing outside `src/v2/` may import from it (enforced by `no-restricted-imports`
in `apps/web/eslint.config.js`); `src/routes/` is the one exception, since it
mounts both interfaces. The reverse is allowed: v2 reuses v1's services, api
types and domain components.

Use these references when designing or implementing the v2 interface:

1. [shadcn/ui component documentation](https://ui.shadcn.com/docs/components)
   is the primary reference for component APIs, composition, accessibility,
   states, and usage patterns.
2. [shadcn/ui source repository](https://github.com/shadcn-ui/ui) is the
   primary reference when the documentation is insufficient or the current
   component implementation needs to be inspected.
3. [AdminCN Free](https://shadcnstudio.com/templates/admin-dashboard/admincn-free)
   is the visual and interaction reference for dashboard composition,
   navigation, responsive layouts, tables, forms, settings, and application
   pages.

### Implementation rules

- Prefer the project's existing shadcn primitives from
  `@/components/shadcn/ui`. Their aliases and the `new-york` style are defined
  in `apps/web/components.json`.
- Before creating a custom primitive, check the shadcn/ui documentation and
  the components already present in `apps/web/src/components/shadcn/ui`.
- Use AdminCN as design inspiration, not as a framework dependency. Devlane is
  a React 19 + Vite + React Router application; do not copy Next.js-specific
  routing, server-component, or App Router patterns into it.
- Adapt external examples to Devlane's existing services, route conventions,
  theme tokens, and component structure. Do not clone, vendor, or import an
  external template wholesale.
- Keep v2 work within the v2 surface unless the task explicitly requires a
  shared or legacy-interface change.
- Preserve the current shadcn token bridge and theme behavior. Prefer semantic
  theme classes and tokens over one-off colors, radii, or spacing values.
- Treat `.shadcn-v4` and `.shadcn-reference` themes as comparison aids only;
  shipped Devlane UI must use the normal Devlane token bridge.
- Every screen must remain responsive and accessible, including keyboard
  navigation, visible focus, labels, loading/empty/error states, and usable
  light and dark themes.
- Reuse components and patterns across v2 pages instead of duplicating the
  same UI for individual pages.

When a reference conflicts with the repository's architecture or product
behavior, preserve Devlane's behavior and adapt only the visual/compositional
pattern.
