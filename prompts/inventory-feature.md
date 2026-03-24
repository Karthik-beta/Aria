You are working on the branch: "feat/inventory-stock-transaction".

Current page: "Pick List"

You are building a core sub-module inside an inventory management system.

## Context
Sub-module: "Stock Transaction"

This sub-module contains the following pages:
1. Material Request
2. Stock Entry
3. Delivery Note
4. Purchase Receipt
5. Pick List
6. Delivery Trip

## Objective
Build the current page as a complete, production-ready full-stack feature.

This is not a UI-only task. You are responsible for the entire feature working end-to-end.

This includes:
- Full CRUD functionality
- All required fields and forms
- Backend + frontend integration
- Data validation
- Proper data modeling
- Functional list view, create/edit flows, dialogs, and detail interactions
- Proper testing for business logic, API behavior, and user flows

## Reference
I have provided screenshots such as:
- Main page
- Add/Edit forms
- Dialogs

These screenshots are from a mature open source ERP system called "ERPNext".

Use them strictly as reference for:
- Business logic
- Field coverage
- Entity relationships
- User workflows

Do not copy the exact design.

## Design System
Follow the existing design language of this codebase.

Use the "Items Catalogue" sub-module as the primary reference for UI/UX patterns, especially pages like:
- Item
- Item Group
- Product Bundle

Reuse the same:
- Layout structure
- Component patterns
- Styling approach
- Interaction patterns
- Existing Shadcn-based component usage patterns already present in the codebase

The final implementation must feel native and consistent with the existing product.

## File Structure Constraint
All files and folders for this page must lie inside:

apps/frontend/src/app/inventory/stock-transaction

Follow the existing folder and naming conventions used in nearby modules.

## Architecture & Implementation
Operate with high agency. Do not wait for step-by-step instructions.

You must:
- Study similar modules in the codebase before making changes
- Infer architecture and patterns from existing implementations
- Reuse existing patterns for forms, tables, dialogs, validation, API integration, state management, and subscriptions
- Implement all required backend and frontend pieces where missing
- Keep the page fully integrated with related entities and workflows

Fields must not be isolated.
Whenever business logic implies relationships between fields or entities, implement those relationships properly.

## Non-Negotiable Engineering Guardrails
These are mandatory. Do not skip them.

### 1) No dead real-time code
If you add subscriptions, live queries, or event listeners, you must also emit the corresponding events from create, update, delete, and bulk mutation flows where applicable.
Do not add subscription procedures without wiring the matching event emission path.
Mirror the existing working event-driven patterns already present in the codebase.

### 2) No race-prone identifier or series generation
If the current page needs generated identifiers, naming series, or sequence numbers, implement them safely.
Do not use naive read-then-write logic that can create duplicates under concurrency.
Use an atomic approach suitable for the stack, such as:
- database sequence
- locking
- transaction-safe generation
- retry on unique conflict where appropriate

Handle uniqueness failures gracefully and intentionally.

### 3) No destructive child-row replacement unless explicitly correct
If the page has child rows, line items, or nested relational records, do not blindly delete all children and recreate them on update.
Preserve existing row identity and business fields where appropriate.
Use a proper patch, diff, or upsert-style strategy for nested updates.
Do not reset accumulated or workflow-dependent fields unintentionally.

### 4) Do not bypass type safety
Do not use unsafe double-casts such as `as unknown as ...` to silence TypeScript.
Resolve the root typing issue properly.
For forms, correctly distinguish input types, parsed schema types, and submission payload types.
Prefer clean schema boundaries over casting hacks.

### 5) Keep migrations scoped and clean
If database changes are needed, keep the migration strictly related to the current page and its true dependencies.
Do not mix unrelated schema or index changes into the same migration.
Avoid accidental changes caused by schema drift.

### 6) No unbounded list fetching
List endpoints must not fetch all records without limits.
Implement pagination, cursoring, or at least a bounded query shape consistent with existing app patterns.
Frontend tables must consume bounded data intentionally.

### 7) No permanently stale client data
Do not use cache settings that can leave data stale forever unless the architecture truly guarantees correctness through another mechanism.
Use sane invalidation and refresh behavior.
If mutations update list data, ensure the cache story is reliable after create, edit, delete, and bulk actions.

### 8) Respect domain workflow defaults
Do not hardcode workflow defaults without checking:
- Prisma schema defaults
- shared types
- existing business workflow in the codebase
- ERP expectations for draft, submitted, pending, cancelled, etc.

