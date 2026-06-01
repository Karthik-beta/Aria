# Vendored Repositories

This project vendors external dependency source trees under `repos/` so that
coding agents can explore real implementations instead of guessing from
documentation or web search results.

> Inspired by [The One Weird Git Trick That Makes Coding Agents More
> Effect-ive](https://effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive/)
> from the Effect team.

## Quick Start

```bash
# Vendor all repos (one-time setup)
./scripts/vendor-repos.sh

# Update all vendored repos to latest
./scripts/vendor-repos.sh --pull
```

## Repository Map

### Tier 1 — Critical

These are cross-cutting dependencies that agents get wrong most often.

| Repo | Prefix | Why |
|---|---|---|
| **tRPC** | `repos/trpc` | Entire API layer — 80+ procedures, subscriptions, WebSocket adapters, middleware chains. Agents frequently generate incorrect router/procedure patterns. |
| **Better Auth** | `repos/better-auth` | Auth layer with 4 plugins (username, customSession, admin, organization). Complex session/cookie/RBAC patterns that are hard to guess. |
| **Zod v4** | `repos/zod` | Schema validation across entire codebase (431+ usages). v4 has breaking changes from v3 — agents default to v3 patterns. |
| **NestJS** | `repos/nest` | Backend framework with 8 modules, global modules, lifecycle hooks. Agents often generate non-idiomatic Nest patterns. |

### Tier 2 — High Value

Complex APIs with heavy usage across the codebase.

| Repo | Prefix | Why |
|---|---|---|
| **Prisma** | `repos/prisma` | ORM with 50+ models, Prisma v7 driver adapter pattern, relation loading. |
| **TanStack Table** | `repos/tanstack-table` | Complex data table API with virtualization, column pinning, custom meta augmentation. |
| **React Hook Form** | `repos/react-hook-form` | 137+ files using `useFieldArray`, `Controller`, `FormProvider` patterns. |

### Tier 3 — Medium Value

Specialized libraries with tricky APIs.

| Repo | Prefix | Why |
|---|---|---|
| **DnD Kit** | `repos/dnd-kit` | Kanban board + column reordering. Complex sensor/collision/overlay patterns. |
| **nuqs** | `repos/nuqs` | URL state sync for data tables with custom parsers and batching. |
| **Zustand** | `repos/zustand` | State store with persistence middleware and skip-hydration SSR pattern. |

### Tier 4 — Lower Priority

Well-documented libraries where agents rarely struggle.

| Repo | Prefix | Why |
|---|---|---|
| **Recharts** | `repos/recharts` | Charting library (38 usages). Patterns are repetitive once you see the source. |
| **date-fns** | `repos/date-fns` | Date utilities. Agents rarely struggle with this. |
| **Biome** | `repos/biome` | Linting/formatting toolchain. Useful for understanding rule internals. |

## Individual Subtree Commands

If you prefer to add repos one at a time:

```bash
# Tier 1 — Critical
git subtree add --prefix=repos/trpc https://github.com/trpc/trpc.git main --squash
git subtree add --prefix=repos/better-auth https://github.com/better-auth/better-auth.git main --squash
git subtree add --prefix=repos/zod https://github.com/colinhacks/zod.git main --squash
git subtree add --prefix=repos/nest https://github.com/nestjs/nest.git master --squash

# Tier 2 — High Value
git subtree add --prefix=repos/prisma https://github.com/prisma/prisma.git main --squash
git subtree add --prefix=repos/tanstack-table https://github.com/TanStack/table.git main --squash
git subtree add --prefix=repos/react-hook-form https://github.com/react-hook-form/react-hook-form.git master --squash

# Tier 3 — Medium Value
git subtree add --prefix=repos/dnd-kit https://github.com/clauderic/dnd-kit.git main --squash
git subtree add --prefix=repos/nuqs https://github.com/47ng/nuqs.git next --squash
git subtree add --prefix=repos/zustand https://github.com/pmndrs/zustand.git main --squash

# Tier 4 — Lower Priority
git subtree add --prefix=repos/recharts https://github.com/recharts/recharts.git main --squash
git subtree add --prefix=repos/date-fns https://github.com/date-fns/date-fns.git main --squash
git subtree add --prefix=repos/biome https://github.com/biomejs/biome.git main --squash
```

## Updating a Subtree

```bash
# Update a single repo
git subtree pull --prefix=repos/trpc https://github.com/trpc/trpc.git main --squash

# Update all repos
./scripts/vendor-repos.sh --pull
```

## Editor Configuration

Exclude vendored repos from search, auto-imports, and file watching.

### VSCode — `.vscode/settings.json`

```json
{
  "typescript.preferences.autoImportFileExcludePatterns": ["repos/**"],
  "javascript.preferences.autoImportFileExcludePatterns": ["repos/**"],
  "files.exclude": { "repos/**": true },
  "files.watcherExclude": { "repos/**": true },
  "search.exclude": { "repos/**": true }
}
```

### JetBrains / WebStorm

Mark `repos/` as **Excluded** in Project Structure, or add to
`.idea/workspace.xml` under `FileTypesManager` exclusion patterns.

## AGENTS.md Integration

Add the following block to your `AGENTS.md` (or equivalent agent instructions):

```markdown
## Vendored Repositories

This project vendors external dependency source trees under `repos/`.

- **Read-only reference**: Use vendored repos to explore real implementations
  when working with related libraries. Do NOT edit files under `repos/` unless
  explicitly asked.
- **Prefer source over docs**: When unsure about an API, explore the vendored
  source code instead of relying on web search or documentation.
- **Do not import**: Application code must continue importing from normal
  package dependencies (`node_modules`), not from `repos/`.

### When to consult each repo

| Task | Consult |
|---|---|
| Writing tRPC routers/procedures/middleware | `repos/trpc` |
| Configuring auth, sessions, org plugins | `repos/better-auth` |
| Defining Zod schemas (v4 API) | `repos/zod` |
| Building NestJS modules/services | `repos/nest` |
| Prisma queries, relations, migrations | `repos/prisma` |
| Data table setup, column definitions | `repos/tanstack-table` |
| Form handling with react-hook-form | `repos/react-hook-form` |
| Drag-and-drop interactions | `repos/dnd-kit` |
| URL state management | `repos/nuqs` |
| Zustand stores, middleware | `repos/zustand` |
| Recharts chart components | `repos/recharts` |
| Date manipulation utilities | `repos/date-fns` |
| Biome lint/format rules | `repos/biome` |
```

## Trade-offs

**Pros:**
- Coding agents produce significantly better code when they can read real
  implementations instead of guessing from documentation.
- No extra tooling required — subtrees behave like normal directories.

**Cons:**
- Increases repo size (each subtree adds the full source tree).
- You take on responsibility for keeping them updated (use
  `./scripts/vendor-repos.sh --pull`).
- Each update adds a single squash commit to your history.

The payoff in agent output quality is, in our experience, well worth it.
