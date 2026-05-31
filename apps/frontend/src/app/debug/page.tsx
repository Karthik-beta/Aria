"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

/**
 * Debug page for diagnosing authentication issues
 *
 * Access at /debug to see:
 * - Current session state
 * - Error details
 * - Environment configuration
 * - Network request information
 */
export default function DebugPage() {
	const { data: session, isPending, error } = authClient.useSession();
	const [fetchError, setFetchError] = useState<string | null>(null);
	const [manualSessionCheck, setManualSessionCheck] = useState<Record<
		string,
		unknown
	> | null>(null);

	useEffect(() => {
		async function checkSession() {
			try {
				const baseUrl = (
					process.env.NEXT_PUBLIC_API_URL || window.location.origin
				).replace(/\/$/, "");
				const response = await fetch(`${baseUrl}/api/auth/get-session`, {
					method: "GET",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
					},
				});

				if (!response.ok) {
					const text = await response.text();
					setFetchError(`HTTP ${response.status}: ${text}`);
				} else {
					const data = await response.json();
					setManualSessionCheck(data);
				}
			} catch (err) {
				setFetchError(err instanceof Error ? err.message : String(err));
			}
		}

		checkSession();
	}, []);

	return (
		<div className="container mx-auto p-8">
			<h1 className="text-3xl font-bold mb-6">Authentication Debug Page</h1>

			<section className="mb-8 p-4 border rounded-lg">
				<h2 className="text-xl font-semibold mb-4">Environment</h2>
				<pre className="bg-gray-100 p-4 rounded overflow-auto">
					{JSON.stringify(
						{
							NODE_ENV: process.env.NODE_ENV,
							NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
							windowOrigin:
								typeof window !== "undefined" ? window.location.origin : "N/A",
							authClientBaseURL:
								typeof window !== "undefined"
									? window.location.origin
									: "server-side",
						},
						null,
						2,
					)}
				</pre>
			</section>

			<section className="mb-8 p-4 border rounded-lg">
				<h2 className="text-xl font-semibold mb-4">useSession Hook State</h2>
				<div className="space-y-2">
					<div>
						<strong>isPending:</strong> {String(isPending)}
					</div>
					<div>
						<strong>hasError:</strong> {String(!!error)}
					</div>
					<div>
						<strong>hasSession:</strong> {String(!!session)}
					</div>
				</div>

				{error && (
					<div className="mt-4 p-4 bg-red-100 border border-red-400 rounded">
						<h3 className="font-semibold text-red-800">Error Details:</h3>
						<pre className="mt-2 text-sm overflow-auto">
							{JSON.stringify(error, null, 2)}
						</pre>
					</div>
				)}

				{session && (
					<div className="mt-4 p-4 bg-green-100 border border-green-400 rounded">
						<h3 className="font-semibold text-green-800">Session Data:</h3>
						<pre className="mt-2 text-sm overflow-auto">
							{JSON.stringify(session, null, 2)}
						</pre>
					</div>
				)}
			</section>

			<section className="mb-8 p-4 border rounded-lg">
				<h2 className="text-xl font-semibold mb-4">
					Manual /api/auth/get-session Fetch
				</h2>

				{fetchError && (
					<div className="p-4 bg-red-100 border border-red-400 rounded">
						<h3 className="font-semibold text-red-800">Fetch Error:</h3>
						<pre className="mt-2 text-sm overflow-auto">{fetchError}</pre>
					</div>
				)}

				{manualSessionCheck && (
					<div className="p-4 bg-blue-100 border border-blue-400 rounded">
						<h3 className="font-semibold text-blue-800">Raw Response:</h3>
						<pre className="mt-2 text-sm overflow-auto">
							{JSON.stringify(manualSessionCheck, null, 2)}
						</pre>
					</div>
				)}

				{!fetchError && !manualSessionCheck && <div>Loading...</div>}
			</section>

			<section className="mb-8 p-4 border rounded-lg">
				<h2 className="text-xl font-semibold mb-4">Actions</h2>
				<div className="flex gap-4">
					<button
						onClick={() => window.location.reload()}
						className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
						type="button"
					>
						Reload Page
					</button>
					<a
						href="/auth/sign-in"
						className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
					>
						Go to Sign in
					</a>
					<a
						href="/"
						className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
					>
						Go to Home
					</a>
				</div>
			</section>

			<section className="p-4 border rounded-lg bg-yellow-50">
				<h2 className="text-xl font-semibold mb-2">Remember:</h2>
				<p>
					Check your browser&apos;s Developer Console (F12) for additional
					logging output from the Better Auth client and server session fetches.
				</p>
			</section>
		</div>
	);
}
