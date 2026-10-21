/**
 * Asset core helpers — pure helpers for asset create/update: custodian
 * activity wording, month-end dates and depreciation field validation.
 *
 * @module AssetCoreHelpers
 */
import { BadRequestException } from "@nestjs/common";
import { roundCurrency } from "./asset-service.shared";

export type AssetCustodian = {
	id: string;
	employeeId: string;
	employeeName: string;
};

/**
 * Builds the Asset Activity line for a custodian change, following the
 * wording ERPNext's Asset Movement logs via `add_asset_activity`.
 */
export function custodianActivity(
	previous: AssetCustodian | null,
	next: AssetCustodian | null,
): string {
	const label = (employee: AssetCustodian) =>
		`${employee.employeeName} (${employee.employeeId})`;

	if (next) {
		return `Asset issued to Employee ${label(next)}`;
	}
	return previous
		? `Asset returned from Employee ${label(previous)}`
		: "Asset custodian cleared";
}

export function getLastDayOfMonth(date: Date): Date {
	const d = new Date(date);
	d.setMonth(d.getMonth() + 1, 0);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function validateDepreciationFields(
	netPurchaseAmount: number,
	expectedValueAfterUsefulLife: number | null,
	depreciationStartDate: Date | null,
	purchaseDate: Date,
	availableForUseDate: Date | null,
	totalNumberOfDepreciations: number | null,
	frequencyOfDepreciation: number | null,
	openingAccumulatedDepreciation: number | null,
	openingNumberOfBookedDepreciations: number | null,
	calculateDepreciation: boolean,
): void {
	if (!calculateDepreciation) return;

	if (
		expectedValueAfterUsefulLife !== null &&
		expectedValueAfterUsefulLife < 0
	) {
		throw new BadRequestException(
			"Expected value after useful life cannot be negative",
		);
	}
	if (
		expectedValueAfterUsefulLife !== null &&
		expectedValueAfterUsefulLife >= netPurchaseAmount
	) {
		throw new BadRequestException(
			"Expected value after useful life must be less than net purchase amount",
		);
	}
	if (depreciationStartDate) {
		if (depreciationStartDate < purchaseDate) {
			throw new BadRequestException(
				"Depreciation start date cannot be before purchase date",
			);
		}
		if (availableForUseDate && depreciationStartDate < availableForUseDate) {
			throw new BadRequestException(
				"Depreciation start date cannot be before available-for-use date",
			);
		}
	}
	if (totalNumberOfDepreciations !== null && totalNumberOfDepreciations <= 0) {
		throw new BadRequestException(
			"Total number of depreciations must be greater than zero",
		);
	}
	if (frequencyOfDepreciation !== null && frequencyOfDepreciation <= 0) {
		throw new BadRequestException(
			"Frequency of depreciation must be greater than zero",
		);
	}
	if (
		openingAccumulatedDepreciation !== null &&
		openingAccumulatedDepreciation > 0
	) {
		const depreciableAmount =
			netPurchaseAmount - (expectedValueAfterUsefulLife ?? 0);
		if (openingAccumulatedDepreciation > depreciableAmount) {
			throw new BadRequestException(
				`Opening accumulated depreciation must not exceed depreciable amount (${roundCurrency(depreciableAmount)})`,
			);
		}
		if (
			openingNumberOfBookedDepreciations === null ||
			openingNumberOfBookedDepreciations === 0
		) {
			throw new BadRequestException(
				"Opening number of booked depreciations is required when opening accumulated depreciation is set",
			);
		}
		if (
			totalNumberOfDepreciations !== null &&
			totalNumberOfDepreciations <= openingNumberOfBookedDepreciations
		) {
			throw new BadRequestException(
				"Total number of depreciations must be greater than opening number of booked depreciations",
			);
		}
	}
}
