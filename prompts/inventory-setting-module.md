You are working on the branch: "feat/inventory-settings-module".

Current page: "Warehouse"

Valid page values:
- Stock Settings
- Warehouse
- Brand
- Item Attribute

You are building a core sub-module inside an inventory management system.

## Context
Sub-module: "Inventory Settings"

This sub-module contains the following pages:
1. Stock Settings
2. Warehouse
3. Unit of Measure (UOM)
4. Brand
5. Item Attribute

Current implementation status:
- UOM page is already completed
- UOM must be treated as the primary implementation reference
- This run is only for the page specified in `Current page`

## Objective
Build the page specified in `Current page` as a complete, production-ready full-stack feature.

This is not a UI-only task. You are responsible for the entire feature working end-to-end for this one page.

This includes:
- proper backend integration
- frontend implementation
- validation
- correct data modeling
- entity relationships
- functional list view, create/edit flows, dialogs, and detail interactions where applicable
- cache invalidation and refetch correctness
- proper testing for business logic, API behavior, and user flows

Do not work on multiple pages in the same run.
Do not scaffold future pages.
Do not make speculative changes for other Inventory Settings pages unless strictly required by shared architecture.

## Page-Specific Scope
You must implement exactly one page in this run: the page specified in `Current page`.

Use the correct domain shape for the selected page.

### If the current page is Stock Settings
Treat it as a settings/configuration page, not generic master-data CRUD, unless the codebase already models it differently.

Expected responsibility:
- manage inventory behavior defaults and operational settings
- implement correct fetch/update persistence semantics
- handle defaults intentionally across schema, service, API, and UI
- model singleton-style settings flow if that is how the domain should work

### If the current page is Warehouse
Treat it as a first-class inventory entity.

Expected responsibility:
- warehouse master data
- parent or nested warehouse relationships if supported
- company, branch, and location linkage where applicable
- status, disabled, or group semantics where required
- safeguards for deletion or disablement when dependent inventory data exists
- proper bounded list fetching and detail actions

### If the current page is Brand
Treat it as a master-data entity used by Items and inventory-related records.

Expected responsibility:
- create, edit, list, delete, or disable flows as appropriate
- uniqueness handling
- safe relationship handling with dependent items
- native integration with existing item-related patterns already present in the codebase

### If the current page is Item Attribute
Treat it as a richer settings entity, not a flat trivial table.

Expected responsibility:
- define an attribute
- manage nested attribute values if the domain requires it
- preserve child row identity during updates
- do not delete and recreate child rows blindly
- support downstream item or variant logic if already expected by the system

## Reference
I have provided screenshots such as:
- main sidebar and navigation context
- relevant ERP-style reference screenshots where applicable

These screenshots are from a mature open source ERP system called "ERPNext".

Use them strictly as reference for:
- business logic
- field coverage
- entity relationships
- user workflows

Do not copy the exact design.

## Design System
Follow the existing design language of this codebase.

Use the following as the primary reference for UI and architecture patterns:
- UOM page inside Inventory Settings
- nearby completed inventory pages with similar behavior
- existing inventory service, router, validation, and testing patterns
- completed pages from adjacent inventory modules where relevant

Reuse the same:
- layout structure
- component patterns
- styling approach
- interaction patterns
- form architecture
- dialog, drawer, and sheet usage patterns
- existing shadcn-based component usage patterns already present in the codebase

The final implementation must feel native and consistent with the existing product.

## File Structure Constraint
All frontend files and folders for this page must lie inside:

apps/frontend/src/app/inventory/inventory-settings

Follow the existing folder and naming conventions used in nearby modules.

Keep page-specific UI, helpers, utilities, and config colocated inside this Inventory Settings area.

Do not:
- scatter page-specific frontend files into unrelated modules
- create new unrelated frontend top-level feature locations
- modify anything inside the "ui" folder

Important:
- This file structure constraint applies to frontend page-specific code for the page specified in `Current page`
- Backend code, schema changes, services, routers, and tests must still live in their proper existing backend and test locations

## Architecture & Implementation
Operate with high agency. Do not wait for step-by-step instructions.

You must:
- study the completed UOM implementation before coding
- study similar inventory entities in the repo before making changes
- infer architecture and patterns from existing implementations
- reuse existing patterns for forms, tables, dialogs, validation, API integration, state management, and subscriptions
- implement all required backend and frontend pieces where missing
- keep the page fully integrated with related entities and workflows

