You are working inside the Aria ERP monorepo.

CURRENT_WORKING_PAGE = "Quality Inspection Template"

Your task is to fully implement the target page end-to-end in Aria by studying the equivalent ERPNext implementation from the `.erpnext` folder at the root of the monorepo, then recreating its business functionality in Aria.

Important: `CURRENT_WORKING_PAGE` is the single source of truth for this task. Do not require me to edit the page name anywhere else.

## Objective

Explore the ERPNext source for the target page, understand how it works, and replicate the feature in Aria with Aria's own architecture, UI patterns, and code quality standards.

Replicate functionality, workflows, validations, calculations, edge cases, permissions, data flow, and expected user outcomes.

Do NOT copy ERPNext's design, UI, styling, layout, markup, wording quirks, or visual structure. The UI/UX must feel native to Aria and match the existing Inventory Management sub-modules already built in this codebase.

## Scope

Implement the target page end-to-end, including:

1. Frontend page and all supporting frontend components
2. Backend APIs / procedures / services / validation / data access needed
3. Types and contracts required across layers
4. Business rules and server-side validation
5. Client-side validation and UX states
6. Permissions / authorization checks if the surrounding architecture requires them
7. Loading, empty, error, success, and edge-case states
8. Automated tests end-to-end

## Hard Constraints

### ERPNext reference usage
- Use ERPNext only as the functional reference.
- Study the target page and all related code paths in `.erpnext`.
- Inspect related doctypes, controllers, utilities, print / document generation logic, linked transactions, and any dependent models or workflows that affect the page.
- Recreate the behavior in Aria's architecture, not ERPNext's framework conventions.

### Design constraint
- Do not copy the ERPNext UI.
- Match Aria's existing design language, spacing, components, interaction patterns, route organization, and overall UX used in nearby inventory sub-modules.
- Reuse existing Aria patterns wherever possible.

### Frontend location constraint
All frontend files and folders for this page must lie inside:

`apps/frontend/src/app/inventory/inventory-tools`

Do not place frontend files outside that subtree.

### Engineering quality constraint
- Keep the implementation production-grade.
- No hacks, fake placeholders, dead code, temporary shortcuts, or TODO-driven incomplete logic.
- Do not break existing inventory modules.
- Follow existing naming conventions and nearby architectural patterns in Aria.
- Prefer consistency with current Aria modules over inventing a new pattern.
- Keep code strongly typed end-to-end.

## Required Working Process

### Phase 1: Discovery
1. Find the ERPNext implementation for `CURRENT_WORKING_PAGE` inside `.erpnext`.
2. Trace the full feature surface:
   - entry points
   - underlying models / doctypes
   - backend logic
   - validations
   - linked transactions
   - status handling
   - print or output generation behavior if applicable
   - permissions / role requirements
   - dependencies on other inventory concepts
3. Inspect nearby Aria inventory modules to understand existing conventions for:
   - routing
   - page composition
   - data fetching / mutations
   - tables, forms, dialogs, drawers, filters
   - validation
   - backend module structure
   - test patterns

### Phase 2: Functional spec before coding
Before making major changes, derive and internally confirm:
- what the page does
- what inputs it requires
- what outputs it produces
- what business rules must hold
- what related entities it reads or writes
- what edge cases must be supported
- what can be safely adapted to Aria without losing functional parity

Do not blindly mirror ERPNext implementation details if they are framework-specific or poor fits for Aria. Preserve business behavior, not implementation accidents.

### Phase 3: Backend implementation
Implement all required backend support for the target page, including where needed:
- procedures / controllers / routes
- service-layer logic
- schema validation
- permission checks
- transactional safety
- data mapping / transformation
- output generation logic
- error handling
- audit-friendly behavior where appropriate

Make sure the backend behavior is robust and not just UI-deep.

### Phase 4: Frontend implementation
Implement the full Aria frontend experience for the target page inside:

`apps/frontend/src/app/inventory/inventory-tools`

Requirements:
- Use Aria's existing UI and architectural patterns
- Build a polished page, not a rough scaffold
- Include all relevant states:
  - loading
  - empty
  - validation errors
  - server errors
  - success feedback
- Ensure the page is usable and coherent for real ERP workflows
- Keep the UX aligned with Aria's existing inventory pages, not ERPNext

### Phase 5: Testing
Create complete automated test coverage for the feature.

Include all relevant layers that fit the existing repo patterns, such as:
- unit tests for business logic
- validation tests
- backend API / procedure tests
- frontend component or page behavior tests
- integration tests for important workflows
- end-to-end tests for the primary happy path and critical edge cases

Minimum expectations:
- happy path
- invalid input
- authorization / permission failure where applicable
- missing dependency / linked-record failure cases
- boundary and edge cases from the ERPNext behavior
- regression protection for the key business rules

## Validation and verification

After implementation:
1. Run targeted validation for only the affected apps / packages / tests related to this work
2. Run targeted lint
3. Run targeted typecheck
4. Run targeted tests
5. Run any targeted build checks needed for confidence
6. Finally, when everything is completed run 'bun run validate:local' with zero errors and warnings

Do not run a wasteful full-monorepo validation unless it becomes necessary to verify a dependency chain until the final step.

Fix all issues introduced by your work before finishing.

## Deliverable standard

When complete, the result must be:
- functionally equivalent to the ERPNext page where it matters
- visually and architecturally native to Aria
- fully wired frontend to backend
- covered by meaningful tests
- ready for real use, not a mockup

## Final output format

At the end, give me a concise implementation report with:
1. What ERPNext behavior was replicated
2. What files were added or changed
3. Any intentional Aria-specific adaptations
4. What tests were added
5. What validation commands were run
6. Any remaining risks or follow-up suggestions, only if genuinely necessary

Now start with `CURRENT_WORKING_PAGE`, explore the ERPNext source in `.erpnext`, inspect nearby Aria inventory modules for patterns, then implement the feature end-to-end in Aria.