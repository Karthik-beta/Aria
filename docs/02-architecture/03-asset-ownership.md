# Asset ownership boundary

R-001 establishes one canonical ownership chain for Asset Management:

~~~text
Organization.id -> Company.organizationId -> Asset.companyId
~~~

Company.id and Asset.id are stable identifiers. Company names are mutable
display labels, not persisted ownership keys. Asset and each directly
Company-bearing Asset-domain workflow record store a required companyId
foreign key; value adjustments derive ownership through their canonical Asset
relation. Services resolve the Company relation when they need the display name.

## Why this is the final boundary

ERPNext models Asset company as a required Link to Company. Its validation and
accounting behavior uses that Company for purchase-document checks, cost
centers, depreciation accounts, movements, capitalization, disposal, and
journal entries. It also permits Company rename, so Aria must keep foreign keys
stable while allowing the related name to change.

assetOwnerCompany remains a separate ERPNext-style owner field used only when
the Asset owner type is a company. It is not the Aria tenancy or accounting
Company relation.

## Company identity and organization policy

- Company names are unique within an Organization through
  (organizationId, name).
- The previous global Company.name uniqueness is intentionally removed.
  This follows Aria's tenant boundary: two Organizations may each have a
  Company with the same display name, while two Companies in one Organization
  may not.
- Company rename is supported through the normal Company update path. Asset and
  workflow foreign keys continue to point to the same Company ID, and reads
  reflect the new related name.
- Ordinary Company reassignment between Organizations is not supported. The
  Company CRUD contract does not accept organizationId as an update field;
  changing tenancy would require an explicit, audited transfer design.
- Ordinary Asset Company reassignment is also rejected. A future transfer
  workflow must define the accounting, depreciation, documents, and audit
  consequences before it can change Asset.companyId.

## Request and write boundaries

Company CRUD receives a trusted Organization ID and scopes Company lookup,
parent validation, duplicate checks, and reads to it. Asset writes resolve
companyId inside that Organization and reject missing or disabled Companies.

Asset workflow writes use the same stable ID contract:

- maintenance teams and maintenance records;
- movements;
- repairs;
- capitalizations;
- disposals;
- value-adjustment revaluation entries;
- Asset accounting entries;
- depreciation journals and CWIP capitalization.

Multi-Asset and cross-document operations derive or revalidate Company IDs from
the locked Asset/Company relations before persisting. Display-name filters in
legacy report/list contracts remain presentation filters; they are never used
as persisted identity.

The existing Inventory models still expose Company by name at their pre-existing
Warehouse/StockEntry boundary. Asset StockEntry posting resolves the canonical
Company ID first and supplies the related display name to that later Inventory
contract. Inventory ownership/query isolation is outside R-001.

## Migration and data policy

The final R-001 migration is intentionally clean and fail-closed:

- It adds Organization and Company IDs plus required Asset/workflow foreign keys.
- It drops the free-text Asset Company column, value-adjustment
  companySnapshot, and duplicated workflow Company strings.
- It creates the organization-scoped Company uniqueness constraint and
  Company-ID query indexes.
- It runs inside the migration transaction and refuses to proceed when
  pre-R-001 Company or Asset-domain rows exist.
- It does not guess a tenant, use a single-Organization fallback, normalize names,
  or maintain a compatibility snapshot.
- A disposable development database with old uncommitted R-001 data must be
  recreated or explicitly migrated by an approved future data-migration plan.

The migration script exercises:

1. a fresh full migration;
2. an empty database upgraded from the previous migration head;
3. a true ambiguous/non-empty legacy state, which fails closed; and
4. rollback evidence showing no partial canonical columns or recorded successful
   R-001 migration remain after failure.

## Scope boundary

R-001 establishes the canonical persisted ownership architecture and updates its
contracts, seeds, lifecycle/depreciation/accounting consumers, tests, and
documentation.

R-002 query scoping and R-003 organization-isolated realtime events remain
separate units. This change does not add broad query predicates, rewrite shared
master ownership, or alter realtime channels.