Fields must not be isolated.
Whenever business logic implies relationships between fields or entities, implement those relationships properly.

## Non-Negotiable Engineering Guardrails
These are mandatory. Do not skip them.

### 1) Respect the domain shape
Do not force the current page into the wrong pattern.
- Stock Settings may be singleton-style settings
- Warehouse and Brand may be master data
- Item Attribute may contain nested child rows

### 2) No dead real-time code
If you add subscriptions, live queries, or event listeners, you must also emit the corresponding events from create, update, delete, and bulk mutation flows where applicable.
Do not add subscription procedures without wiring the matching event emission path.
Mirror the existing working event-driven patterns already present in the codebase.

### 3) No race-prone identifier or series generation
If the current page needs generated identifiers, naming series, or sequence numbers, implement them safely.
Do not use naive read-then-write logic that can create duplicates under concurrency.
Use an atomic approach suitable for the stack, such as:
- database sequence
- locking
- transaction-safe generation
- retry on unique conflict where appropriate

Handle uniqueness failures gracefully and intentionally.

### 4) No destructive child-row replacement unless explicitly correct
If the current page has child rows, nested values, or relational sub-records, do not blindly delete all children and recreate them on update.
Preserve existing row identity and business fields where appropriate.
Use a proper patch, diff, or upsert-style strategy for nested updates.

### 5) Do not bypass type safety
Do not use unsafe double-casts such as `as unknown as ...` to silence TypeScript.
Resolve the root typing issue properly.
For forms, correctly distinguish input types, parsed schema types, and submission payload types.
Prefer clean schema boundaries over casting hacks.

### 6) Keep migrations scoped and clean
If database changes are needed, keep the migration strictly related to the current page and its true dependencies.
Do not mix unrelated schema or index changes into the same migration.
Avoid accidental changes caused by schema drift.

### 7) No unbounded list fetching
List endpoints must not fetch all records without limits.
Implement pagination, cursoring, or at least a bounded query shape consistent with existing app patterns.
Frontend tables must consume bounded data intentionally.

### 8) No permanently stale client data
Do not use cache settings that can leave data stale forever unless the architecture truly guarantees correctness through another mechanism.
Use sane invalidation and refresh behavior.
If mutations update list data, ensure the cache story is reliable after create, edit, delete, disable, and save actions.

### 9) Respect domain defaults
Do not hardcode defaults without checking:
- schema defaults
- shared types
- existing business workflow in the codebase
- inventory expectations already established elsewhere

Choose defaults intentionally and keep them aligned across schema, service, API, and UI.

### 10) Extract reusable page-specific domain UI where needed
If badges, formatters, hierarchy helpers, labels, or display logic are used in multiple places for the current page, extract them into reusable utilities or components instead of duplicating them locally.

### 11) No placeholder or copied scaffold leftovers
Do not leave copied placeholder columns, fake counters, unused imports, dead icons, hardcoded dummy values, or incomplete actions.
Everything visible in the UI must be intentional and backed by real functionality.

### 12) Avoid avoidable render-performance issues
Do not define pure utility functions inside render paths unless there is a clear reason.
Do not call broad `form.watch()` patterns inside JSX in ways that cause unnecessary rerenders.
Prefer optimized patterns such as scoped subscriptions, memoized helpers, or `useWatch` where appropriate.

### 13) Use design-system tokens, not hardcoded styling hacks
Do not use hardcoded hex colors or styling values when equivalent design tokens, Tailwind utilities, or theme-aware primitives already exist.
Keep dark mode and theming compatibility intact.

### 14) Handle errors intentionally
Do not let raw ORM or framework errors leak through when there is an expected domain case such as:
- not found
- duplicate unique value
- invalid parent
- related entity missing
- cannot delete due to dependent records
- invalid state or invalid nested value

Use the project’s established error handling patterns consistently across single and bulk actions.

## Testing Expectations
Add proper testing code for the current page and its related logic.

Follow the existing testing patterns already used in the codebase.
Do not introduce a completely different testing style unless the repository clearly requires it.

Your tests must cover the most important behavior, including where relevant:
- settings fetch and update flow
- CRUD flows where applicable
- validation behavior
- form submission behavior
- data mapping and transformation
- nested child update behavior
- list query behavior including pagination or bounds
- cache invalidation or refetch-critical behavior where applicable
- real-time event emission if subscriptions are introduced
- error paths and edge cases
- concurrency-sensitive logic such as generated series or uniqueness handling
- regression-prone business logic

Do not write fake tests, trivial assertions, or coverage-padding tests.

