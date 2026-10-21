# Modules

Status of each module and the ERPNext module it derives from. "ERPNext parity" is the same field used on the [project board](Project-Board).

| Aria module | ERPNext source | Status | ERPNext parity |
|---|---|---|---|
| [Assets](Assets) | Assets | Working: register, depreciation, maintenance, reports | Partial |
| [Stock and Inventory](Stock-and-Inventory) | Stock, plus the Selling and Buying documents it needs | Working: the largest module | Partial |
| Company and Setup | Setup (Company, Fiscal Year), Accounts (Finance Book) | Working: small | Partial |
| Admin and Onboarding | none (Better Auth organizations and users) | Working | Aria only |
| CRM | CRM | Placeholder UI, no backend | Not started |
| HRMS | HRMS (a separate Frappe app) | Placeholder UI, no backend | Not started |
| Accounts | Accounts | Only Finance Book and asset depreciation journal entries exist | Not started |

## Company and Setup

`apps/backend/src/apps/company` follows ERPNext's Company DocType. It holds Company, Fiscal Year and the link between them. The admin console (`/admin`) manages companies, finance books, organizations and users; see the [admin console guide](https://github.com/Karthik-beta/Aria/blob/master/docs/06-contributing/admin-console-guide.md).

## CRM and HRMS

The `/crm` and `/hrms` route groups contain starter dashboard pages only. There are no Prisma models or tRPC routers for them yet. Work on them is tracked on the board under the CRM and HR / HRMS modules.
