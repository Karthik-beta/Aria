import { Prisma } from "../generated/prisma/client";
import type { PrismaService } from "./prisma.service";

type SeriesCounterClient =
	| Prisma.TransactionClient
	| Pick<PrismaService, "client">;

function getQueryClient(client: SeriesCounterClient) {
	return "client" in client ? client.client : client;
}

/**
 * Atomically allocates the next integer for a document-series scope.
 *
 * The scope key should already include any pattern or time partitioning
 * requirements, for example `MAT-MR-2026-` or `MAT-PRE-2026-`.
 */
export async function allocateDocumentSeriesNumber(
	client: SeriesCounterClient,
	scopeKey: string,
	initialValue = 1,
): Promise<number> {
	const queryClient = getQueryClient(client);
	const rows = await queryClient.$queryRaw<Array<{ value: number }>>(Prisma.sql`
		INSERT INTO "document_series_counters" ("key", "value", "createdAt", "updatedAt")
		VALUES (${scopeKey}, ${initialValue}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT ("key")
		DO UPDATE
		SET "value" = "document_series_counters"."value" + 1,
		    "updatedAt" = CURRENT_TIMESTAMP
		RETURNING "value"
	`);

	const nextValue = rows[0]?.value;
	if (typeof nextValue !== "number" || !Number.isFinite(nextValue)) {
		throw new Error(
			`Failed to allocate a document series number for ${scopeKey}`,
		);
	}

	return nextValue;
}

export function formatDocumentSeries(
	prefix: string,
	value: number,
	padding = 5,
): string {
	return `${prefix}${String(value).padStart(padding, "0")}`;
}

export function getSeriesSeedValue(
	prefix: string,
	lastSeries?: string | null,
): number {
	if (!lastSeries) {
		return 1;
	}

	const numericPortion = lastSeries.slice(prefix.length);
	const lastValue = Number.parseInt(numericPortion, 10);
	return Number.isFinite(lastValue) ? lastValue + 1 : 1;
}

export async function allocateDocumentSeries(
	client: SeriesCounterClient,
	prefix: string,
	padding = 5,
	initialValue = 1,
): Promise<string> {
	const nextValue = await allocateDocumentSeriesNumber(
		client,
		prefix,
		initialValue,
	);
	return formatDocumentSeries(prefix, nextValue, padding);
}
