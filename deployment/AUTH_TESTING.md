# Production Deployment Testing Guide - Authentication

## Prerequisites

Before testing, ensure you have:

1. **Docker and Docker Compose** installed
2. **.env.production** file configured
3. **Prisma migrations** created (see below)

## Step 1: Create Database Migration

The authentication system requires new database tables. Create the migration:

### On Windows (PowerShell)

```powershell
.\scripts\create-auth-migration.ps1
```

### On Linux/macOS

```bash
chmod +x scripts/create-auth-migration.sh
./scripts/create-auth-migration.sh
```

This will:

- Generate Prisma client with new auth models
- Create migration files in `apps/backend/prisma/migrations/`
- **NOT** apply migrations (done automatically in Docker)

## Step 2: Configure Environment

Create `.env.production` in project root:

```bash
# Required for Docker Compose
POSTGRES_PASSWORD=your_strong_db_password
DOMAIN=localhost  # or your-domain.com

# Required for Better Auth
BETTER_AUTH_SECRET=change-this-to-a-secure-random-string-at-least-32-characters-long
BETTER_AUTH_URL=https://localhost  # or https://your-domain.com
FRONTEND_URL=https://localhost  # or https://your-domain.com

# Default Admin Credentials
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=YourSecurePassword123!
DEFAULT_ADMIN_EMAIL=admin@localhost
DEFAULT_ADMIN_NAME=Administrator

# Other required vars
JWT_SECRET=another-secure-random-string
```

**Security Notes:**

