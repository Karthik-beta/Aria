# Development Workflow

## Branches

Branch from `master` and open a pull request back into it.

| Prefix | Use |
|---|---|
| `feature/<description>` | New features |
| `fix/<description>` | Bug fixes |
| `refactor/<description>` | Refactoring |
| `chore/<description>` | Maintenance, CI, docs |

Use **Bun only** (never npm, pnpm or yarn). Commit messages follow Conventional Commits, for example `feat(asset): ...` or `fix(setup): ...`.

## Quality gates

Run before opening a PR (CI runs the same checks):

```bash
bun format          # Biome formatting
bun run lint
bun run typecheck
bun run test
bun run build
bun run validate    # all of the above
```

## Labels

| Label | Meaning |
|---|---|
| `module: assets`, `module: inventory`, `module: crm`, `module: hrms`, `module: accounts`, `module: platform`, `module: setup` | Area of the codebase. Applied to PRs automatically from changed paths; set on issues by hand. |
| `erpnext-port` | Work that ports or re-checks ERPNext behaviour (see [ERPNext Porting](ERPNext-Porting)) |
| `upstream-sync` | Weekly ERPNext release review |
| `priority: P0` … `priority: P3` | Urgency |
| `bug`, `enhancement`, `documentation`, `ci`, `dependencies` | Type of change |

## GitHub Actions

| Workflow | Runs on | What it does |
|---|---|---|
| **CI** | PRs and pushes to `master` | Lint and typecheck, unit and integration tests, E2E, build, Docker production smoke and recovery |
| **Triage** | Issues and PRs opened, updated or closed | Labels PRs by path; adds issues and PRs to the [project board](Project-Board) and moves their Status |
| **Windows Installer** | PRs touching installer or local-deploy paths | Builds `Aria-ERP-Setup.exe` |
| **Release Images** | Pushes to `master`, `v*.*.*` tags | Multi-arch backend and frontend images to GHCR; on tags also the signed installer and GitHub Release (see [Releases](Releases)) |
| **Production Smoke** | Deployment status, manual | Verifies the demo deployment |
| **Landing Page** | Changes to `site/` | Deploys the GitHub Pages site |
| **Wiki Sync** | Changes to `docs/wiki/` on `master` | Publishes this wiki |
| **ERPNext Upstream Watch** | Mondays 04:00 UTC, manual | Opens an `upstream-sync` issue listing the week's ERPNext releases |
| **Enforce Official Docs References** | PRs | Checks the PR references official documentation |
| **Manual Deployment Diagnostics** | Manual | Linux and Windows deployment tests, security scan, performance test |

More: [contributing guide](https://github.com/Karthik-beta/Aria/blob/master/CONTRIBUTING.md), [dependency management](https://github.com/Karthik-beta/Aria/blob/master/docs/06-contributing/01-dependencies.md).
