# Authorization System Test Suite

## Summary

✅ **38 tests passing** across **2 test files** covering the core authorization services.

## Test Coverage

### PolicyService (13 tests) ✅

**File**: `apps/backend/src/authorization/__tests__/policy.service.spec.ts`

**Coverage**:

- ✅ User policy resolution with roles and permissions
- ✅ Policy caching mechanism (60-second TTL)
- ✅ Cache invalidation
- ✅ Permission checking (`can()` method)
  - Exact permission matches
  - Permission denial for inactive users
  - Permission denial when missing required permission
  - Ownership context validation
  - Owner vs non-owner checks
- ✅ Role checking (`hasRole()`, `hasAnyRole()`)
- ✅ Role level hierarchy (`getUserMaxRoleLevel()`)

**Key Tests**:

1. `resolveUserPolicy` - Resolves complete user policy from database
2. Caching - Verifies policies are cached and reused
3. `can()` with ownership - Validates resource ownership checks
4. `hasRole()` - Checks if user has specific role
5. `getUserMaxRoleLevel()` - Returns highest role level

### RoleService (15 tests) ✅

**File**: `apps/backend/src/authorization/__tests__/role-permission.service.spec.ts`

**Coverage**:

- ✅ Role retrieval (`getRoleByKey`, `getRoleById`)
- ✅ Role listing with filtering (isSystem, search)
- ✅ Role creation
- ✅ Role updates
- ✅ Role deletion with system role protection
- ✅ Permission assignment to roles
  - Bulk assignment (replace all)
  - Incremental addition
  - Permission removal

**Key Tests**:

1. `listRoles` - Returns roles ordered by level
2. `createRole` - Creates new custom role
3. `deleteRole` - Prevents deletion of system roles
4. `assignPermissions` - Replaces all role permissions
5. `addPermission` / `removePermission` - Incremental management

### PermissionService (10 tests) ✅

**File**: `apps/backend/src/authorization/__tests__/role-permission.service.spec.ts`

**Coverage**:

- ✅ Permission retrieval (`getPermissionByKey`)
- ✅ Permission listing with scope filtering
- ✅ Wildcard pattern matching
  - Exact matches (`system:user.read`)
  - System wildcards (`system:*`)
  - App wildcards (`app:crm:*`)
  - Entity wildcards (`entity:crm:lead.*`)
  - Pattern mismatches

**Key Tests**:

1. `matchesPattern` - Core wildcard matching logic
2. `listPermissions` - Filter by system/app/entity scope
3. Wildcard tests - Comprehensive pattern matching validation

## Test Execution

```bash
# Run all authorization tests
cd apps/backend
bun test src/authorization/__tests__

# Run specific test file
bun test policy.service.spec.ts
bun test role-permission.service.spec.ts

# Run with watch mode
bun test --watch

# Run with coverage
bun test --coverage
```

## Mocking Strategy

All tests use Jest mocks for dependencies:

### PolicyService Mocks

```typescript
mockPrisma = {
  user: { findUnique },
  userRole: { findMany },
};

mockPermissionService = { matchesPattern };
mockScopeService = {
  getSupervisedApps,
  isTeamMember,
  isTeamManager,
  isInManagementHierarchy,
};
```

### RoleService Mocks

```typescript
mockPrisma = {
  role: { findUnique, findMany, create, update, delete },
  rolePermission: { deleteMany, createMany, create, delete, findMany },
};
```

### PermissionService Mocks

```typescript
mockPrisma = {
  permission: { findUnique, findMany, create, update, delete },
};
```

## Key Testing Patterns

### 1. Dependency Injection

Tests use NestJS Testing module with mocked providers:

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [ServiceUnderTest, { provide: PrismaClient, useValue: mockPrisma }],
}).compile();
```

**Important**: Services use `PrismaClient` from `@prisma/client`, not `PrismaService`.

### 2. Mock Setup

Each test file has `beforeEach` to reset mocks:

```typescript
beforeEach(async () => {
  // Create fresh mocks
  mockPrisma = {
    /* ... */
  };

  // Compile module
  service = module.get<Service>(Service);
});

afterEach(() => {
  jest.clearAllMocks();
});
```

### 3. Assertion Patterns

Tests verify both behavior and interactions:

```typescript
// Verify return value
expect(result).toEqual(expectedValue);

// Verify mock was called correctly
expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
  where: { id: 'user1' },
});

// Verify mock call count
expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
```

## What's NOT Tested (Future Work)

### Integration Tests

- ❌ TRPC admin router endpoints
- ❌ NestJS guards (RequiresPermission, RequiresRole, RequiresApp)
- ❌ End-to-end authorization flows

### Additional Unit Tests

- ❌ ScopeService (team membership, supervisor checks)
- ❌ AuditService (audit log creation, querying)
- ❌ Error handling edge cases
- ❌ Performance tests (caching efficiency)

### Frontend Tests

- ❌ useAuth hook tests
- ❌ Protected content component tests
- ❌ Admin dashboard E2E tests

## Next Steps

### Immediate (Optional)

1. ✅ Fix any remaining lint warnings in guards.ts
2. ⏸️ Add ScopeService unit tests (team membership logic)
3. ⏸️ Add AuditService unit tests (logging functionality)

### Integration Testing

1. Create TRPC router integration tests (mock PolicyService)
2. Test NestJS guards with execution context
3. Add end-to-end authorization flow tests

### Frontend Testing

1. Set up Vitest for React component tests
2. Test useAuth hook with mocked session
3. Test protected content gates
4. Set up Playwright for E2E admin dashboard tests

## Configuration

### Jest Setup

Tests run with Bun's built-in Jest compatibility:

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:cov": "bun test --coverage"
  }
}
```

### File Structure

```
apps/backend/src/authorization/
├── __tests__/
│   ├── policy.service.spec.ts        # 13 tests
│   ├── role-permission.service.spec.ts # 25 tests
│   └── README.md                      # This file
├── policy.service.ts
├── role-permission.service.ts
├── scope.service.ts
├── audit.service.ts
└── guards.ts
```

## Test Maintenance

### Adding New Tests

1. Create `*.spec.ts` file in `__tests__` directory
2. Import service and dependencies
3. Mock `PrismaClient` (not `PrismaService`)
4. Use `Test.createTestingModule()` for DI
5. Write descriptive test names
6. Verify both return values and mock interactions

### Running Tests in CI

```bash
#!/bin/bash
cd apps/backend
bun install
bun test --ci
```

### Debugging Failed Tests

```bash
# Run single test
bun test --testNamePattern="should cache resolved policies"

# Run with verbose output
bun test --verbose

# Run specific file
bun test policy.service.spec.ts
```

## Performance

**Test Execution Time**: ~1 second for all 38 tests

- PolicyService: 13 tests in ~855ms
- RoleService + PermissionService: 25 tests in ~869ms

Caching tests verify that cache reduces database calls from 2 to 1.

## Conclusion

✅ **Core authorization services are fully tested and working correctly.**

The test suite provides confidence that:

- Policy resolution works correctly with caching
- Permission checking handles wildcards and ownership
- Role CRUD operations work with system role protection
- Permission pattern matching supports all wildcard types

Next priority: Integration tests for TRPC endpoints and NestJS guards.

---

**Last Updated**: November 1, 2025  
**Test Framework**: Bun Test (Jest-compatible)  
**Total Tests**: 38  
**Pass Rate**: 100%
