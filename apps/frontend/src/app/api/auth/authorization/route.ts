import { cookies } from 'next/headers';

/**
 * GET /api/auth/authorization
 *
 * Server-side route handler that fetches user authorization data from the backend.
 *
 * Follows the official Better Auth pattern:
 * - Runs on the server (can access cookies securely)
 * - Calls the backend tRPC endpoint with session cookies
 * - Returns authorization data to the client
 *
 * The client cannot directly access tRPC because Better Auth session cookies
 * are httpOnly. This route handler acts as a secure proxy.
 */
export async function GET() {
  try {
    // Get cookies from the request (httpOnly cookies are accessible server-side)
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // Call the backend tRPC endpoint with the session cookies
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(
      `${backendUrl}/trpc/authorization.getUserAuthorization?batch=1&input=%7B%7D`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Forward the cookies to the backend so it can authenticate the user
          cookie: cookieHeader,
        },
      }
    );

    if (!response.ok) {
      // Return empty authorization if unauthorized or error
      if (response.status === 401) {
        return Response.json(
          {
            roles: [],
            permissions: [],
            apps: {},
            supervisedApps: [],
            isActive: false,
          },
          { status: 200 } // Return 200 so client doesn't error, just gets empty auth
        );
      }

      console.error(`[Authorization API] Backend error: ${response.status}`, await response.text());
      return Response.json(
        {
          roles: [],
          permissions: [],
          apps: {},
          supervisedApps: [],
          isActive: false,
        },
        { status: 200 }
      );
    }

    // tRPC returns array response in batch mode
    const data = await response.json();

    // Extract result from tRPC batch response
    if (Array.isArray(data) && data[0]?.result?.data) {
      return Response.json(data[0].result.data);
    }

    // Fallback if response format is unexpected
    console.error('[Authorization API] Unexpected response format:', data);
    return Response.json(
      {
        roles: [],
        permissions: [],
        apps: {},
        supervisedApps: [],
        isActive: false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Authorization API] Error fetching authorization:', error);
    return Response.json(
      {
        roles: [],
        permissions: [],
        apps: {},
        supervisedApps: [],
        isActive: false,
      },
      { status: 200 }
    );
  }
}
