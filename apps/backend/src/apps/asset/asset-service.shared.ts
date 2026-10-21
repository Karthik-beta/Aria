/**
 * Asset service shared helpers — pure constants and functions used by more
 * than one of the focused asset services.
 *
 * @module AssetServiceShared
 */

export const LIST_TAKE_MAX = 250;
export const CURRENCY_SCALE = 6;

export function roundCurrency(value: number): number {
	return Number(value.toFixed(CURRENCY_SCALE));
}

export function normalizeOptionalText(
	value: string | null | undefined,
): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function getOpeningAssetValue(
	netPurchaseAmount: number | null | undefined,
	openingAccumulatedDepreciation: number | null | undefined,
): number {
	return Math.max(
		roundCurrency(
			(netPurchaseAmount ?? 0) - (openingAccumulatedDepreciation ?? 0),
		),
		0,
	);
}
