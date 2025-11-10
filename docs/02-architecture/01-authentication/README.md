# Authentication

This document provides a comprehensive overview of the Aria ERP authentication system, built with better-auth.

## Overview

Aria ERP uses [better-auth](https://better-auth.com) for authentication with username/password login. Authentication is **only enabled in production environments** to simplify development workflows.

## Architecture

### Backend (NestJS)

- **better-auth** server with Prisma adapter
- Username plugin for username-based authentication
- PostgreSQL database for user storage
- Automatic default admin user creation on deployment

### Frontend (Next.js)

- **better-auth/react** client
- Login page at `/auth/sign-in`
- Auth guard protecting all routes in production
- Session management with cookies

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
NODE_ENV=production
```

### Cross-Site Cookies

To support cross-site authentication, the backend is configured to allow cross-site cookies.

**`apps/backend/src/auth/auth.config.ts`**
```typescript
sessionCookie: {
  name: 'better-auth.session_token',
  sameSite: 'none',    // Allow cross-site cookie setting
  secure: true,        // Require HTTPS (security requirement for SameSite=None)
  httpOnly: true,      // Prevent JavaScript access (XSS protection)
  path: '/',           // Available to all routes
}
```

The frontend tRPC client is configured to include credentials in cross-site requests.

**`apps/frontend/src/lib/trpc/provider.tsx`**
```typescript
const httpLink = httpBatchLink({
  url: httpUrl,
  credentials: 'include', // Include cookies for cross-site requests
});
```

## Database Schema

Better-auth requires four tables:

- **users** - User accounts
- **sessions** - Active sessions
- **accounts** - Authentication credentials
- **verifications** - Email verification tokens (unused but required)

These are defined in `apps/backend/prisma/schema.prisma`.

## Default Admin User

On first production deployment, a default admin user is automatically created:

1. Service checks environment variables
2. If credentials are set and user doesn't exist, creates:
   - User record with username, email, name
   - Account record with hashed password (bcrypt)
3. Logs success or skips if user exists

**Security Note:** Change the default password immediately after first login.

## Usage

### Login Flow

1. User navigates to application
2. `AuthGuard` checks if in production
3. If production and not authenticated, redirects to `/auth/sign-in`
4. User enters username and password
5. Better-auth validates credentials
6. On success, session cookie is set
7. User redirected to home page

### Development vs Production

| Feature          | Development | Production                 |
| ---------------- | ----------- | -------------------------- |
| Auth Required    | ❌ No       | ✅ Yes                     |
| Login Page       | Hidden      | Visible at `/auth/sign-in` |
| Route Protection | Disabled    | Enabled                    |
| Default User     | Not created | Auto-created               |

### Logout

```tsx
import { authClient } from '@/lib/auth/client';

await authClient.signOut();
```

## API Endpoints

Better-auth provides these endpoints on the backend:

- `POST /api/auth/sign-in/username` - Login with username
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/session` - Get current session
