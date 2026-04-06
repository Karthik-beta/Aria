# Frontend Auth Architecture

## Summary

The frontend now uses a server-first auth flow for protected routes. We no longer rely on a root client-side guard to decide whether layouts may render.

## Why We Changed It

The previous flow mixed three different patterns:

- a root client guard using `authClient.useSession()`
- server authorization hydration in only some workspace layouts
- client-side authorization fetches for other layouts

That produced unnecessary loading waterfalls, inconsistent behavior between apps, and extra client redirects after the page had already started rendering.

## Official Guidance

This implementation follows the current official recommendations:

- Next.js Authentication guide:
  Server auth checks should live in a data access layer and in pages/routes rather than depending on client context alone.
- Next.js Context Providers guidance:
  Client context is fine for client components, but server components do not get auth data from client providers.
- Next.js Proxy guidance:
  Proxy is appropriate for optimistic checks only, not as the full authorization solution.
- Better Auth Next.js integration guide:
  Proxy checks should stay lightweight, and real auth checks should still happen in pages/routes.

References:

- https://nextjs.org/docs/app/guides/authentication
- https://nextjs.org/docs/app/getting-started/proxy
- https://better-auth.com/docs/integrations/next

## Current Flow

1. `apps/frontend/src/proxy.ts`
   Performs a fast session-cookie presence check for protected routes and forwards the requested callback URL in a header.

2. `apps/frontend/src/lib/auth/server.ts`
   Fetches the Better Auth session from the backend on the server, fetches authorization only when a session exists, and exposes `requireProtectedAuthState()`.

3. Protected layouts
   `admin`, `asset`, `crm`, `hrms`, `inventory`, and the root `/` entrypoint now resolve auth on the server before rendering protected UI.

4. `AuthStateProvider`
   Protected layouts hydrate a single server-resolved auth snapshot into client components.

5. `useAuth`
   Reads only from the hydrated auth context, so layout consumers no longer trigger their own client-side session or authorization fetches.

## User-Facing Effects

- unauthenticated protected-route requests redirect earlier
- sign-in preserves the requested callback URL
- workspace layouts render with a single auth snapshot
- client-side sidebar/user menu/profile components no longer wait on `useSession()`
- `change-password` is protected on the server and receives its `mustChangePassword` state without another client fetch
