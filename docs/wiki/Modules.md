# Modules

Status of each module.

| Aria module | Status |
|---|---|
| [Assets](Assets) | Working: register, depreciation, maintenance, reports |
| [Stock and Inventory](Stock-and-Inventory) | Working: the largest module |
| Company and Setup | Working: small. Covers Company, Fiscal Year and Finance Book |
| Admin and Onboarding | Working: organizations and users (Better Auth) |
| CRM | Placeholder UI, no backend |
| HRMS | Placeholder UI, no backend |
| Accounts | Not started. Only Finance Book and asset depreciation journal entries exist |

## Company and Setup

`apps/backend/src/apps/company` holds Company, Fiscal Year and the link between them. The admin console (`/admin`) manages companies, finance books, organizations and users; see the [admin console guide](https://github.com/Karthik-beta/Aria/blob/main/docs/06-contributing/admin-console-guide.md).

## CRM and HRMS

The `/crm` and `/hrms` route groups contain starter dashboard pages only. There are no Prisma models or tRPC routers for them yet. Work on them is tracked on the board under the CRM and HR / HRMS modules.
