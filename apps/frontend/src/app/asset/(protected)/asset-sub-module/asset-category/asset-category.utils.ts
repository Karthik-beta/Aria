import type { Asset } from "@aria/types";
import type { AssetCategoryFormValues } from "./asset-category.schema";
import { DEPRECIATION_METHOD_OPTIONS } from "./asset-category.schema";

export const CATEGORY_PAGE_SIZE = 20;

/**
 * Returns a human-readable label for a depreciation method.
 * e.g. "STRAIGHT_LINE" → "Straight Line"
 */
export function getDepreciationMethodLabel(
	method: Asset.DepreciationMethod | null | undefined,
): string {
	if (!method) return "-";
	return (
		DEPRECIATION_METHOD_OPTIONS.find((opt) => opt.value === method)?.label ??
		method
	);
}

/**
 * Returns a human-readable relative age string for a date.
 * e.g. "3 d", "2 m", "1 y", "Today"
 */
export function getRelativeAge(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

/**
 * Converts form values to the mutation payload expected by the API.
 * Empty depreciationMethod is normalized to null.
 * Depreciation fields are nulled out when the category is non-depreciable.
 */
export function toAssetCategoryMutationInput(
	values: AssetCategoryFormValues,
): Omit<Asset.CreateAssetCategoryInput, never> {
	const isNonDepreciable = values.nonDepreciableCategory;
	return {
		name: values.name.trim(),
		nonDepreciableCategory: values.nonDepreciableCategory,
		enableCwipAccounting: values.enableCwipAccounting,
		depreciationMethod: isNonDepreciable
			? null
			: (values.depreciationMethod as Asset.DepreciationMethod | null) || null,
		totalNumberOfDepreciations: isNonDepreciable
			? null
			: (values.totalNumberOfDepreciations ?? null),
		frequencyOfDepreciation: isNonDepreciable
			? null
			: (values.frequencyOfDepreciation ?? null),
		dailyProrataBased: isNonDepreciable
			? false
			: (values.dailyProrataBased ?? false),
		shiftBased: isNonDepreciable ? false : (values.shiftBased ?? false),
		rateOfDepreciation: isNonDepreciable
			? null
			: (values.rateOfDepreciation ?? null),
		expectedValueAfterUsefulLife: isNonDepreciable
			? null
			: (values.expectedValueAfterUsefulLife ?? null),
		financeBooks: isNonDepreciable ? [] : (values.financeBooks ?? []),
		accounts: (values.accounts ?? []).map((account) => ({
			...account,
			accumulatedDepreciationAccount:
				account.accumulatedDepreciationAccount?.trim() || null,
			depreciationExpenseAccount:
				account.depreciationExpenseAccount?.trim() || null,
			capitalWorkInProgressAccount:
				account.capitalWorkInProgressAccount?.trim() || null,
		})),
	};
}

/**
 * Builds the list query input from the current filter/pagination state.
 */
export function buildAssetCategoryListInput(params: {
	search: string;
	pageIndex: number;
	pageSize: number;
}): NonNullable<Asset.ListAssetCategoriesInput> {
	return {
		skip: params.pageIndex * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
	};
}
