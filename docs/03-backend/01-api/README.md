# tRPC API Documentation

> Type-safe API documentation for the Aria ERP backend

**Transport**: tRPC over HTTP and WebSocket  
**Base URL**: `http://localhost:3001/trpc` (development)  
**Authentication**: Session-based via better-auth cookies

## Overview

Aria ERP uses **tRPC** for all frontend-backend communication. tRPC provides end-to-end type safety — the frontend imports the `AppRouter` type from `@aria/api-contract` and gets full autocomplete and compile-time checking for all API calls.

There is **no REST API**. All operations go through tRPC procedures.

## Authentication

### Session-Based Auth (better-auth)

Authentication is handled by better-auth, which manages sessions via HTTP cookies. The auth endpoints are served at `/api/auth/*` (not through tRPC).

**Login flow:**

1. POST to `/api/auth/sign-in/email` with credentials
2. better-auth sets a session cookie
3. All subsequent tRPC calls include the cookie automatically
4. The `isAuthenticated` middleware validates the session

### Procedure Types

- **`publicProcedure`** — No authentication required
- **`protectedProcedure`** — Requires valid session; injects `user` and `session` into context

## Router Structure

The `AppRouter` is composed of four sub-routers:

```
AppRouter
├── inventory.*        # Inventory module (CRUD + reports + real-time)
├── admin.*            # User/role/permission management + audit
├── authorization.*    # User authorization data queries
└── account.*          # Account self-service
```

## Inventory Router

The inventory router is the largest, covering all inventory management operations. Key procedure groups:

### Item Catalog

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.listItems` | Query | List items with pagination, search, filters |
| `inventory.getItem` | Query | Get item by ID |
| `inventory.createItem` | Mutation | Create a new inventory item |
| `inventory.updateItem` | Mutation | Update item fields |
| `inventory.deleteItem` | Mutation | Delete an item |
| `inventory.listItemGroups` | Query | List item groups (hierarchical) |
| `inventory.createItemGroup` | Mutation | Create item group |
| `inventory.listBrands` | Query | List brands |
| `inventory.createBrand` | Mutation | Create brand |

### Warehouses

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.listWarehouses` | Query | List warehouses with filters |
| `inventory.getWarehouse` | Query | Get warehouse by ID |
| `inventory.createWarehouse` | Mutation | Create warehouse |
| `inventory.updateWarehouse` | Mutation | Update warehouse |
| `inventory.deleteWarehouse` | Mutation | Delete warehouse |

### Units of Measure

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.listUom` | Query | List units of measure |
| `inventory.createUom` | Mutation | Create UOM |
| `inventory.listUomConversions` | Query | List UOM conversion factors |
| `inventory.createUomConversion` | Mutation | Create conversion factor |

### Stock Transactions

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.listStockEntries` | Query | List stock entries |
| `inventory.createStockEntry` | Mutation | Create stock entry (receipt/issue/transfer) |
| `inventory.getStockLedger` | Query | Get stock ledger entries |
| `inventory.stockReconciliation` | Mutation | Reconcile stock quantities |

### Batch & Serial Numbers

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.listBatches` | Query | List batches |
| `inventory.createBatch` | Mutation | Create batch |
| `inventory.listSerialNos` | Query | List serial numbers |
| `inventory.createSerialNo` | Mutation | Create serial number |

### Purchase Receipts

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.listPurchaseReceipts` | Query | List purchase receipts |
| `inventory.createPurchaseReceipt` | Mutation | Create purchase receipt with items |
| `inventory.submitPurchaseReceipt` | Mutation | Submit (finalize) a purchase receipt |

### Delivery Notes

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.listDeliveryNotes` | Query | List delivery notes |
| `inventory.createDeliveryNote` | Mutation | Create delivery note |
| `inventory.submitDeliveryNote` | Mutation | Submit delivery note |

### Reports

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.stockBalance` | Query | Current stock balance per warehouse |
| `inventory.stockProjectedQty` | Query | Projected stock quantities |
| `inventory.stockAgeing` | Query | Stock ageing analysis |
| `inventory.itemShortageReport` | Query | Items below reorder level |

### Settings

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.getSettings` | Query | Get inventory settings |
| `inventory.updateSettings` | Mutation | Update inventory settings |
| `inventory.getStockSettings` | Query | Get stock settings |
| `inventory.updateStockSettings` | Mutation | Update stock settings |

### Real-Time Subscriptions

| Procedure | Type | Description |
|-----------|------|-------------|
| `inventory.onStockUpdate` | Subscription | Real-time stock level changes |

## Admin Router

Permission-gated endpoints for system administration.

### User Management

| Procedure | Type | Description |
|-----------|------|-------------|
| `admin.listUsers` | Query | List users with pagination and search |
| `admin.createUser` | Mutation | Create new user |
| `admin.updateUser` | Mutation | Update user details |
| `admin.disableUser` | Mutation | Disable user account |
| `admin.enableUser` | Mutation | Enable user account |
| `admin.assignRole` | Mutation | Assign role to user |
| `admin.revokeRole` | Mutation | Remove role from user |

### Role Management

| Procedure | Type | Description |
|-----------|------|-------------|
| `admin.listRoles` | Query | List all roles |
| `admin.createRole` | Mutation | Create new role |
| `admin.updateRole` | Mutation | Update role |
| `admin.deleteRole` | Mutation | Delete role (system roles protected) |
| `admin.assignPermissionToRole` | Mutation | Assign permission to role |
| `admin.removePermissionFromRole` | Mutation | Remove permission from role |

### Permissions & Audit

| Procedure | Type | Description |
|-----------|------|-------------|
| `admin.listPermissions` | Query | List all permissions |
| `admin.getAuditLogs` | Query | Get audit log entries |

## Authorization Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `authorization.getUserAuthorization` | Query | Get current user's roles, permissions, app access, supervised apps |

## Account Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `account.markPasswordUpdated` | Mutation | Mark that user has changed their password |

## Contract Verification

The `@aria/api-contract` package defines the expected `AppRouter` type. The backend uses compile-time `AssertContractCompatibility` checks to ensure the runtime implementation matches:

```typescript
// apps/backend/src/trpc/app-router.ts
type AssertContractCompatibility = [
  ContractAppRouter extends RuntimeAppRouter ? true : false,
  RuntimeAppRouter extends ContractAppRouter ? true : false,
];
```

Any mismatch between the contract and implementation causes a TypeScript compilation error.

## Frontend Usage

```typescript
// Frontend creates a type-safe tRPC client
import type { AppRouter } from '@aria/api-contract';

