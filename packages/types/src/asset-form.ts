import type { Asset } from "./index.js";

/** String-backed finance-book fields used by the Asset form boundary. */
export interface AssetFinanceBookFormValues {
	financeBookId: string;
	depreciationMethod: Asset.DepreciationMethod;
	totalNumberOfDepreciations: string;
	frequencyOfDepreciation: string;
	depreciationStartDate: string;
	dailyProrataBased?: boolean;
	shiftBased?: boolean;
	precision?: string;
	ratePrecision?: string;
	calculateUsingTotalDays?: boolean;
	rateOfDepreciation?: string;
	shiftAllocations?: string;
	expectedValueAfterUsefulLife?: string;
	openingAccumulatedDepreciation?: string;
	openingNumberOfBookedDepreciations?: string;
	manualEntriesText?: string;
}

/**
 * Parses the JSON representation used by the form for persisted shift rows.
 * JSON is intentional here: shift names are allowed to contain punctuation and
 * internal whitespace, so delimiter-based text cannot be lossless.
 */
export function parseAssetFinanceBookShiftAllocations(
	value: string | undefined,
): Asset.AssetShiftAllocation[] {
	const normalized = value?.trim();
	if (!normalized) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(normalized);
	} catch {
		throw new Error("Shift allocations must be a JSON array of period rows");
	}
	if (!Array.isArray(parsed)) {
		throw new Error("Shift allocations must be a JSON array of period rows");
	}

	return parsed.map((value, index) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new Error(`Shift allocation ${index + 1} must be an object`);
		}
		const row = value as Record<string, unknown>;
		const periodIndex = row.periodIndex;
		const shift = row.shift;
		const factor = row.factor;
		if (
			typeof periodIndex !== "number" ||
			!Number.isInteger(periodIndex) ||
			periodIndex < 0 ||
			typeof shift !== "string" ||
			!shift.trim() ||
			shift.length > 100 ||
			typeof factor !== "number" ||
			!Number.isFinite(factor) ||
			factor <= 0
		) {
			throw new Error(
				`Shift allocation ${index + 1} must contain a valid periodIndex, shift, and positive factor`,
			);
		}
		return { periodIndex, shift, factor };
	});
}

/** Serializes shift rows without imposing a delimiter-based shift-name grammar. */
export function serializeAssetFinanceBookShiftAllocations(
	allocations: readonly Asset.AssetShiftAllocation[] | null | undefined,
): string {
	return allocations?.length ? JSON.stringify(allocations) : "";
}

function parseManualEntries(
	value: string | undefined,
): Asset.AssetFinanceBookInput["manualEntries"] {
	if (!value?.trim()) return undefined;
	return value
		.split(/[\n,]+/)
		.map((row) => row.trim())
		.filter(Boolean)
		.map((row) => {
			const [date, amount] = row.split(":");
			return { date: date?.trim() ?? "", amount: Number(amount) };
		});
}

/** Converts the string-backed form row into the shared API input contract. */
export function assetFinanceBookInputFromForm(
	book: AssetFinanceBookFormValues,
): Asset.AssetFinanceBookInput {
	return {
		financeBookId: book.financeBookId,
		depreciationMethod: book.depreciationMethod,
		totalNumberOfDepreciations: Number(book.totalNumberOfDepreciations),
		frequencyOfDepreciation: Number(book.frequencyOfDepreciation),
		depreciationStartDate: book.depreciationStartDate,
		dailyProrataBased: book.dailyProrataBased ?? false,
		shiftBased: book.shiftBased ?? false,
		precision: Number(book.precision || "2"),
		ratePrecision: Number(book.ratePrecision || "2"),
		calculateUsingTotalDays: book.calculateUsingTotalDays ?? false,
		rateOfDepreciation:
			book.depreciationMethod === "WRITTEN_DOWN_VALUE" &&
			book.rateOfDepreciation?.trim()
				? Number(book.rateOfDepreciation)
				: null,
		shiftAllocations: parseAssetFinanceBookShiftAllocations(
			book.shiftAllocations,
		),
		expectedValueAfterUsefulLife:
			Number(book.expectedValueAfterUsefulLife) || 0,
		openingAccumulatedDepreciation:
			Number(book.openingAccumulatedDepreciation) || 0,
		openingNumberOfBookedDepreciations:
			Number(book.openingNumberOfBookedDepreciations) || 0,
		manualEntries: parseManualEntries(book.manualEntriesText),
	};
}

/** Rehydrates a persisted finance-book row into the form's string fields. */
export function assetFinanceBookFormFromPersisted(
	book: Asset.AssetFinanceBook,
): AssetFinanceBookFormValues {
	return {
		financeBookId: book.financeBookId,
		depreciationMethod: book.depreciationMethod,
		totalNumberOfDepreciations: String(book.totalNumberOfDepreciations),
		frequencyOfDepreciation: String(book.frequencyOfDepreciation),
		depreciationStartDate: book.depreciationStartDate,
		dailyProrataBased: book.dailyProrataBased ?? false,
		shiftBased: book.shiftBased ?? false,
		precision: String(book.precision ?? 2),
		ratePrecision: String(book.ratePrecision ?? 2),
		calculateUsingTotalDays: book.calculateUsingTotalDays ?? false,
		rateOfDepreciation:
			book.depreciationMethod === "WRITTEN_DOWN_VALUE" &&
			book.rateOfDepreciation != null
				? String(book.rateOfDepreciation)
				: "",
		shiftAllocations: serializeAssetFinanceBookShiftAllocations(
			book.shiftAllocations,
		),
		expectedValueAfterUsefulLife: String(
			book.expectedValueAfterUsefulLife ?? 0,
		),
		openingAccumulatedDepreciation: String(
			book.openingAccumulatedDepreciation ?? 0,
		),
		openingNumberOfBookedDepreciations: String(
			book.openingNumberOfBookedDepreciations ?? 0,
		),
		manualEntriesText: "",
	};
}
