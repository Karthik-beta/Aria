/**
 * Reports whether the frontend process can serve requests.
 *
 * This route deliberately avoids authentication, database access, and redirects so
 * container and Railway health checks can require an exact HTTP 200 response.
 */
export function GET(): Response {
	return Response.json(
		{ status: "ok", service: "frontend" },
		{
			status: 200,
			headers: {
				"Cache-Control": "no-store",
			},
		},
	);
}
