# White Page Debugging Guide

## Problem Summary
The production deployment at https://localhost/login/ shows a white page with only a spinner. The AuthGuard component is stuck in `isPending` state, waiting for `useSession()` to resolve.

## Root Causes Fixed So Far

### 1. ✅ NestJS Better Auth Global Guard (FIXED)
**Issue**: The NestJS Better Auth module was registering a global AuthGuard that blocked ALL routes, including `/api/auth/*` endpoints.

**Fix**: Added `disableGlobalAuthGuard: true` to `apps/backend/src/auth/auth.module.ts`:
```typescript
BetterAuthModule.forRoot({
  auth,
  disableGlobalAuthGuard: true,
})
```

### 2. ✅ Content Security Policy (CSP) - connect-src (FIXED)
**Issue**: The CSP header had `connect-src 'self'` which might block fetch requests.

**Fix**: Updated `deployment/caddy/Caddyfile.production` to allow both HTTP and HTTPS localhost:
```
Content-Security-Policy "... connect-src 'self' https://localhost http://localhost; ..."
```

### 3. ✅ Better Auth Client Error Logging (ADDED)
**Fix**: Added `fetchOptions` with `onError` and `onSuccess` handlers to `apps/frontend/src/lib/auth/client.ts` for better visibility.

## Current Status

### ✅ Verified Working
- Backend auth endpoint responding: `curl -k https://localhost/api/auth/get-session` returns `null` (HTTP 200)
- Caddy reverse proxy working: requests are reaching backend
- Docker containers healthy: all services running
- CSP updated: `connect-src` now allows localhost

### ❓ Unknown - Needs Browser Testing
- **Does the browser console show any errors?**
- **What does `[BetterAuth Client] Configuration:` log show?**
- **Are there any `[BetterAuth] Fetch error:` logs?**
- **Does the Network tab show the `/api/auth/get-session` request?**

## Next Steps - USER ACTION REQUIRED

### Step 1: Open Browser DevTools
1. Navigate to https://localhost/auth/sign-in/
2. **Press F12** to open Developer Tools
3. Go to the **Console** tab

### Step 2: Look for These Logs
Search for (Ctrl+F in console):
- `[BetterAuth Client] Configuration:` - Should show `baseURL: "https://localhost"`
- `[AuthGuard] Session state:` - Shows isPending/session/error state
- `[LoginPage]` - Shows fetch test results
- `[BetterAuth] Fetch error:` - **CRITICAL**: If this appears, share the full error

### Step 3: Check Network Tab
1. Go to the **Network** tab in DevTools
2. Filter by `Fetch/XHR`
3. Look for requests to `/api/auth/get-session`
4. Check:
   - **Status code**: Should be 200
   - **Response**: Should be `null`
   - **Request headers**: Should include `Accept: application/json`
   - **Response headers**: Should include `Access-Control-Allow-Origin: https://localhost`

### Step 4: Share These Details
Please share:
1. **Screenshot or text** of browser console output (all logs)
2. **Screenshot** of Network tab showing the `/api/auth/get-session` request (if any)
3. **Any red errors** in the console
4. **The output of** `[BetterAuth Client] Configuration:` log

## Potential Remaining Issues

### Theory 1: Better Auth React Client Not Making Request
- **Symptom**: No network request visible in Network tab
- **Cause**: Client misconfiguration or import issue
- **Test**: Check if `[BetterAuth Client] Configuration:` log appears

### Theory 2: Request Being Blocked by Browser
- **Symptom**: Network request shows "blocked" or CORS error
- **Cause**: Certificate issue, CORS misconfiguration, or CSP blocking
- **Test**: Look for CORS errors in console

### Theory 3: Request Timing Out
- **Symptom**: Request in "Pending" state forever in Network tab
- **Cause**: Backend not responding, proxy issue
- **Test**: Check request duration in Network tab