// All procedure calls are fully typed
const items = await trpc.inventory.listItems.query({ page: 1, pageSize: 20 });
const item = await trpc.inventory.createItem.mutate({ name: 'Widget', code: 'WDG-001' });
```

## Input Validation

All tRPC procedures validate input using **Zod** schemas defined in `@aria/types`:

```typescript
import { listWarehousesSchema } from '@aria/types';

// In router definition
.input(listWarehousesSchema)
.query(async ({ input, ctx }) => {
  // input is fully typed and validated
})
```
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

## Filtering

Filter results using query parameters:

```http
GET /api/v1/users?status=active&role=admin
```

## Sorting

Sort results using the `sort` parameter:

```http
GET /api/v1/users?sort=-createdAt
```

- Ascending: `sort=field`
- Descending: `sort=-field`
- Multiple fields: `sort=field1,-field2`

## Search

Search across multiple fields:

```http
GET /api/v1/users?search=john
```

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Default**: 100 requests per minute per IP
- **Authenticated**: 1000 requests per minute per user

**Rate limit headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1633024800
```

## Webhooks

Configure webhooks to receive real-time notifications:

```http
POST /api/v1/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["user.created", "asset.updated"],
  "secret": "webhook-secret"
}
```

**Webhook payload:**

```json
{
  "event": "user.created",
  "timestamp": "2025-10-05T12:00:00Z",
  "data": {
    // Event data
  }
}
```

## Error Codes

| Code                  | Description               |
| --------------------- | ------------------------- |
| `AUTH_REQUIRED`       | Authentication required   |
| `INVALID_TOKEN`       | Invalid or expired token  |
| `PERMISSION_DENIED`   | Insufficient permissions  |
| `RESOURCE_NOT_FOUND`  | Resource not found        |
| `VALIDATION_ERROR`    | Request validation failed |
| `DUPLICATE_RESOURCE`  | Resource already exists   |
| `RATE_LIMIT_EXCEEDED` | Too many requests         |
| `SERVER_ERROR`        | Internal server error     |

## API Versioning

API versions are specified in the URL path:

- **Current**: `/api/v1/...`
- **Legacy**: Support for previous versions when new major versions are released

## CORS

CORS is configured to allow requests from:

- `http://localhost:3001` (Asset frontend)
- `http://localhost:3002` (CRM frontend)
- `http://localhost:3003` (HRMS frontend)
- `http://localhost:3004` (Inventory frontend)

Production domains must be configured in environment variables.

## API Testing

### Postman Collection

Import our Postman collection for easy API testing:

🔗 [Download Postman Collection](#) (Coming soon)

### Swagger/OpenAPI

Interactive API documentation available at:

🔗 `http://localhost:3000/api/docs` (Development only)

## SDK/Client Libraries

Official client libraries (planned for v0.4.0):

- **JavaScript/TypeScript**: `@aria/sdk`
- **Python**: `aria-sdk`

## WebSocket API

Real-time updates via WebSocket (planned for v0.4.0):

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token',
  },
});

socket.on('asset.updated', (data) => {
  console.log('Asset updated:', data);
});
```

## GraphQL API

GraphQL endpoint (planned for v0.4.0):

```http
POST /api/graphql
```

## Examples

### Create User

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }'
```

### Get Asset List

```bash
curl -X GET "http://localhost:3000/api/v1/assets?page=1&limit=10" \
  -H "Authorization: Bearer {token}"
```

### Update Customer

```bash
curl -X PUT http://localhost:3000/api/v1/crm/customers/123 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "phone": "+1234567890"
  }'
```

## Best Practices

1. **Always use HTTPS** in production
2. **Store tokens securely** - Use secure storage (e.g., httpOnly cookies)
3. **Handle rate limits** - Implement exponential backoff
4. **Validate responses** - Check `success` field before processing
5. **Use pagination** - Don't request all data at once
6. **Cache responses** - Reduce API calls where appropriate
7. **Handle errors gracefully** - Implement proper error handling

## Support

For API questions and support:

- **Documentation Issues**: Open an issue with the `documentation` label
- **API Bugs**: Open an issue with the `bug` label
- **Feature Requests**: Open an issue with the `enhancement` label

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for API version history and breaking changes.

---

**Note**: This API is under active development. Endpoints and response formats may change. Check the changelog for updates.

**Current Status**: v0.1.0 - Foundation (Basic structure, authentication pending)  
**Next Release**: v0.2.0 - Full API implementation with database integration (Q1 2026)
