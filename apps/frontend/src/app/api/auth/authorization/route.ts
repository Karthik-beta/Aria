import { getAuthorizationData } from "@/lib/auth/server";

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
	return Response.json(await getAuthorizationData());
}
