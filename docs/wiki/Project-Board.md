# Project Board

All Aria work is tracked on the **[Aria ERP project](https://github.com/users/Karthik-beta/projects/4)**, linked to this repository.

## Fields

| Field | Values | Set by |
|---|---|---|
| **Status** | Backlog, Todo, In Progress, In Review, Done | Automation, adjustable by hand |
| **Module** | Accounts, Assets, Stock / Inventory, Buying, Selling, CRM, HR / HRMS, Manufacturing, Projects, Platform / Core, Setup / Installer, Docs | Automation from `module: *` labels, or by hand |
| **ERPNext Parity** | Not started, Porting, Partial, At parity, Diverged by design, Aria only | By hand, for `erpnext-port` work |
| **Priority** | P0 - Critical, P1 - High, P2 - Medium, P3 - Low | By hand |
| **Size** | XS, S, M, L, XL | By hand |
| **Target date** | date | By hand |

## Automation

The **Triage** workflow keeps the board in sync:

| Event | Status |
|---|---|
| Issue opened | Backlog |
| Issue reopened | Todo |
| Issue closed as completed | Done |
| Draft PR opened, or PR converted to draft | In Progress |
| PR opened or marked ready for review | In Review |
| PR merged | Done |

Issues closed as not planned and PRs closed without merging keep their Status; archive them from the board.

The workflow needs a repository secret named `PROJECT_TOKEN`: a classic personal access token with the `project` and `repo` scopes. The default `GITHUB_TOKEN` cannot write to a user-owned project. Without the secret the board step is skipped and everything else still runs.

## Suggested views

- **Board** grouped by Status, filtered to `-status:Done` or recently updated
- **By module**: table grouped by Module
- **ERPNext parity**: table filtered to `label:erpnext-port`, grouped by ERPNext Parity
- **Roadmap**: roadmap layout on Target date
