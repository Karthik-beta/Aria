export type FinanceBookProjection = { financeBookId: string };

/**
 * Returns whether a finance book owns the root Asset compatibility projection.
 *
 * A configured Company default wins when one exists.  When a Company has no
 * default, exactly one configured AssetFinanceBook is the ERPNext-compatible
 * effective book; multiple books remain explicitly selected operations.
 */
export function isEffectiveProjectionFinanceBook(
	companyDefaultFinanceBookId: string | null,
	assetFinanceBooks: readonly FinanceBookProjection[],
	selectedFinanceBookId: string | null | undefined,
): boolean {
	if (!selectedFinanceBookId) return false;
	if (companyDefaultFinanceBookId) {
		return selectedFinanceBookId === companyDefaultFinanceBookId;
	}
	return (
		assetFinanceBooks.length === 1 &&
		assetFinanceBooks[0]?.financeBookId === selectedFinanceBookId
	);
}