At minimum, add:
- unit tests for helpers, mappers, and domain-specific transformation logic
- service or integration tests for create, update, delete, disable, and save flows as relevant
- tests specifically covering nested child update correctness if applicable
- tests for sequence or identifier generation if the page uses one
- UI tests for the create, edit, or save form behavior and core list actions

Make sure the implementation and tests both pass together.

## Validation & Execution
Before considering the task complete, run the full validation flow.

### Step 1: Targeted Scope Check
Identify all files changed for the page specified in `Current page`.
Verify that unrelated pages and modules were not modified unnecessarily.

### Step 2: Typecheck
Run:
- `bun run typecheck`

Requirements:
- zero type errors
- clean contract alignment between frontend and backend
- no unsafe casts

### Step 3: Lint
Run:
- `bun run lint`
- `bun run lint:fix` if needed

Requirements:
- zero lint errors
- follow repo Biome rules strictly

### Step 4: Targeted Validation
Run targeted checks relevant to the changed areas first.
That includes the affected frontend, backend, and shared packages touched by the page specified in `Current page`.

### Step 5: Build
Run:
- `bun run build`

Requirements:
- full monorepo build succeeds
- no broken imports
- no missing dependencies

### Step 6: Tests
Run:
- `bun run test`

Then fix root causes for any failures.
Do not bypass failing tests.

### Step 7: Final Validation Gate
Run:
- `bun run validate:local`

Requirements:
- zero errors
- zero warnings

### Step 8: Functional Sanity Check
Manually verify:
- the page specified in `Current page` loads correctly
- create, edit, delete, disable, or save flows work correctly as applicable
- data persists correctly
- no stale UI after mutation
- no console errors
- no backend runtime errors

### Step 9: Regression Check
Verify:
- UOM page is not broken
- nearby inventory flows are unaffected
- no shared component was unintentionally changed

## Constraints
- Do not modify anything inside the "ui" folder
- Do not break or change unrelated modules
- Do not introduce inconsistent architecture or patterns
- Do not blindly copy reference screenshots
- Do not leave placeholder or fake implementations unless absolutely unavoidable
- Do not skip tests for important logic or flows
- Do not work on more than one Inventory Settings page in this run

## Quality Bar
The implementation must be:
- fully functional end-to-end
- integrated with the system
- consistent with the codebase
- clean and maintainable
- correct in terms of relationships and workflows
- safe under realistic usage, including concurrent operations where relevant
- backed by meaningful, reliable tests

## Execution Approach
Before coding:
1. study the UOM page thoroughly
2. study similar implementations in the repo
3. analyze adjacent inventory pages with similar patterns
4. understand the data model and relationships for the current page
5. study the existing test patterns in the codebase
6. study existing event and subscription patterns if the page needs live updates
7. study how adjacent modules handle pagination, cache invalidation, defaults, statuses, and nested updates
8. use ERPNext screenshots only to infer expected behavior

Then implement the feature completely.

## Required Self-Review Before Completion
Before considering the task done, verify all of the following:

- Did I stay focused on only the page specified in `Current page`?
- Does the page use the correct domain shape?
- Does all frontend page-specific code live under `apps/frontend/src/app/inventory/inventory-settings`?
- Does the feature work end-to-end?
- Are all relevant fields correctly implemented?
- Are related entities properly connected?
- Are nested rows updated safely without destructive data loss?
- Are any generated identifiers or series safe under concurrency?
- If subscriptions exist, are matching events emitted?
- Are list endpoints bounded and paginated appropriately?
- Is cache behavior safe after mutations?
- Are defaults aligned across schema, types, service, and UI?
- Is everything wired frontend to backend?
- Are there any unsafe casts, dead code paths, placeholder values, or unused imports?
- Are repeated formatters or helpers extracted where needed?
- Are important flows covered by proper tests?
- Do tests cover edge cases and regression-prone behavior?
- Is the feature production-ready without hacks?

## Deliverable
A complete implementation of exactly one Inventory Settings page:
the page specified in `Current page`

The final implementation must:
- work end-to-end
- be fully integrated into the Inventory Settings sub-module
- match the product's design system
- reflect real-world inventory workflows
- include proper backend, frontend, validation, and tests
- keep frontend page-specific files inside `apps/frontend/src/app/inventory/inventory-settings`
- avoid dead code, destructive updates, unsafe typing, stale data issues, and missing critical infrastructure wiring
- pass `bun run validate:local` with zero errors and zero warnings