Choose defaults intentionally and keep them aligned across schema, service, API, and UI.

### 9) Extract reusable page-specific domain UI where needed
If status badges, formatters, purpose labels, helpers, or display logic are used in multiple places for the current page, extract them into reusable utilities/components instead of duplicating them locally.

### 10) No placeholder or copied scaffold leftovers
Do not leave copied placeholder columns, fake counters, unused imports, dead icons, or hardcoded dummy values.
Everything visible in the UI must be intentional and backed by real functionality.

### 11) Avoid avoidable render-performance issues
Do not define pure utility functions inside render paths unless there is a clear reason.
Do not call broad `form.watch()` patterns inside JSX in ways that cause unnecessary rerenders.
Prefer the codebase’s optimized patterns such as scoped subscriptions, memoized helpers, or `useWatch` where appropriate.

### 12) Use design-system tokens, not hardcoded styling hacks
Do not use hardcoded hex colors or styling values when equivalent design tokens, Tailwind utilities, or theme-aware primitives already exist.
Keep dark mode and theming compatibility intact.

### 13) Handle errors intentionally
Do not let raw ORM or framework errors leak through when there is an expected domain case such as:
- not found
- duplicate unique value
- invalid state transition
- related entity missing

Use the project’s established error handling patterns consistently across single and bulk actions.

## Testing Expectations
Add proper testing code for the current page and its related logic.

Follow the existing testing patterns already used in the codebase. Do not introduce a completely different testing style unless the repository clearly requires it.

Your tests must cover the most important behavior, including where relevant:
- CRUD flows
- Validation behavior
- Form submission behavior
- Data mapping and transformation
- Nested items or child-row update behavior
- List query behavior including pagination or bounds
- Cache invalidation or refetch-critical behavior where applicable
- Real-time event emission if subscriptions are introduced
- Error paths and edge cases
- Concurrency-sensitive logic such as generated series or uniqueness handling
- Regression-prone business logic

Do not write fake tests, trivial assertions, or coverage-padding tests.

At minimum, add:
- unit tests for helpers, mappers, and domain-specific transformation logic
- service or integration tests for create, update, delete, and bulk flows
- tests specifically covering nested child update correctness
- tests for sequence/identifier generation if the page uses one
- UI tests for the create/edit form behavior and core list actions

Make sure the implementation and tests both pass together.

## Constraints
- Do not modify anything inside the "ui" folder
- Do not break or change unrelated modules
- Do not introduce inconsistent architecture or patterns
- Do not blindly copy reference screenshots
- Do not leave placeholder or fake implementations unless absolutely unavoidable
- Do not skip tests for important logic or flows

## Quality Bar
The implementation must be:
- Fully functional end-to-end
- Integrated with the system
- Consistent with the codebase
- Clean and maintainable
- Correct in terms of relationships and workflows
- Safe under realistic usage, including concurrent operations where relevant
- Backed by meaningful, reliable tests

## Execution Approach
Before coding:
1. Study similar implementations in the repo
2. Analyze the "Items Catalogue" sub-module
3. Understand the data model and relationships
4. Study the existing test patterns in the codebase
5. Study existing event/subscription patterns if the page needs live updates
6. Study how adjacent modules handle pagination, cache invalidation, statuses, and nested updates
7. Use the "ERPNext" screenshots to infer expected behavior

Then implement the feature completely.

## Required Self-Review Before Completion
Before considering the task done, verify all of the following:

- Does CRUD fully work?
- Are all fields correctly implemented?
- Are related entities properly connected?
- Are nested rows updated safely without destructive data loss?
- Are any generated identifiers or series safe under concurrency?
- If subscriptions exist, are matching events emitted?
- Are list endpoints bounded and paginated appropriately?
- Is cache behavior safe after mutations?
- Are workflow defaults aligned across schema, types, service, and UI?
- Is everything wired frontend to backend?
- Are there any unsafe casts, dead code paths, placeholder values, or unused imports?
- Are repeated formatters or badges extracted where needed?
- Are important flows covered by proper tests?
- Do tests cover edge cases and regression-prone behavior?
- Is the feature production-ready without hacks?

## Deliverable
A complete implementation of the current page that:
- Works end-to-end
- Is fully integrated into the Stock Transaction sub-module
- Matches the product's design system
- Reflects real-world inventory workflows
- Includes proper testing code for the implemented functionality
- Avoids dead code, destructive updates, unsafe typing, stale data issues, and missing critical infrastructure wiring
- Must pass "bun run validate" with zero errors and zero warnings
