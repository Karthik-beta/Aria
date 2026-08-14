import { Prisma } from "../../generated/prisma/client";

type AdvisoryLockTransaction = {
	$queryRaw<T>(query: unknown): Promise<T>;
};

/**
 * Acquires the Asset-domain mutation locks in one deterministic order.
 *
 * Every caller locks Asset rows first and then its affected AssetFinanceBook
 * rows in lexical order.  The transaction must keep these locks until its
 * state reads and writes are complete.
 */
export async function lockAssetAndFinanceBooks(
	tx: AdvisoryLockTransaction,
	assetIds: readonly string[],
	assetFinanceBookIds: readonly string[],
): Promise<void> {
	for (const assetId of [...new Set(assetIds)].sort()) {
		await tx.$queryRaw(Prisma.sql`
			SELECT pg_advisory_xact_lock(hashtext(${`asset:${assetId}`})) IS NULL AS "locked"
		`);
	}
	for (const assetFinanceBookId of [...new Set(assetFinanceBookIds)].sort()) {
		await tx.$queryRaw(Prisma.sql`
			SELECT pg_advisory_xact_lock(hashtext(${`asset-finance-book:${assetFinanceBookId}`})) IS NULL AS "locked"
		`);
	}
}