### Theory 4: Better Auth Hook Not Resolving
- **Symptom**: Request succeeds (200 OK) but `useSession` stays in `isPending`
- **Cause**: Better Auth client not processing response correctly
- **Test**: Check if `[BetterAuth] Fetch success:` log appears

## Debugging Enhancements Added

### AuthGuard (apps/frontend/src/components/auth/auth-guard.tsx)
- Logs session state on every render
- Handles `error` property from `useSession`
- Shows error state with button to return to login

### LoginPage (apps/frontend/src/app/login/page.tsx)
- Manual fetch test to `/api/auth/get-session`
- Debug banner showing isPending/hasSession/hasError
- Console logging of all state changes

### Auth Client (apps/frontend/src/lib/auth/client.ts)
- Logs baseURL configuration on module load
- Logs all fetch errors and successes
- Logs response status and data

## Quick Test Commands

### Test Backend Directly (from host)
```powershell
curl -k https://localhost/api/auth/get-session
# Should return: null (HTTP 200)
```

### Test from Frontend Container
```powershell
docker exec aria-frontend node -e "fetch('http://backend:3001/api/auth/get-session').then(r => r.text()).then(console.log)"
# Should return: null
```

### Check Frontend Logs
```powershell
docker logs aria-frontend --tail 50
# Should show "Ready in Xms"
```

### Check Backend Logs
```powershell
docker logs aria-backend --tail 50
# Should show "Nest application successfully started"
```

## Configuration Summary

### Backend Auth (apps/backend/src/auth/auth.config.ts)
- `baseURL`: `process.env.BETTER_AUTH_URL` (https://localhost)
- `trustedOrigins`: `[FRONTEND_URL, BETTER_AUTH_URL, https://localhost, http://localhost]`
- `disableGlobalAuthGuard`: `true`

### Frontend Auth Client (apps/frontend/src/lib/auth/client.ts)
- `baseURL`: `window.location.origin` (client) or `NEXT_PUBLIC_API_URL` (SSR)
- `plugins`: `[usernameClient()]`
- `fetchOptions`: `{ onError, onSuccess }` with logging

### Caddy Reverse Proxy (deployment/caddy/Caddyfile.production)
- Proxies `/api/*` to `backend:3001`
- CORS: `Access-Control-Allow-Origin: https://localhost`
- CSP: `connect-src 'self' https://localhost http://localhost`

## Expected Behavior After Fix
1. Page loads at https://localhost/auth/sign-in/
2. Browser console shows:
   ```
   [BetterAuth Client] Configuration: { baseURL: "https://localhost", ... }
   [AuthGuard] Session state: { isPending: true, hasSession: false, hasError: false, ... }
   [BetterAuth] Fetch success: { status: 200, data: null }
   [AuthGuard] Session state: { isPending: false, hasSession: false, hasError: false, ... }
   ```
3. Login form is visible (not a white page)
4. User can enter credentials and sign in

## If Still White Page After Checking

### Additional Fixes to Try

#### Option A: Disable AuthGuard Temporarily
Edit `apps/frontend/src/app/layout.tsx`:
```typescript
// Temporarily comment out AuthGuard
// <AuthGuard>{children}</AuthGuard>
{children}
```

#### Option B: Add Timeout to useSession
Edit `apps/frontend/src/components/auth/auth-guard.tsx`:
```typescript
useEffect(() => {
  // Add 10 second timeout
  const timeout = setTimeout(() => {
    console.error('[AuthGuard] Session fetch timeout - force showing children');
    setForceShow(true);
  }, 10000);
  
  return () => clearTimeout(timeout);
}, []);

if (forceShow) return <>{children}</>;
```

#### Option C: Use Direct Fetch Instead of useSession
Replace `useSession` with manual session fetching in AuthGuard.

---

**IMPORTANT**: Do not proceed with additional fixes until we see the browser console output. The logs will tell us exactly what's failing.
