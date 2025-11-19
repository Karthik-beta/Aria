# Aria ERP API Documentation

> RESTful API documentation for Aria ERP backend services

**Version**: v1 (0.1.0)  
**Base URL**: `http://localhost:3000/api/v1`  
**Status**: 🚧 Under Development

## Overview

Aria ERP provides a comprehensive RESTful API for all enterprise resource planning operations. This document describes the available endpoints, request/response formats, and authentication mechanisms.

## Authentication

### JWT Authentication

All API endpoints require authentication using JSON Web Tokens (JWT).

**Login Endpoint:**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 604800
}
```

**Using the Token:**

```http
GET /api/v1/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Common Headers

```http
Content-Type: application/json
Authorization: Bearer {token}
Accept: application/json
```

## Response Format

All API responses follow a consistent format:

**Success Response:**

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-10-05T12:00:00Z",
    "version": "v1"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": []
  },
  "meta": {
    "timestamp": "2025-10-05T12:00:00Z",
    "version": "v1"
  }
}
```

## Status Codes

| Code | Description                                           |
| ---- | ----------------------------------------------------- |
| 200  | OK - Request succeeded                                |
| 201  | Created - Resource created successfully               |
| 204  | No Content - Request succeeded with no response body  |
| 400  | Bad Request - Invalid request parameters              |
| 401  | Unauthorized - Authentication required                |
| 403  | Forbidden - Insufficient permissions                  |
| 404  | Not Found - Resource not found                        |
| 422  | Unprocessable Entity - Validation failed              |
| 429  | Too Many Requests - Rate limit exceeded               |
| 500  | Internal Server Error - Server error                  |
| 503  | Service Unavailable - Service temporarily unavailable |

## API Modules

### 🔐 Authentication

Base: `/api/v1/auth`

- `POST /login` - Authenticate user
- `POST /logout` - Invalidate token
- `POST /refresh` - Refresh access token
- `POST /register` - Register new user (admin only)
- `GET /me` - Get current user profile

### 👤 Users

Base: `/api/v1/users`

- `GET /users` - List all users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `GET /users/:id/roles` - Get user roles
- `PUT /users/:id/roles` - Update user roles

### 📦 Assets

Base: `/api/v1/assets`

- `GET /assets` - List all assets
- `GET /assets/:id` - Get asset details
- `POST /assets` - Create new asset
- `PUT /assets/:id` - Update asset
- `DELETE /assets/:id` - Delete asset
- `GET /assets/:id/history` - Get asset history
- `POST /assets/:id/maintenance` - Schedule maintenance

### 👥 CRM

Base: `/api/v1/crm`

- `GET /customers` - List customers
- `GET /customers/:id` - Get customer details
- `POST /customers` - Create customer
- `PUT /customers/:id` - Update customer
- `DELETE /customers/:id` - Delete customer
- `GET /leads` - List leads
- `POST /leads` - Create lead
- `PUT /leads/:id/convert` - Convert lead to customer

### 👔 HRMS

Base: `/api/v1/hrms`

- `GET /employees` - List employees
- `GET /employees/:id` - Get employee details
- `POST /employees` - Create employee
- `PUT /employees/:id` - Update employee
- `DELETE /employees/:id` - Delete employee
- `GET /attendance` - Get attendance records
- `POST /attendance` - Mark attendance
- `GET /leaves` - List leave requests
- `POST /leaves` - Submit leave request

### 📊 Inventory

Base: `/api/v1/inventory`

- `GET /items` - List inventory items
- `GET /items/:id` - Get item details
- `POST /items` - Create item
- `PUT /items/:id` - Update item
- `DELETE /items/:id` - Delete item
- `GET /stock` - Get stock levels
- `POST /stock/adjust` - Adjust stock quantity
- `GET /warehouses` - List warehouses

## Pagination

List endpoints support pagination using query parameters:

```http
GET /api/v1/users?page=1&limit=20
```

**Parameters:**

- `page` (number, default: 1) - Page number
- `limit` (number, default: 20, max: 100) - Items per page

**Response includes pagination metadata:**

```json
{
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
