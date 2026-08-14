import {
	addMonthsDateOnly,
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
} from "@aria/types";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../prisma.service";

export interface FiscalYearInfo {
	id: string;
	year: string;
	yearStartDate: Date;
	yearEndDate: Date;
	disabled: boolean;
	isShortYear: boolean;
}

export interface DetectFiscalYearChangeResult {
	changed: boolean;
	newFiscalYearEndDate: Date;
}

@Injectable()
export class FiscalYearService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Returns the fiscal year record that contains the given date.
	 * Falls back to default India FY (April 1 - March 31) if no record found.
	 */
	async getFiscalYear(date: Date): Promise<FiscalYearInfo | null> {
		const canonicalDate = dateOnlyUtc(dateOnlyFromPersistedDateTime(date));
		const dateStr = canonicalDate.toISOString();

		// Try to find a fiscal year that contains this date
		const fiscalYear = await this.prisma.fiscalYear.findFirst({
			where: {
				disabled: false,
				yearStartDate: { lte: dateStr },
				yearEndDate: { gte: dateStr },
			},
			orderBy: { yearStartDate: "desc" },
		});

		if (fiscalYear) {
			return {
				id: fiscalYear.id,
				year: fiscalYear.year,
				yearStartDate: dateOnlyUtc(
					dateOnlyFromPersistedDateTime(fiscalYear.yearStartDate),
				),
				yearEndDate: dateOnlyUtc(
					dateOnlyFromPersistedDateTime(fiscalYear.yearEndDate),
				),
				disabled: fiscalYear.disabled,
				isShortYear: fiscalYear.isShortYear,
			};
		}

		// Fallback: default India fiscal year (April 1 - March 31)
		return this.getDefaultIndiaFiscalYear(canonicalDate);
	}

	/**
	 * Returns the fiscal year end date for a given date.
	 * Uses company-specific FY if companyId provided, otherwise default.
	 */
	async getFiscalYearEndDate(
		date: Date,
		companyId?: string,
	): Promise<Date | null> {
		if (companyId) {
			const companyFY = await this.prisma.fiscalYearCompany.findFirst({
				where: { companyId },
				include: { fiscalYear: true },
				orderBy: { fiscalYear: { yearStartDate: "desc" } },
			});

			if (companyFY?.fiscalYear) {
				return dateOnlyUtc(
					dateOnlyFromPersistedDateTime(companyFY.fiscalYear.yearEndDate),
				);
			}
		}

		const fy = await this.getFiscalYear(date);
		return fy?.yearEndDate ?? null;
	}

	/**
	 * Detects if schedule date crosses into a new fiscal year.
	 * Returns { changed: boolean, newFiscalYearEndDate: Date }
	 */
	async detectFiscalYearChange(
		scheduleDate: Date,
		previousFYEndDate: Date | null,
		_companyId?: string,
	): Promise<DetectFiscalYearChangeResult> {
		const canonicalScheduleDate = dateOnlyUtc(
			dateOnlyFromPersistedDateTime(scheduleDate),
		);
		const canonicalPreviousFYEndDate = previousFYEndDate
			? dateOnlyUtc(dateOnlyFromPersistedDateTime(previousFYEndDate))
			: null;

		if (!canonicalPreviousFYEndDate) {
			// First schedule - get FY from date
			const fy = await this.getFiscalYear(canonicalScheduleDate);
			return {
				changed: true,
				newFiscalYearEndDate: fy?.yearEndDate ?? canonicalScheduleDate,
			};
		}

		// Check if schedule date exceeds current FY end
		if (canonicalScheduleDate > canonicalPreviousFYEndDate) {
			// Need to find the next fiscal year
			const nextYearDate = addMonthsDateOnly(
				dateOnlyFromPersistedDateTime(canonicalPreviousFYEndDate),
				12,
			);
			const fy = await this.getFiscalYear(nextYearDate);

			// If we have a fiscal year record for around that time, use it
			if (
				fy &&
				Math.abs(
					dateOnlyUtc(
						dateOnlyFromPersistedDateTime(fy.yearStartDate),
					).getTime() - nextYearDate.getTime(),
				) <
					365 * 24 * 60 * 60 * 1000
			) {
				return {
					changed: true,
					newFiscalYearEndDate: dateOnlyUtc(
						dateOnlyFromPersistedDateTime(fy.yearEndDate),
					),
				};
			}

			// Otherwise advance by 1 year from previous FY end
			const inferredEndDate = addMonthsDateOnly(
				dateOnlyFromPersistedDateTime(canonicalPreviousFYEndDate),
				12,
			);
			return {
				changed: true,
				newFiscalYearEndDate: inferredEndDate,
			};
		}

		return {
			changed: false,
			newFiscalYearEndDate: canonicalPreviousFYEndDate,
		};
	}

	/**
	 * Fallback to compute default India fiscal year (April 1 - March 31).
	 * Indian FY: if month >= April, FY starts April of current year.
	 * Otherwise FY starts April of previous year.
	 */
	private getDefaultIndiaFiscalYear(date: Date): FiscalYearInfo | null {
		const canonicalDate = dateOnlyUtc(dateOnlyFromPersistedDateTime(date));
		const month = canonicalDate.getUTCMonth(); // 0-indexed: March = 2, April = 3
		const year = canonicalDate.getUTCFullYear();

		let fyStartYear: number;
		if (month >= 3) {
			// April (3) onwards: FY is April this year to March next year
			fyStartYear = year;
		} else {
			// January-March: FY is April last year to March this year
			fyStartYear = year - 1;
		}

		const fyStart = new Date(Date.UTC(fyStartYear, 3, 1)); // April 1
		const fyEnd = new Date(Date.UTC(fyStartYear + 1, 2, 31)); // March 31

		return {
			id: "default-india-fy",
			year: `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
			yearStartDate: fyStart,
			yearEndDate: fyEnd,
			disabled: false,
			isShortYear: false,
		};
	}
}
