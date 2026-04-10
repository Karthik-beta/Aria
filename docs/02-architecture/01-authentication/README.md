# Authentication

This document covers the Aria ERP authentication system built with better-auth and the server-first frontend layout flow that consumes it.

## Overview

Aria ERP uses [better-auth](https://better-auth.com) for username/password authentication. The backend owns session issuance, while protected frontend route groups resolve the session on the server and hydrate client components with a single auth snapshot. Development bypasses are opt-in and limited to local workflows.

## Architecture

### Backend (NestJS)

- better-auth server with Prisma adapter
- Username plugin for username-based authentication
- Custom session metadata for password-state checks
- PostgreSQL database for user storage
- Automatic default admin user creation on deployment

### Frontend (Next.js)

- Sign-in and sign-up pages under `/auth`
- `/auth/change-password` for forced password updates
- Protected route groups (`/admin`, `/asset`, `/crm`, `/hrms`, `/inventory`) call `requireProtectedAuthState()` on the server
- `AuthStateProvider` hydrates the resolved session and authorization data into client components
- `useAuth()` reads from that hydrated context instead of fetching its own session
- `proxy.ts` only performs optimistic cookie checks and preserves callback URLs
- Callback URLs are normalized to in-app relative paths only before any redirect is issued
- Frontend and backend startup reject dev-bypass flags when they leak outside development

## Configuration

### Environment Variables

#### Backend (.env.production)

```bash
# Database
DATABASE_URL=postgresql://aria:password@postgres:5432/aria

# Better Auth
BETTER_AUTH_SECRET=your-secure-random-string-min-32-chars
BETTER_AUTH_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com

# Default Admin Account
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=strong-password-here
DEFAULT_ADMIN_EMAIL=admin@your-domain.com
DEFAULT_ADMIN_NAME=Administrator
```

#### Frontend

```bash
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_DEV_AUTH_BYPASS=false
```

`NEXT_PUBLIC_DEV_AUTH_BYPASS=true` enables a local development mock session. Next.js startup rejects this flag outside development so the bypass cannot leak into production-style runs.

#### Backend Development Bypass

`DISABLE_AUTH=true` is supported only during backend development. The NestJS bootstrap path now fails fast if that flag is enabled outside development.

### Cross-Site Cookies

The backend configures Better Auth cookies for cross-site deployments, and the frontend sends credentials when it talks to the backend.

**`apps/backend/src/auth/auth.config.ts`**

```typescript
sessionCookie: {
  name: 'better-auth.session_token',
  sameSite: 'none',
  secure: true,
  httpOnly: true,
  path: '/',
}
```

The frontend tRPC client includes credentials for API calls, and the server auth helper forwards the incoming cookie header to the backend's `/api/auth/get-session` endpoint.

**`apps/frontend/src/lib/trpc/provider.tsx`**

```typescript
const httpLink = httpBatchLink({
  url: httpUrl,
  credentials: 'include',
});
```

## Database Schema

Better Auth requires four tables:

- **users** - User accounts
- **sessions** - Active sessions
- **accounts** - Authentication credentials
- **verifications** - Email verification tokens

These are defined in `apps/backend/prisma/schema.prisma`.

## Default Admin User

On first production deployment, a default admin user is automatically created:

1. Service checks environment variables
2. If credentials are set and the user does not exist, it creates:
   - User record with username, email, and name
   - Account record with hashed password (bcrypt)
3. Logs success or skips if the user already exists

**Security Note:** Change the default password immediately after first login.

## Usage

### Login Flow

1. A user visits a protected route or the home page.
2. `proxy.ts` performs the lightweight cookie-presence check recommended by the Next.js auth guide and forwards the normalized callback URL.
3. The matching server layout calls `requireProtectedAuthState()`.
4. If no session exists, the server redirects to `/auth/sign-in?callbackUrl=...`.
5. If the account must change its password, the server redirects to `/auth/change-password`.
6. The sign-in page submits credentials through better-auth.
7. On success, the user is sent back to the original callback URL or the default app route.

### Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Auth Required | ✅ By default | ✅ |
| Dev Bypass | Optional (`NEXT_PUBLIC_DEV_AUTH_BYPASS=true` on the frontend, `DISABLE_AUTH=true` on the backend) while `NODE_ENV=development` | ❌ |
| Login Page | Visible | Visible |
| Route Protection | Enabled | Enabled |
| Cookies | Lax, non-secure | SameSite=None, Secure |

### Logout

```tsx
import { authClient } from '@/lib/auth/client';

await authClient.signOut();
```

## API Endpoints

Better Auth provides these endpoints on the backend:

- `POST /api/auth/sign-in/username` - Login with username
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/get-session` - Get current session