- Generate secrets using: `openssl rand -base64 32`
- Use strong unique passwords
- Never commit `.env.production` to git (it's in `.gitignore`)

## Step 3: Build Production Images

```bash
docker compose -f docker-compose.production.yml build
```

This builds:

- Backend (NestJS) with auth system
- Frontend (Next.js) with login page
- Caddy reverse proxy

Build time: ~5-10 minutes on first run.

## Step 4: Start Production Stack

```bash
docker compose -f docker-compose.production.yml up -d
```

Services start in order:

1. PostgreSQL database
2. Redis cache
3. Backend API (runs migrations, creates admin user)
4. Frontend
5. Caddy reverse proxy

Check status:

```bash
docker compose -f docker-compose.production.yml ps
```

All services should show `healthy` status.

## Step 5: Verify Migration Applied

Check backend logs for migration success:

```bash
docker compose -f docker-compose.production.yml logs backend | grep -i "migration"
```

Expected output:

```
aria-backend | Running migrations...
aria-backend | Migration `add_better_auth_tables` applied successfully
```

## Step 6: Verify Default Admin Created

Check for admin user creation:

```bash
docker compose -f docker-compose.production.yml logs backend | grep -i "default admin"
```

Expected output:

```
aria-backend | Default admin user created successfully: admin
```

If you see "Default admin user already exists", that's OK (means it ran before).

## Step 7: Access Application

Open browser to:

- **Local**: `https://localhost`
- **Production**: `https://your-domain.com`

You should see:

1. HTTPS certificate warning (expected for local testing)
2. Accept certificate and proceed
3. **Immediate redirect to /auth/sign-in page**

## Step 8: Test Login

### Login Form

On `/auth/sign-in` page, you should see:

- "Sign In" heading
- Username input field
- Password input field
- "Sign In" button

### Test Credentials

Enter:

- **Username**: `admin` (or your configured username)
- **Password**: Your configured password from `.env.production`

Click "Sign In"

### Expected Result

✅ **Success:**

- Toast notification: "Successfully signed in!"
- Redirect to home page (`/`)
- Session cookie set in browser

❌ **Failure:**

- Error toast with message
- Check browser console for errors
- Verify environment variables

## Step 9: Verify Session

### Check Cookies

Open browser DevTools → Application → Cookies → `https://localhost`

Should see:

- Cookie name: `better-auth.session_token` or similar
- Secure: Yes
- HttpOnly: Yes
- SameSite: Lax

### Test Protected Routes

Navigate to different pages:

- `/inventory/dashboard`
- `/crm/dashboard`
- `/asset/dashboard`

All should load without redirecting to login.

### Test Logout

Open browser console:

```javascript
// Import client and signOut
import { authClient } from '@/lib/auth/client';
await authClient.signOut();
```

Expected:

- Success confirmation
- Redirect to `/auth/sign-in`
- Cookie cleared

## Step 10: Test Session Persistence

1. **Login** with admin credentials
2. **Close browser completely**
3. **Reopen browser** and navigate to `https://localhost`
4. **Should NOT redirect to login** (session persists)

Session expires after 7 days by default.

## Step 11: Database Verification

Connect to database and verify tables:

```bash
docker exec -it aria-postgres psql -U aria -d aria
```

Check tables exist:

```sql
\dt

-- Should see:
-- users
-- sessions
-- accounts
-- verifications
```

Check admin user:

```sql
SELECT id, username, email, "emailVerified", "createdAt"
FROM users
WHERE username = 'admin';
```

Expected: One row with admin details.

Check admin account:

```sql
SELECT id, "userId", "providerId", "createdAt"
FROM accounts
WHERE "providerId" = 'credential';
```

Expected: One row linking to admin user.

## Troubleshooting

### Login Page Not Showing

**Issue**: Redirects to login but shows 404

**Fix**:

1. Check frontend build: `docker compose -f docker-compose.production.yml logs frontend`
2. Verify `NODE_ENV=production` is set
3. Rebuild frontend: `docker compose -f docker-compose.production.yml up -d --build frontend`

### Login Fails with "Unauthorized"

**Issue**: Credentials correct but login fails

**Fix**:

1. Check backend logs: `docker logs aria-backend`
2. Verify `BETTER_AUTH_SECRET` is set
3. Check database connection
4. Verify migrations ran successfully

### Session Not Persisting

**Issue**: Redirects to login on every page load

**Fix**:

1. Verify HTTPS is enabled (cookies require secure context)
2. Check `BETTER_AUTH_URL` matches domain
3. Check browser cookie settings (allow cookies)
4. Check `FRONTEND_URL` matches domain

### Admin User Not Created

**Issue**: Login fails, user doesn't exist

**Fix**:

1. Check environment variables are set
2. Verify backend logs for errors
3. Manually create user (see below)

#### Manual User Creation

```bash
docker exec -it aria-backend node
```

```javascript
const { PrismaClient } = require('./generated/prisma');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('YourPassword123!', 10);

  const user = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@localhost',
      name: 'Administrator',
      emailVerified: true,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: hashedPassword,
    },
  });

  console.log('Admin user created:', user);
}

createAdmin().then(() => process.exit(0));
```

### CORS Errors

**Issue**: API requests blocked by CORS

**Fix**:

1. Verify `FRONTEND_URL` matches domain
2. Check backend CORS configuration
3. Ensure requests use correct API URL

### Database Connection Fails

**Issue**: Backend can't connect to database

**Fix**:

1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Verify `DATABASE_URL` is correct
3. Check database health: `docker exec aria-postgres pg_isready`

## Clean Up

To stop and remove all containers:

```bash
docker compose -f docker-compose.production.yml down
```

To also remove volumes (⚠️ **DELETES ALL DATA**):

```bash
docker compose -f docker-compose.production.yml down -v
```

To rebuild from scratch:

```bash
docker compose -f docker-compose.production.yml down -v
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
```

## Success Criteria

✅ All tests pass if:

1. **Migration applied** successfully
2. **Admin user created** automatically
3. **Login page loads** at `/login`
4. **Login succeeds** with correct credentials
5. **Session persists** across page refreshes
6. **Session persists** after browser restart
7. **Protected routes** accessible after login
8. **Logout works** and clears session
9. **Re-login works** after logout

## Next Steps

After successful testing:

1. **Change default password** immediately
2. **Configure SSL certificate** for production domain
3. **Set up monitoring** for auth failures
4. **Enable 2FA** (future enhancement)
5. **Configure email** for password reset (future enhancement)
6. **Review audit logs** regularly (future enhancement)

## Related Documentation

- [docs/AUTHENTICATION.md](../docs/AUTHENTICATION.md) - Authentication architecture
- [deployment/QUICKSTART.md](../deployment/QUICKSTART.md) - General deployment guide
- [deployment/TROUBLESHOOTING.md](../deployment/TROUBLESHOOTING.md) - Common issues
