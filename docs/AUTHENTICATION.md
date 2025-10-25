# Authentication Setup Guide

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
- Login page at `/login`
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

### Docker Compose

The authentication environment variables are configured in `docker-compose.production.yml`:

```yaml
backend:
  environment:
    - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
    - BETTER_AUTH_URL=${BETTER_AUTH_URL}
    - FRONTEND_URL=${FRONTEND_URL}
    - DEFAULT_ADMIN_USERNAME=${DEFAULT_ADMIN_USERNAME}
    - DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}
    - DEFAULT_ADMIN_EMAIL=${DEFAULT_ADMIN_EMAIL}
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
3. If production and not authenticated, redirects to `/login`
4. User enters username and password
5. Better-auth validates credentials
6. On success, session cookie is set
7. User redirected to home page

### Development vs Production

| Feature          | Development | Production          |
| ---------------- | ----------- | ------------------- |
| Auth Required    | ❌ No       | ✅ Yes              |
| Login Page       | Hidden      | Visible at `/login` |
| Route Protection | Disabled    | Enabled             |
| Default User     | Not created | Auto-created        |

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

## Testing in Production

### 1. Deploy Application

```bash
docker compose -f docker-compose.production.yml up -d
```

### 2. Check Logs

```bash
docker compose -f docker-compose.production.yml logs backend | grep -i "default admin"
```

Should see: `Default admin user created successfully: admin`

### 3. Access Login

Navigate to `https://your-domain.com/login`

### 4. Test Login

- Username: `admin` (or your configured username)
- Password: Your configured password

### 5. Verify Session

Check browser cookies for session token.

## Security Considerations

1. **HTTPS Required**: Always use HTTPS in production for secure cookie transmission
2. **Strong Secrets**: Use cryptographically secure random strings (32+ characters)
3. **Password Policy**: Minimum 8 characters enforced by better-auth
4. **Change Defaults**: Immediately change default admin password after deployment
5. **Session Expiry**: Sessions expire after 7 days by default
6. **CORS**: Properly configure `FRONTEND_URL` to prevent CSRF attacks

## Troubleshooting

### Login Not Working

1. **Check Environment**: Verify `NODE_ENV=production` is set
2. **Check Backend Logs**: `docker logs aria-backend`
3. **Verify Database**: Ensure migrations ran successfully
4. **Check Cookies**: Ensure cookies are enabled in browser
5. **CORS Issues**: Verify `FRONTEND_URL` matches your domain

### Default User Not Created

1. Check backend logs for errors
2. Verify all `DEFAULT_ADMIN_*` variables are set
3. Check database connection: `docker exec aria-postgres psql -U aria -d aria -c "SELECT * FROM users;"`

### Session Not Persisting

1. Verify HTTPS is enabled
2. Check cookie settings in browser
3. Ensure `BETTER_AUTH_URL` matches deployment domain
4. Check session expiry settings

## File Structure

```
apps/
├── backend/
│   └── src/
│       └── auth/
│           ├── auth.config.ts      # Better-auth configuration
│           ├── auth.module.ts      # NestJS module
│           └── auth.service.ts     # Default user creation
└── frontend/
    └── src/
        ├── lib/
        │   └── auth/
        │       └── client.ts        # Auth client
        ├── components/
        │   └── auth/
        │       ├── login-form.tsx   # Login UI
        │       └── auth-guard.tsx   # Route protection
        └── app/
            └── login/
                └── page.tsx         # Login page
```

## Official Documentation

- [Better Auth](https://better-auth.com)
- [Username Plugin](https://better-auth.com/docs/plugins/username)
- [Prisma Adapter](https://better-auth.com/docs/adapters/prisma)
- [NestJS Integration](https://better-auth.com/docs/integrations/nestjs)

## Future Enhancements

- [ ] Two-factor authentication
- [ ] Password reset functionality
- [ ] Email verification
- [ ] Role-based access control
- [ ] OAuth social login
- [ ] Session management UI
- [ ] Audit logging
