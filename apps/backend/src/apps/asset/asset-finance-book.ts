import type { Prisma } from "../../generated/prisma/client";

export type FinanceBookProjection = { financeBookId: string };

/**
 * Builds the canonical Company-scoped FinanceBook eligibility predicate.
 *
 * A Company default is eligible even before an AssetFinanceBook row exists;
 * every other eligible book must be linked to an Asset owned by that exact
 * Company. The caller is responsible for selecting the Company through its
 * trusted Organization scope before using this predicate.
 */
export function financeBookEligibilityWhereForCompany(
	companyId: string,
	companyDefaultFinanceBookId: string | null,
	requestedFinanceBookId?: string | null,
): Prisma.FinanceBookWhereInput {
	const eligibleForCompany: Prisma.FinanceBookWhereInput[] = [
		{
			assetFinanceBooks: {
				some: {
					asset: { is: { companyId } },
				},
			},
		},
	];

	if (companyDefaultFinanceBookId) {
		eligibleForCompany.push({ id: companyDefaultFinanceBookId });
	}

	return {
		AND: [
			...(requestedFinanceBookId ? [{ id: requestedFinanceBookId }] : []),
			{ OR: eligibleForCompany },
		],
	};
}

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
