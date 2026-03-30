You are working inside the Aria ERP monorepo.

CURRENT_WORKING_PAGE = "Subcontracted Item To Be Received"

Important: `CURRENT_WORKING_PAGE` is the single source of truth for this task. Do not require me to edit the page name anywhere else.

## Current module status

All Inventory Management sub-modules except `Other Reports` have already been completed, although some of the completed areas may still need fixes or refinements.

For now, you are to work exclusively on the `Other Reports` sub-module.

This session is only for the single page named in `CURRENT_WORKING_PAGE`.
Do not try to implement the entire `Other Reports` sub-module in one go.
Do not work on any other inventory sub-module in this session unless a narrowly scoped shared dependency must be adjusted to complete this page correctly.

## Objective

Fully implement the `CURRENT_WORKING_PAGE` report end-to-end in Aria by studying the equivalent ERPNext implementation from the `.erpnext` folder at the root of the monorepo, then recreating its business functionality in Aria.

Replicate the business behavior, workflows, filters, validations, calculations, permissions, data flow, and user outcomes that matter.

Do NOT copy ERPNext's design, UI, styling, layout, markup, wording quirks, or visual structure.
The UI/UX must feel native to Aria and match the existing Inventory Management sub-modules already built in this codebase.

## Session scope

In this session, implement only the current `CURRENT_WORKING_PAGE`, including:

1. Frontend page and all supporting frontend components
2. Backend APIs / procedures / services / validation / data access needed
3. Types and contracts required across layers
4. Business rules and server-side validation
5. Client-side validation and UX states
6. Permissions / authorization checks if the surrounding architecture requires them
7. Loading, empty, error, success, and edge-case states
8. Automated tests relevant to this page

## Important forward-prep instruction

Although this session is only for one page, you should also think one step ahead for the `Other Reports` sub-module as a whole.

If it is genuinely useful and low-risk, you may prepare shared groundwork that will make later `Other Reports` sessions easier, such as:
- shared schemas
- reusable report filter contracts
- common query parameter parsing
- shared backend report utilities
- report-specific types
- reusable table adapters
- reusable export helpers
- shared permission helpers
- test factories or fixtures
- route-local supporting abstractions for `Other Reports`

However:
- only prepare shared groundwork that is directly justified by the current page
- do not proactively implement other report pages
- do not add speculative abstractions with no immediate benefit
- do not over-engineer for hypothetical future pages
- keep the current page fully complete before optimizing for future sessions

Preserve a strong bias toward practical shared groundwork, not speculative architecture.

## Hard Constraints

### ERPNext reference usage
- Use ERPNext only as the functional reference.
- Study the target page and all related code paths in `.erpnext`.
- Inspect related doctypes, controllers, utilities, linked transactions, report logic, filters, aggregations, validations, export behavior if applicable, and dependent inventory concepts that affect the page.
- Recreate the behavior in Aria's architecture, not ERPNext's framework conventions.

### Design constraint
- Do not copy the ERPNext UI.
- Match Aria's existing design language, spacing, components, interaction patterns, route organization, and overall UX used in nearby inventory sub-modules.
- Reuse existing Aria patterns wherever possible.

### Frontend location constraint
All frontend files and folders for this page must lie inside the existing `Other Reports` frontend subtree under:

`apps/frontend/src/app/inventory`

Determine the exact `Other Reports` route subtree from the current Aria structure and keep all new frontend files for this page inside that subtree.

Do not place frontend files:
- inside the completed `inventory-tools` subtree
- inside the completed `key-reports` subtree
- outside the `Other Reports` subtree
- outside the `apps/frontend/src/app/inventory` subtree

### Engineering quality constraint
- Keep the implementation production-grade.
- No hacks, fake placeholders, dead code, temporary shortcuts, or TODO-driven incomplete logic.
- Do not break existing inventory modules.
- Follow existing naming conventions and nearby architectural patterns in Aria.
- Prefer consistency with current Aria modules over inventing a new pattern.
- Keep code strongly typed end-to-end.
- Do not use this task as an excuse to refactor unrelated completed sub-modules unless the change is directly required to support `CURRENT_WORKING_PAGE`.

