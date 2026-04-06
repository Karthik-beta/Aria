import { logger } from "@aria/utils";
import { cookies } from "next/headers";
import { cache } from "react";

type TrpcBatchEnvelope<TData> = Array<{
	error?: {
		message?: string;
	};
	result?: {
		data?: TData;
	};
}>;

function getBackendUrl() {
	const baseUrl =
		process.env.BACKEND_URL ||
		process.env.NEXT_PUBLIC_API_URL ||
		"http://localhost:3001";

	return baseUrl.replace(/\/$/, "");
}

const fetchTrpcQueryCached = cache(async (path: string) => {
	const cookieStore = await cookies();
	const cookieHeader = cookieStore.toString();
	const backendUrl = getBackendUrl();
	const response = await fetch(
		`${backendUrl}/trpc/${path}?batch=1&input=%7B%7D`,
		{
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				...(cookieHeader ? { cookie: cookieHeader } : {}),
			},
			cache: "no-store",
		},
	);

	if (!response.ok) {
		throw new Error(`tRPC query "${path}" failed with ${response.status}`);
	}

	const payload = (await response.json()) as TrpcBatchEnvelope<unknown>;
	const errorMessage = payload[0]?.error?.message;
	if (errorMessage) {
		throw new Error(errorMessage);
	}

	if (!Array.isArray(payload) || payload[0]?.result?.data === undefined) {
		throw new Error(`Unexpected tRPC response for "${path}"`);
	}

	return payload[0].result.data;
});

export async function fetchServerTrpcQuery<TData>(
	path: string,
): Promise<TData> {
	return (await fetchTrpcQueryCached(path)) as TData;
}

export async function tryFetchServerTrpcQuery<TData>(
	path: string,
): Promise<TData | undefined> {
	try {
		return await fetchServerTrpcQuery<TData>(path);
	} catch (error) {
		logger.error(`[Server tRPC] Failed to fetch ${path}:`, error);
		return undefined;
	}
}
