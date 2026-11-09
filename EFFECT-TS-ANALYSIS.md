# Effect-TS Adoption Analysis for Aria ERP

> Generated: 2026-06-04
> Based on: [Effect Documentation](https://effect.website/docs) + full codebase audit

## Executive Summary

Effect is a powerful TypeScript library that provides structured error handling, typed dependencies, fiber-based concurrency, schema validation, and observability — all tracked at the type level. This report evaluates what improvements Effect could bring to the Aria codebase, with specific file references, line counts, and honest assessments of trade-offs.

**Bottom line:** Effect could meaningfully improve 5 areas, but adopting it is a **major paradigm shift** that replaces Promises, try/catch, dependency injection, and Zod with an entirely different programming model. The benefits are real but so is the learning curve and migration cost. **Targeted improvements to the existing stack deliver 80% of the value at 10% of the cost.**

---

## Table of Contents

1. [Error Handling](#1-error-handling-high-impact)
2. [Dependency Injection / Service Layer](#2-dependency-injection--service-layer-medium-impact)
3. [Validation / Schema](#3-validation--schema-medium-impact)
4. [Concurrency & Resource Management](#4-concurrency--resource-management-low-medium-impact)
5. [Observability](#5-observability-low-impact-currently-high-potential)
6. [Frontend Impact](#6-frontend-impact-low-impact-high-disruption)
7. [Honest Assessment Matrix](#honest-assessment-matrix)
8. [Recommendation](#recommendation)
9. [Targeted Alternatives (Without Effect)](#targeted-alternatives-without-effect)
10. [Where Effect WOULD Make Sense](#where-effect-would-make-sense)

---

## 1. Error Handling (HIGH impact)

### Current State

The codebase uses NestJS HTTP exception classes thrown directly from services. There is **no global exception filter** — every service independently catches and re-maps Prisma errors. This pattern repeats ~40+ times:

```typescript
// Repeated in delivery.service.ts, item-catalog.service.ts, stock-transaction.service.ts, etc.
try {
  await prisma.someModel.delete({ where: { id } });
} catch (e) {
  if (e.code === 'P2025') throw new NotFoundException(`Record ${id} not found`);
  if (e.code === 'P2002') throw new ConflictException('Duplicate entry');
  throw e;
}
```

**Key pain points:**

| Problem | Location | Impact |
|---|---|---|
| No global exception filter | `apps/backend/src/main.ts` | Every service handles Prisma errors independently |
| Prisma `P2025` → `NotFoundException` repeated ~20x | `apps/backend/src/apps/inventory/services/*.ts` | Boilerplate, inconsistent handling |
| Prisma `P2002` → `ConflictException` repeated ~15x | `apps/backend/src/apps/inventory/services/*.ts`, `company.service.ts` | Same |
| NestJS exceptions escape tRPC as 500s | `apps/backend/src/trpc/trpc.ts` | `BadRequestException` from services becomes generic 500 in tRPC responses |
| tRPC has its own error codes (`TRPCError`) | `apps/backend/src/trpc/trpc.ts:69-73` | Two error systems not bridged |
| Auth error helpers are private | `apps/backend/src/auth/auth.service.ts:16-56` | `getSafeErrorMessage()`, `getErrorDetails()` useful but inaccessible |

**Specific file references:**

- `apps/backend/src/apps/inventory/services/delivery.service.ts:627-638, 933-941, 1214-1222` — Prisma P2025 handling
- `apps/backend/src/apps/inventory/services/inventory-shared.ts:471-486` — `isDefaultItemManufacturerConstraintViolation` inspects P2002 metadata
- `apps/backend/src/apps/inventory/services/item-catalog.service.ts:247-248, 304-305, 413-414, 515-516` — repeated catch blocks
- `apps/backend/src/apps/asset/asset.service.ts:285-349, 450, 705-708, 844-848, 1091-1097` — validation exceptions
- `apps/backend/src/apps/company/company.service.ts:91, 101, 137, 149, 165, 216, 224, 234, 315, 324, 328` — conflict/bad-request exceptions

### With Effect

Effect's core insight: **errors are tracked at the type level** alongside success values.

```typescript
// Current: error is invisible in the type signature
const getDeliveryNote = async (id: string): Promise<DeliveryNote> => {
  const note = await prisma.deliveryNote.findUnique({ where: { id } });
  if (!note) throw new NotFoundException(`Delivery note ${id} not found`);
  return note;
};

// With Effect: error is part of the type
const getDeliveryNote = (id: string): Effect.Effect<DeliveryNote, NotFoundError> =>
  Effect.gen(function* () {
    const note = yield* PrismaService.findUnique('deliveryNote', { where: { id } });
    if (!note) return yield* Effect.fail(new NotFoundError(`Delivery note ${id} not found`));
    return note;
  });
```

Effect's `catchTag` replaces repeated try/catch blocks:

```typescript
// Instead of 40+ try/catch blocks for Prisma errors:
const program = Effect.gen(function* () {
  // ... business logic
}).pipe(
  Effect.catchTag('PrismaClientKnownRequestError', (e) => {
    if (e.code === 'P2025') return Effect.fail(new NotFoundError(e.message));
    if (e.code === 'P2002') return Effect.fail(new ConflictError(e.message));
    return Effect.fail(new DatabaseError(e.message));
  })
);
```

### Estimated Improvement

- **~500-800 lines of boilerplate error handling removed** across backend services
- **Compile-time guarantee** that every error path is handled (currently, unhandled Prisma errors can escape as 500s)
- Eliminates the NestJS→tRPC error bridging problem entirely
- Single Prisma error mapper layer replaces ~40 duplicated catch blocks

---

## 2. Dependency Injection / Service Layer (MEDIUM impact)

### Current State

The codebase uses a two-tier service pattern:

```
InventoryService (facade) — 100+ pass-through methods
  ├── WarehouseSubService (plain class, manual instantiation)
  ├── BatchSubService
  ├── DeliverySubService
  ├── StockTransactionSubService
  ├── ItemCatalogSubService
  ├── ... (10+ more sub-services)
  └── SettingsSubService

AssetService (monolith) — ~3200 lines
  └── AssetDashboardSubService (only sub-service)

CompanyService (monolith) — no sub-services
```

**Key pain points:**

| Problem | Location | Impact |
|---|---|---|
| Sub-services are plain classes, not NestJS providers | `apps/backend/src/apps/inventory/services/*.ts` | Cannot use NestJS DI for their own dependencies |
| `InventoryService` is pure pass-through | `apps/backend/src/apps/inventory/inventory.service.ts:31-1000` | 100+ methods that just delegate — zero value |
| `AssetService` monolith | `apps/backend/src/apps/asset/asset.service.ts` | ~3200 lines covering assets, locations, categories, maintenance, reports |
| `PrismaService` has 70+ getter accessors | `apps/backend/src/shared/prisma.service.ts:56-283` | Must be updated every time a new model is added |
| Sub-services instantiated manually | `apps/backend/src/apps/inventory/inventory.service.ts:31-61` | `new DeliverySubService(prisma)` — no DI |

### With Effect

Effect's `Context.Tag` + `Layer` provides typed, composable dependency injection:

```typescript
// Define a service tag
class PrismaService extends Context.Tag("PrismaService")<PrismaService, {
  readonly client: PrismaClient;
}>() {}

// Declare dependencies in the type signature
const getDeliveryNote = (id: string): Effect.Effect<DeliveryNote, NotFoundError, PrismaService> =>
  Effect.gen(function* () {
    const prisma = yield* PrismaService;
    // ...
  });

// Provide implementations via Layers
const program = getDeliveryNote("abc123").pipe(
  Effect.provide(Layer.succeed(PrismaService, { client: mockPrisma }))
);
```

Benefits:
- Dependencies are **declared in the type** — `Effect<Success, Error, PrismaService | AuthService>` means "needs Prisma and Auth to run"
- No facade pass-through pattern needed — routers depend directly on domain services
- Testing becomes trivial: `Layer.succeed(Prisma, mockPrisma)` replaces NestJS testing modules
- Layers compose and memoize automatically

### Estimated Improvement

- Eliminate `InventoryService` facade (~1000 lines of pure delegation)
- Sub-services get proper dependency declarations in their types
- Testing becomes more straightforward with Layer-based mocking

### Risk

Effect's DI is fundamentally different from NestJS `@Injectable()`. **Mixing both in the same codebase is awkward.** You'd need to either:
- Rewrite all NestJS modules as Effect Layers (massive effort)
- Run Effect inside NestJS services (possible but loses many benefits)

---

## 3. Validation / Schema (MEDIUM impact)

### Current State

- All Zod schemas live in `packages/types/src/index.ts` — a **6700+ line monolith**
- Double validation: frontend form schemas + API input schemas validate the same data twice
- Inline `z.object({ id: z.string().cuid() })` duplicated 50+ times in routers
- Manual validation in services (e.g., `validateDepreciationFields` in `asset.service.ts:267-350` — 80+ lines of if/throw)
- Mixed approaches: Zod schemas (types package), manual if/throw (services), Prisma constraints (DB)

**Specific references:**

- `packages/types/src/index.ts` — 6700+ lines, all domain schemas in one file
- `apps/backend/src/apps/inventory/trpc/inventory.router.ts:54-60, 769-805` — inline Zod schemas
- `apps/frontend/src/app/inventory/(protected)/inventory-settings/warehouse/form/page.tsx:176-205` — double validation pattern
- `apps/frontend/src/app/asset/(protected)/asset-maintenance/maintenance/asset-maintenance.schema.ts` — `.superRefine()` with conditional validation

### With Effect Schema

Effect Schema provides **bidirectional** validation from a single definition:

```typescript
// One schema, two directions
const WarehouseSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  disabled: Schema.optionalWith(Schema.Boolean, { exact: true }),
  createdAt: Schema.DateFromString,
});

// Decode: unknown → Warehouse (validation)
const decode = Schema.decodeUnknownSync(WarehouseSchema);

// Encode: Warehouse → Encoded (serialization)
const encode = Schema.encodeSync(WarehouseSchema);

// Auto-generated: JSON Schema, arbitraries, pretty printer, Equivalence
const jsonSchema = Schema.make(WarehouseSchema); // JSON Schema
const arbitrary = Arbitrary.make(WarehouseSchema); // fast-check arbitrary
const equivalence = Equivalence.make(WarehouseSchema); // deep equality
```

Benefits over Zod:
- **Single definition** replaces the current double-validation pattern (form + API)
- Auto-generated JSON Schema for API documentation
- Auto-generated arbitraries for property-based testing
- Bidirectional: encode + decode from one schema
- Standard Schema V1 compatibility (works with react-hook-form)

### Estimated Improvement

- Eliminates double validation (~50% reduction in schema code on frontend)
- Auto-generated test data via arbitraries
- Single source of truth for validation rules

### Risk

Effect Schema is heavier than Zod, and the team already knows Zod well. **The ROI of replacing Zod is marginal unless you adopt Effect for other reasons too.** A simpler win: split the monolith types file into per-domain files.

---

## 4. Concurrency & Resource Management (LOW-MEDIUM impact)

### Current State

| Pattern | Location | Description |
|---|---|---|
| `Promise.all` for parallel queries | `apps/backend/src/apps/asset/asset.service.ts:674-683` | Paginated list + count |
| `Promise.all` for dashboard | `apps/backend/src/apps/asset/asset-dashboard.service.ts:32-35, 55-61, 73-76` | Multiple aggregates in parallel |
| `Promise.all` in auth | `apps/backend/src/auth/auth.config.ts:132-143` | User + session lookup |
| `$transaction` for atomicity | `apps/backend/src/apps/inventory/services/delivery.service.ts:423-616, 821-919` | Multi-step writes |
| Row-level locking | `apps/backend/src/apps/inventory/services/delivery.service.ts:40-59` | `SELECT ... FOR UPDATE` |
| Dead retry helper | `apps/backend/src/apps/inventory/services/inventory-shared.ts:501-510` | `computeBackoffMs()` defined but unused |
| No `Promise.allSettled` | Dashboard queries | One failing query fails the entire dashboard |

### With Effect

```typescript
// Current: one failure kills everything
const [kpis, movements, warehouses] = await Promise.all([
  getKPIs(), getMovements(), getWarehouses()
]);

// With Effect: partial failure support
const [kpis, movements, warehouses] = yield* Effect.all(
  [getKPIs(), getMovements(), getWarehouses()],
  { concurrency: "unbounded", mode: "either" }
);
// Each result is Either<Error, Data> — show degraded data instead of full-page error

// Built-in retry with backoff
const resilientQuery = getDeliveryNote(id).pipe(
  Effect.retry(Schedule.exponential(Duration.millis(100)).pipe(
    Schedule.compose(Schedule.recurs(3))
  ))
);

// Resource safety — guaranteed cleanup
const withTransaction = Effect.acquireUseRelease(
  acquirePrismaTransaction(),
  (tx) => doWork(tx),
  (tx) => Effect.sync(() => tx.rollback())
);
```

### Estimated Improvement

- Dashboard queries become resilient: partial failures show degraded data instead of full-page errors
- Retry logic for transient Prisma connection errors (currently none)
- Guaranteed resource cleanup via `acquireUseRelease`

### Assessment

**Marginal improvement for current scale.** The codebase doesn't have complex concurrency needs beyond `Promise.all` and `$transaction`. The dead `computeBackoffMs` helper suggests retry was tried and removed. `Promise.allSettled` (standard JS) solves the dashboard resilience problem without Effect.

---

## 5. Observability (LOW impact currently, HIGH potential)

### Current State

- Basic `console.*` logging via `packages/utils/src/logger.ts` (45 lines)
- Prometheus metrics via `@willsoto/nestjs-prometheus` + `prom-client`
- Sentry for frontend error tracking
- No distributed tracing
- `apps/backend/src/main.ts:15-25` — global unhandled rejection logger

### With Effect

```typescript
// Structured logging with annotations
const program = Effect.gen(function* () {
  yield* Effect.log("Processing delivery note").pipe(
    Effect.annotateLogs("deliveryNoteId", id),
    Effect.annotateLogs("orgId", orgId)
  );
  // ...
}).pipe(
  Effect.withSpan("DeliveryService.create"),
  Effect.logSpan("delivery-note-creation")
);

// Automatic tracing via @effect/opentelemetry
const TracingLive = NodeSdk.layer(() => ({
  resource: { serviceName: "aria-backend" },
  traceExporter: new OTLPTraceExporter(),
}));

// Metrics
const requestCounter = Metric.counter("http_requests");
const program = Effect.gen(function* () {
  yield* Metric.increment(requestCounter);
  // ...
});
```

### Estimated Improvement

- Automatic request tracing through the entire service chain
- Correlation IDs propagated through Effect's context system
- Unified logging, tracing, and metrics from one system

### Assessment

**Only valuable at scale.** Current single-instance deployment with Prometheus + Sentry is sufficient. Effect's observability shines when you have multiple services that need correlated tracing.

---

## 6. Frontend Impact (LOW impact, HIGH disruption)

### Current State

- tRPC + React Query provides excellent type-safe data fetching (155 `useQuery` calls, 140 `useMutation` calls)
- Zustand barely used (1 store for Kanban board)
- Zod + react-hook-form works well for forms (146 `useForm` calls, 13 schema files)
- Well-built error library (`lib/errors/`) with `parseError()`, `getToastMessage()`, error UI components
- `nuqs` for URL state management

### With Effect on Frontend

- Effect adds **~45KB gzipped** to the bundle
- `Effect.gen` replaces async/await with generator syntax — different mental model
- Effect's `Stream` could replace WebSocket subscription patterns
- Effect Schema could unify form validation

### Assessment

**Minimal practical benefit.** tRPC + React Query already provides the type safety and caching that Effect would add. The bundle size increase is non-trivial for a frontend-heavy ERP. The team would need to learn a new paradigm for marginal improvement.

---

## Honest Assessment Matrix

| Area | Current Quality | Effect Improvement | Effort to Migrate | Worth It? |
|---|---|---|---|---|
| Error handling | Repetitive but functional | High (~500-800 lines removed) | High (rewrite every service) | Yes, if adopting Effect anyway |
| DI / Services | NestJS DI + manual sub-services | Medium (typed deps, no facade) | Very High (replace NestJS modules) | No — NestJS DI is fine |
| Validation | Zod v4, monolith file | Medium (bidirectional schemas) | High (replace Zod everywhere) | No — split the Zod file instead |
| Concurrency | Promise.all + transactions | Low-Medium (retry, resilience) | Medium | No — current patterns work |
| Observability | Basic logging + Prometheus | High potential | Medium | Not yet — single instance |
| Frontend | tRPC + React Query | Low | Very High (rewrite all hooks) | No — worse DX than current stack |

---

## Recommendation

### Do NOT adopt Effect for this codebase right now.

**Reasons:**

1. **The team is already productive** with NestJS + tRPC + Zod + Prisma. Effect would require rewriting every service, every router, and most frontend code.

2. **The biggest pain points have simpler fixes** — see [Targeted Alternatives](#targeted-alternatives-without-effect) below.

3. **Effect's value shines at scale** — when you need fiber-based concurrency, distributed tracing, or complex resource management. Aria is a single-instance ERP with straightforward CRUD + reports.

4. **The migration cost is enormous** — every `async function` becomes `Effect.gen`, every `throw` becomes `Effect.fail`, every NestJS module becomes a `Layer`. This is a **3-6 month rewrite** for a team of 1-3 developers.

5. **Effect's learning curve is steep** — generator syntax, monadic composition, type-level requirement tracking, and the Layer system are unfamiliar to most TypeScript developers. The team would be slower for months before becoming faster.

---

## Targeted Alternatives (Without Effect)

These fixes address the same pain points at 10% of the migration cost:

### Fix 1: Shared Prisma Error Mapper (~30 lines)

```typescript
// apps/backend/src/common/prisma-error.mapper.ts
export function mapPrismaError(e: unknown, entityName: string, id?: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2025') throw new NotFoundException(`${entityName} ${id ?? ''} not found`);
    if (e.code === 'P2002') throw new ConflictException(`Duplicate ${entityName} entry`);
    if (e.code === 'P2003') throw new BadRequestException(`Referenced ${entityName} does not exist`);
  }
  throw e;
}
```

Replaces ~40 duplicated catch blocks across services.

### Fix 2: tRPC Error Bridge Middleware (~40 lines)

```typescript
// apps/backend/src/trpc/trpc-error.middleware.ts
export const errorHandlingMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (e) {
    if (e instanceof NotFoundException) throw new TRPCError({ code: 'NOT_FOUND', message: e.message });
    if (e instanceof BadRequestException) throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
    if (e instanceof ConflictException) throw new TRPCError({ code: 'CONFLICT', message: e.message });
    if (e instanceof UnauthorizedException) throw new TRPCError({ code: 'UNAUTHORIZED', message: e.message });
    throw e;
  }
});
```

Bridges NestJS exceptions to tRPC error codes.

### Fix 3: Split Monolith Types File

Split `packages/types/src/index.ts` (6700+ lines) into:
- `packages/types/src/inventory/index.ts`
- `packages/types/src/asset/index.ts`
- `packages/types/src/company/index.ts`
- `packages/types/src/shared.ts`

### Fix 4: Decompose AssetService

Split `apps/backend/src/apps/asset/asset.service.ts` (~3200 lines) into:
- `asset-crud.service.ts` — basic CRUD
- `asset-depreciation.service.ts` — depreciation calculations
- `asset-location.service.ts` — location management
- `asset-maintenance.service.ts` — maintenance records/teams
- `asset-report.service.ts` — reports

Follow the same sub-service pattern as `InventoryService`.

### Fix 5: Deduplicate Inline Zod Schemas

Extract `z.object({ id: z.string().cuid() })` and other repeated schemas into `packages/types`:
```typescript
// packages/types/src/shared.ts
export const cuidIdSchema = z.object({ id: z.string().cuid() });
export const bulkDeleteSchema = z.object({ ids: z.array(z.string().cuid()).min(1) });
```

Eliminates 50+ inline schema definitions in routers.

### Fix 6: Use `Promise.allSettled` for Dashboards

Replace `Promise.all` with `Promise.allSettled` in dashboard queries to show degraded data instead of full-page errors on partial failures.

### Fix 7: Remove Dead Code

Delete `computeBackoffMs()` in `apps/backend/src/apps/inventory/services/inventory-shared.ts:501-510` — it's defined but unused.

---

## Where Effect WOULD Make Sense

If Aria grows to any of these, revisit Effect adoption:

- **Multiple backend instances** — need for distributed tracing, event sourcing, saga patterns
- **Complex workflow orchestration** — multi-step processes with compensation/rollback
- **High-throughput data processing** — streams, batching, backpressure
- **Unified stack paradigm** — one mental model from database to UI
- **Team growth beyond 5 developers** — Effect's type-level guarantees prevent entire categories of bugs at scale

### Recommended Adoption Path (If Pursued)

1. **Phase 1** — Add Effect for new utility packages only (e.g., rewrite `packages/utils` with Effect)
2. **Phase 2** — Use Effect in one new domain module (not a rewrite of existing code)
3. **Phase 3** — If Phase 1-2 prove valuable, migrate services one at a time
4. **Phase 4** — Replace Zod with Effect Schema in `packages/types`
5. **Phase 5** — Consider frontend adoption only if backend migration was smooth

**Estimated full migration timeline:** 3-6 months for a team of 1-3 developers, with reduced productivity during the learning curve.

---

## References

- [Effect Documentation](https://effect.website/docs)
- [Why Effect?](https://effect.website/docs/getting-started/why-effect/)
- [Effect vs Promise](https://effect.website/docs/additional-resources/effect-vs-promise/)
- [Effect Schema](https://effect.website/docs/schema/introduction/)
- [Effect Services](https://effect.website/docs/requirements-management/services/)
- [Effect Error Management](https://effect.website/docs/error-management/two-error-types/)
- [Myths About Effect](https://effect.website/docs/additional-resources/myths/)