## Required Working Process

### Phase 1: Discovery
1. Find the ERPNext implementation for `CURRENT_WORKING_PAGE` inside `.erpnext`.
2. Trace the full feature surface:
   - entry points
   - underlying models / doctypes
   - backend logic
   - filters
   - calculations / aggregations
   - validations
   - linked transactions
   - export behavior if applicable
   - permissions / role requirements
   - dependencies on other inventory concepts
3. Inspect nearby Aria inventory modules to understand existing conventions for:
   - routing
   - page composition
   - report pages
   - data fetching / mutations
   - filters
   - tables
   - validation
   - backend module structure
   - test patterns

### Phase 2: Functional spec before coding
Before making major changes, derive and internally confirm:
- what the page does
- what inputs / filters it requires
- what outputs it produces
- what business rules must hold
- what related entities it reads or writes
- what edge cases must be supported
- what can be safely adapted to Aria without losing functional parity
- what shared groundwork, if any, is worth preparing now for later `Other Reports` pages

Do not blindly mirror ERPNext implementation details if they are framework-specific or poor fits for Aria.
Preserve business behavior, not implementation accidents.

### Phase 3: Backend implementation
Implement all required backend support for the target page, including where needed:
- procedures / controllers / routes
- service-layer logic
- schema validation
- permission checks
- transactional safety where relevant
- data mapping / transformation
- aggregation / analytics logic
- output generation logic
- error handling
- shared report helpers only when directly justified by the current page

Make sure the backend behavior is robust and not just UI-deep.

### Phase 4: Frontend implementation
Implement the full Aria frontend experience for the target page inside the correct `Other Reports` subtree.

Requirements:
- Use Aria's existing UI and architectural patterns
- Build a polished page, not a rough scaffold
- Include all relevant states:
  - loading
  - empty
  - validation errors
  - server errors
  - success feedback where applicable
- Ensure the page is usable and coherent for real ERP workflows
- Keep the UX aligned with Aria's existing inventory pages, not ERPNext

### Phase 5: Testing
Create meaningful automated test coverage for this page.

Include all relevant layers that fit the existing repo patterns, such as:
- unit tests for business logic
- validation tests
- backend API / procedure tests
- frontend component or page behavior tests
- integration tests for important workflows
- end-to-end tests for the primary happy path and critical edge cases where appropriate

Minimum expectations:
- happy path
- invalid input
- authorization / permission failure where applicable
- missing dependency / linked-record failure cases
- boundary and edge cases from the ERPNext behavior
- regression protection for key business rules
- any shared groundwork introduced for `Other Reports` must also be covered by tests where appropriate

## Validation and verification

After implementation:
1. Run targeted validation for only the affected apps / packages / tests related to this work
2. Run targeted lint
3. Run targeted typecheck
4. Run targeted tests
5. Run any targeted build checks needed for confidence
6. Finally, when everything is completed, run `bun run validate:local` with zero errors and zero warnings

Do not run a wasteful full-monorepo validation unless it becomes necessary to verify a dependency chain until the final step.

Fix all issues introduced by your work before finishing.

## Deliverable standard

When complete, the result must be:
- functionally equivalent to the ERPNext report where it matters
- visually and architecturally native to Aria
- fully wired frontend to backend
- covered by meaningful tests
- ready for real use, not a mockup
- slightly easier to extend in the next `Other Reports` session where justified by the current work

## Final output format

At the end, give me a concise implementation report with:
1. What ERPNext behavior was replicated
2. What files were added or changed
3. Any intentional Aria-specific adaptations
4. What shared `Other Reports` groundwork was prepared for future sessions
5. What tests were added
6. What validation commands were run
7. Any remaining risks or follow-up suggestions, only if genuinely necessary

Now start with `CURRENT_WORKING_PAGE`, explore the ERPNext source in `.erpnext`, inspect nearby Aria inventory modules for patterns, implement the feature end-to-end in Aria, and prepare only the minimal useful shared groundwork that will help subsequent `Other Reports` pages.
