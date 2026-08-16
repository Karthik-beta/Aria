import type { Asset, DateOnly } from "@aria/types";
import {
	dateOnlyFromPersistedDateTime,
	dateOnlyUtcRange,
	normalizeDateOnly,
} from "@aria/types";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { financeBookEligibilityWhereForCompany } from "./asset-finance-book";
import {
	type AssetOrganizationId,
	assertAssetOrganizationId,
	assetWhereForOrganization,
} from "./asset-organization-scope";

const CURRENCY_SCALE = 6;

const roundCurrency = (value: number): number =>
	Number(value.toFixed(CURRENCY_SCALE));

const reportAssetSelect = {
	id: true,
	series: true,
	assetName: true,
	companyId: true,
	purchaseDate: true,
	availableForUseDate: true,
	netPurchaseAmount: true,
	openingAccumulatedDepreciation: true,
	calculateDepreciation: true,
	status: true,
	assetCategory: { select: { id: true, name: true } },
	location: { select: { id: true, name: true } },
	company: {
		select: {
			id: true,
			name: true,
			organizationId: true,
			defaultFinanceBookId: true,
		},
	},
	financeBooks: {
		orderBy: { createdAt: "asc" as const },
		select: {
			id: true,
			financeBookId: true,
			openingAccumulatedDepreciation: true,
			financeBook: { select: { name: true } },
		},
	},
	valueAdjustments: {
		where: { status: "SUBMITTED" as const },
		select: {
			id: true,
			financeBookId: true,
			adjustmentDate: true,
			differenceAmount: true,
		},
	},
	depreciationJournalEntries: {
		where: { status: "POSTED" as const },
		select: {
			id: true,
			assetFinanceBookId: true,
			postingDate: true,
			depreciationAmount: true,
		},
	},
	capitalizationsAsTarget: {
		where: { status: "SUBMITTED" as const },
		select: {
			id: true,
			financeBookId: true,
			postingDate: true,
			totalValue: true,
		},
	},
	capitalizationsAsSource: {
		where: { capitalization: { is: { status: "SUBMITTED" as const } } },
		select: {
			financeBookId: true,
			previousStatus: true,
			capitalization: {
				select: {
					financeBookId: true,
					postingDate: true,
					status: true,
				},
			},
		},
	},
	disposals: {
		where: { status: "POSTED" as const },
		select: {
			disposalDate: true,
			disposalType: true,
			financeBookId: true,
			previousAssetStatus: true,
		},
	},
} as const;

type ReportClient = Pick<
	Prisma.TransactionClient,
	"asset" | "company" | "financeBook"
>;
type ReportAsset = Prisma.AssetGetPayload<{ select: typeof reportAssetSelect }>;
type ReportFinanceBook = ReportAsset["financeBooks"][number];

type SelectedBook = ReportFinanceBook | null;

type TerminalStatus = "SOLD" | "SCRAPPED" | "CAPITALIZED";

const terminalStatuses = new Set<TerminalStatus>([
	"SOLD",
	"SCRAPPED",
	"CAPITALIZED",
]);

function toFiniteNumber(
	value: unknown,
	label: string,
	assetSeries: string,
): number {
	const numeric = Number(value ?? 0);
	if (!Number.isFinite(numeric)) {
		throw new BadRequestException(
			`Asset ${assetSeries} has a non-finite ${label} in persisted report state.`,
		);
	}
	return numeric;
}

function dateOnly(value: Date): DateOnly {
	return dateOnlyFromPersistedDateTime(value);
}

function isOnOrBefore(value: Date, asOfDate: DateOnly): boolean {
	return dateOnly(value) <= asOfDate;
}

function isInReportWindow(
	value: Date,
	fromDate: DateOnly,
	toDate: DateOnly,
): boolean {
	const valueDate = dateOnly(value);
	return valueDate >= fromDate && valueDate <= toDate;
}

function monthKey(value: DateOnly): string {
	return value.slice(0, 7);
}

function monthStart(value: DateOnly): Date {
	return new Date(
		Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1),
	);
}

function isRootProjectionCapitalization(
	capitalization: ReportAsset["capitalizationsAsTarget"][number],
	companyDefaultFinanceBookId: string | null,
	asset: ReportAsset,
): boolean {
	if (capitalization.financeBookId === null) return true;
	if (capitalization.financeBookId === companyDefaultFinanceBookId) {
		return companyDefaultFinanceBookId !== null;
	}
	return (
		companyDefaultFinanceBookId === null &&
		asset.financeBooks.length === 1 &&
		asset.financeBooks[0]?.financeBookId === capitalization.financeBookId
	);
}

function capitalizationFinanceBookId(
	capitalization: ReportAsset["capitalizationsAsTarget"][number],
	companyDefaultFinanceBookId: string | null,
	asset: ReportAsset,
): string | null {
	return (
		capitalization.financeBookId ??
		companyDefaultFinanceBookId ??
		(asset.financeBooks.length === 1
			? (asset.financeBooks[0]?.financeBookId ?? null)
			: null)
	);
}

function selectAssetFinanceBook(
	asset: ReportAsset,
	companyDefaultFinanceBookId: string | null,
	requestedFinanceBookId: string | null,
): SelectedBook {
	if (requestedFinanceBookId) {
		return (
			asset.financeBooks.find(
				(book) => book.financeBookId === requestedFinanceBookId,
			) ?? null
		);
	}

	if (companyDefaultFinanceBookId) {
		return (
			asset.financeBooks.find(
				(book) => book.financeBookId === companyDefaultFinanceBookId,
			) ?? null
		);
	}

	if (asset.financeBooks.length === 1) return asset.financeBooks[0] ?? null;
	if (asset.financeBooks.length > 1 && asset.calculateDepreciation) {
		throw new BadRequestException(
			`Asset ${asset.series} has multiple finance books but its Company has no default finance book; select a book explicitly.`,
		);
	}
	return null;
}

function financeBookLineageMatches(
	financeBookId: string | null,
	selectedBook: SelectedBook,
): boolean {
	return financeBookId === (selectedBook?.financeBookId ?? null);
}

function terminalStatus(value: Asset.AssetStatus): value is TerminalStatus {
	return terminalStatuses.has(value as TerminalStatus);
}

function resolveStatusAtAsOf(
	asset: ReportAsset,
	selectedBook: SelectedBook,
	financeBookContext: boolean,
	asOfDate: DateOnly,
): Asset.AssetStatus {
	const currentStatus = asset.status as Asset.AssetStatus;
	const ambiguousDisposal = asset.disposals
		.filter(
			(disposal) =>
				disposal.financeBookId === null &&
				isOnOrBefore(disposal.disposalDate, asOfDate),
		)
		.sort((left, right) => {
			const dateComparison = dateOnly(left.disposalDate).localeCompare(
				dateOnly(right.disposalDate),
			);
			return (
				dateComparison || left.disposalType.localeCompare(right.disposalType)
			);
		})[0];
	if (financeBookContext && ambiguousDisposal) {
		throw new BadRequestException(
			`Asset ${asset.series} has a posted ${ambiguousDisposal.disposalType.toLowerCase()} disposal on ${dateOnly(ambiguousDisposal.disposalDate)} without finance-book lineage; selected-book status cannot be reconstructed.`,
		);
	}

	const selectedDisposals = asset.disposals
		.filter((disposal) =>
			financeBookLineageMatches(disposal.financeBookId, selectedBook),
		)
		.sort((left, right) =>
			dateOnly(left.disposalDate).localeCompare(dateOnly(right.disposalDate)),
		);
	const applicableDisposal = selectedDisposals
		.filter((disposal) => isOnOrBefore(disposal.disposalDate, asOfDate))
		.at(-1);
	if (applicableDisposal) {
		return applicableDisposal.disposalType === "SELL" ? "SOLD" : "SCRAPPED";
	}

	const selectedCapitalizations = asset.capitalizationsAsSource
		.filter((item) =>
			financeBookLineageMatches(
				item.financeBookId ?? item.capitalization.financeBookId,
				selectedBook,
			),
		)
		.sort((left, right) =>
			dateOnly(left.capitalization.postingDate).localeCompare(
				dateOnly(right.capitalization.postingDate),
			),
		);
	const applicableCapitalization = selectedCapitalizations
		.filter((item) => isOnOrBefore(item.capitalization.postingDate, asOfDate))
		.at(-1);
	if (applicableCapitalization) return "CAPITALIZED";

	if (terminalStatus(currentStatus)) {
		if (
			selectedBook &&
			selectedDisposals.length === 0 &&
			selectedCapitalizations.length === 0
		) {
			return "SUBMITTED";
		}

		const futureDisposal = selectedDisposals
			.filter((disposal) => dateOnly(disposal.disposalDate) > asOfDate)
			.sort((left, right) =>
				dateOnly(left.disposalDate).localeCompare(dateOnly(right.disposalDate)),
			)
			.at(0);
		const futureCapitalization = selectedCapitalizations
			.filter((item) => dateOnly(item.capitalization.postingDate) > asOfDate)
			.sort((left, right) =>
				dateOnly(left.capitalization.postingDate).localeCompare(
					dateOnly(right.capitalization.postingDate),
				),
			)
			.at(0);
		const futureEvent = [
			futureDisposal
				? {
						date: dateOnly(futureDisposal.disposalDate),
						status:
							futureDisposal.disposalType === "SELL" ? "SOLD" : "SCRAPPED",
						previousStatus: futureDisposal.previousAssetStatus,
					}
				: null,
			futureCapitalization
				? {
						date: dateOnly(futureCapitalization.capitalization.postingDate),
						status: "CAPITALIZED" as const,
						previousStatus: futureCapitalization.previousStatus,
					}
				: null,
		]
			.filter(
				(
					event,
				): event is {
					date: DateOnly;
					status: TerminalStatus;
					previousStatus: Asset.AssetStatus | null;
				} => Boolean(event),
			)
			.sort((left, right) => left.date.localeCompare(right.date))[0];
		if (futureEvent) {
			return futureEvent.previousStatus ?? "SUBMITTED";
		}
	}

	return currentStatus;
}

/**
 * Read-only Fixed Asset Register projection.
 *
 * The report follows ERPNext's exact company/book/date boundary contract while
 * using Aria's durable book lineage: opening accumulation comes from the
 * selected AssetFinanceBook, depreciation comes only from posted journal rows,
 * and adjustments/capitalizations are replayed only through the inclusive
 * report date. Schedule projections and root compatibility values are never a
 * source for historical report amounts.
 */
@Injectable()
export class FixedAssetRegisterReportService {
	constructor(private readonly prisma: PrismaService) {}

	/** Generates a read-only, organization-scoped register projection. */
	async generateReport(
		input: Asset.ListFixedAssetRegisterReportInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.FixedAssetRegisterReportResult> {
		assertAssetOrganizationId(organizationId);
		return this.prisma.$transaction((tx) =>
			this.generateReportFromClient(tx, input, organizationId),
		);
	}

	private async generateReportFromClient(
		client: ReportClient,
		input: Asset.ListFixedAssetRegisterReportInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.FixedAssetRegisterReportResult> {
		const companyId = input.companyId?.trim();
		if (!companyId) {
			throw new BadRequestException(
				"An exact Company selection is required for the Fixed Asset Register.",
			);
		}

		const fromDate = normalizeDateOnly(input.fromDate);
		const toDate = normalizeDateOnly(input.toDate);
		const reportWindow = dateOnlyUtcRange(fromDate, toDate);
		const requestedFinanceBookId = input.financeBookId?.trim() || null;

		const company = await client.company.findFirst({
			where: { id: companyId, organizationId },
			select: {
				id: true,
				name: true,
				disabled: true,
				defaultFinanceBookId: true,
			},
		});
		if (!company) {
			throw new NotFoundException(
				`Company ${companyId} is not available in the active organization.`,
			);
		}
		if (company.disabled) {
			throw new BadRequestException(
				`Company ${company.name} is disabled in the active organization.`,
			);
		}

		const selectedFinanceBook = requestedFinanceBookId
			? await client.financeBook.findFirst({
					where: financeBookEligibilityWhereForCompany(
						company.id,
						company.defaultFinanceBookId,
						requestedFinanceBookId,
					),
					select: { id: true, name: true },
				})
			: company.defaultFinanceBookId
				? await client.financeBook.findUnique({
						where: { id: company.defaultFinanceBookId },
						select: { id: true, name: true },
					})
				: null;
		if (requestedFinanceBookId && !selectedFinanceBook) {
			throw new NotFoundException(
				`Finance book ${requestedFinanceBookId} is not eligible for Company ${company.name} in the active organization.`,
			);
		}
		if (
			company.defaultFinanceBookId &&
			!requestedFinanceBookId &&
			!selectedFinanceBook
		) {
			throw new BadRequestException(
				`Company ${company.name} references a missing default finance book.`,
			);
		}

		const assetWhere: Prisma.AssetWhereInput = {
			purchaseDate: {
				gte: reportWindow.startInclusive,
				lt: reportWindow.endExclusive,
			},
			status: { notIn: ["DRAFT", "CANCELLED"] },
			...(input.assetId ? { id: input.assetId } : {}),
			...(input.assetCategory
				? {
						assetCategory: {
							is: {
								name: {
									equals: input.assetCategory,
									mode: "insensitive",
								},
							},
						},
					}
				: {}),
			...(input.location
				? {
						location: {
							is: {
								name: {
									equals: input.location,
									mode: "insensitive",
								},
							},
						},
					}
				: {}),
		};

		const assets = await client.asset.findMany({
			where: assetWhereForOrganization(organizationId, {
				...assetWhere,
				companyId: company.id,
			}),
			orderBy: [{ purchaseDate: "asc" }, { id: "asc" }],
			select: reportAssetSelect,
		});

		const selectedBooks = new Map<string, SelectedBook>();
		for (const asset of assets) {
			selectedBooks.set(
				asset.id,
				selectAssetFinanceBook(
					asset,
					company.defaultFinanceBookId,
					requestedFinanceBookId,
				),
			);
		}

		let effectiveSingletonFinanceBookId: string | null = null;
		if (!requestedFinanceBookId && !company.defaultFinanceBookId) {
			const effectiveBookIds = new Set(
				assets
					.map((asset) => selectedBooks.get(asset.id)?.financeBookId ?? null)
					.filter((financeBookId): financeBookId is string =>
						Boolean(financeBookId),
					),
			);
			if (effectiveBookIds.size > 1) {
				throw new BadRequestException(
					`Company ${company.name} has assets in multiple finance books but no default finance book; select a book explicitly.`,
				);
			}
			effectiveSingletonFinanceBookId = [...effectiveBookIds][0] ?? null;
		}

		const financeBookSelection: Asset.FixedAssetRegisterReportScope["financeBookSelection"] =
			requestedFinanceBookId
				? "EXPLICIT"
				: company.defaultFinanceBookId
					? "COMPANY_DEFAULT"
					: effectiveSingletonFinanceBookId
						? "ASSET_SINGLETON"
						: "NONE";
		const scopeFinanceBookId =
			requestedFinanceBookId ??
			company.defaultFinanceBookId ??
			effectiveSingletonFinanceBookId;
		const scopeFinanceBookName =
			selectedFinanceBook?.name ??
			assets
				.map((asset) => selectedBooks.get(asset.id))
				.find((book) => book?.financeBookId === scopeFinanceBookId)?.financeBook
				.name ??
			null;
		const statusFilter = input.status ?? "IN_LOCATION";

		const rows: Asset.FixedAssetRegisterRow[] = [];
		let totalPurchaseAmount = 0;
		let totalDepreciatedAmount = 0;
		let totalAccumulatedDepreciation = 0;
		let totalRevaluationAmount = 0;
		let totalNetBookValue = 0;

		const monthlyChartMap = new Map<
			string,
			{ assetValue: number; depreciatedAmount: number }
		>();
		const currentMonth = monthStart(fromDate);
		const endMonth = monthStart(toDate);
		while (currentMonth <= endMonth) {
			monthlyChartMap.set(
				monthKey(dateOnlyFromPersistedDateTime(currentMonth)),
				{ assetValue: 0, depreciatedAmount: 0 },
			);
			currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
		}

		for (const asset of assets) {
			const selectedBook = selectedBooks.get(asset.id) ?? null;
			if (asset.calculateDepreciation && !selectedBook) continue;

			const assetSeries = asset.series;
			const openingAccumulatedDepreciation = selectedBook
				? toFiniteNumber(
						selectedBook.openingAccumulatedDepreciation,
						"opening accumulated depreciation",
						assetSeries,
					)
				: toFiniteNumber(
						asset.openingAccumulatedDepreciation,
						"opening accumulated depreciation",
						assetSeries,
					);

			const rootCapitalizations = asset.capitalizationsAsTarget.filter(
				(capitalization) =>
					isRootProjectionCapitalization(
						capitalization,
						company.defaultFinanceBookId,
						asset,
					),
			);
			const rootCapitalizationTotal = rootCapitalizations.reduce(
				(total, capitalization) =>
					total +
					toFiniteNumber(
						capitalization.totalValue,
						"capitalization value",
						assetSeries,
					),
				0,
			);
			const currentNetPurchaseAmount = toFiniteNumber(
				asset.netPurchaseAmount,
				"net purchase amount",
				assetSeries,
			);
			const baseNetPurchaseAmount =
				currentNetPurchaseAmount - rootCapitalizationTotal;
			const selectedCapitalizations = asset.capitalizationsAsTarget.filter(
				(capitalization) =>
					(capitalization.financeBookId === null && !selectedBook) ||
					capitalizationFinanceBookId(
						capitalization,
						company.defaultFinanceBookId,
						asset,
					) === selectedBook?.financeBookId,
			);
			const capitalizationThroughAsOf = selectedCapitalizations
				.filter((capitalization) =>
					isOnOrBefore(capitalization.postingDate, toDate),
				)
				.reduce(
					(total, capitalization) =>
						total +
						toFiniteNumber(
							capitalization.totalValue,
							"capitalization value",
							assetSeries,
						),
					0,
				);
			const grossValue = roundCurrency(
				baseNetPurchaseAmount + capitalizationThroughAsOf,
			);

			if (asset.calculateDepreciation && selectedBook) {
				const ambiguousLegacyAdjustments = asset.valueAdjustments.filter(
					(adjustment) =>
						adjustment.financeBookId === null &&
						isOnOrBefore(adjustment.adjustmentDate, toDate),
				);
				if (ambiguousLegacyAdjustments.length > 0) {
					throw new BadRequestException(
						`Asset ${asset.series} has submitted value adjustments without finance-book lineage before ${toDate}.`,
					);
				}
			}

			let depreciatedAmount = 0;
			for (const entry of asset.depreciationJournalEntries) {
				if (
					!selectedBook ||
					entry.assetFinanceBookId !== selectedBook.id ||
					!isOnOrBefore(entry.postingDate, toDate)
				) {
					continue;
				}
				const amount = toFiniteNumber(
					entry.depreciationAmount,
					"posted depreciation",
					assetSeries,
				);
				depreciatedAmount += amount;
			}

			let revaluationAmount = 0;
			for (const adjustment of asset.valueAdjustments) {
				if (
					!financeBookLineageMatches(adjustment.financeBookId, selectedBook) ||
					!isOnOrBefore(adjustment.adjustmentDate, toDate)
				) {
					continue;
				}
				revaluationAmount += toFiniteNumber(
					adjustment.differenceAmount,
					"value adjustment",
					assetSeries,
				);
			}

			const accumulatedDepreciation = roundCurrency(
				openingAccumulatedDepreciation + depreciatedAmount,
			);
			const netBookValue = roundCurrency(
				grossValue - accumulatedDepreciation + revaluationAmount,
			);
			if (
				!Number.isFinite(grossValue) ||
				!Number.isFinite(accumulatedDepreciation) ||
				!Number.isFinite(revaluationAmount) ||
				!Number.isFinite(netBookValue) ||
				grossValue < -0.000001 ||
				accumulatedDepreciation < -0.000001 ||
				netBookValue < -0.000001
			) {
				throw new BadRequestException(
					`Asset ${asset.series} has inconsistent book values at ${toDate}.`,
				);
			}

			const status = resolveStatusAtAsOf(
				asset,
				selectedBook,
				Boolean(
					requestedFinanceBookId ||
						company.defaultFinanceBookId ||
						selectedBook,
				),
				toDate,
			);
			const isDisposed = terminalStatus(status);
			if (
				(statusFilter === "IN_LOCATION" && isDisposed) ||
				(statusFilter === "DISPOSED" && !isDisposed)
			) {
				continue;
			}

			const groupingKey =
				input.groupBy === "ASSET_CATEGORY"
					? (asset.assetCategory?.id ?? "UNCATEGORIZED")
					: (asset.location?.id ?? "UNALLOCATED");
			const groupingLabel =
				input.groupBy === "ASSET_CATEGORY"
					? (asset.assetCategory?.name ?? "Uncategorized")
					: (asset.location?.name ?? "Unallocated");

			const purchaseDate = dateOnly(asset.purchaseDate);
			const row: Asset.FixedAssetRegisterRow = {
				groupingKey,
				groupingLabel,
				assetId: asset.id,
				assetSeries: asset.series,
				assetName: asset.assetName,
				assetCategoryId: asset.assetCategory?.id ?? null,
				assetCategoryName: asset.assetCategory?.name ?? null,
				locationId: asset.location?.id ?? null,
				locationName: asset.location?.name ?? null,
				companyId: asset.companyId,
				company: asset.company.name,
				purchaseDate,
				availableForUseDate: asset.availableForUseDate
					? dateOnly(asset.availableForUseDate)
					: null,
				status,
				netPurchaseAmount: roundCurrency(grossValue),
				openingAccumulatedDepreciation: roundCurrency(
					openingAccumulatedDepreciation,
				),
				depreciatedAmount: roundCurrency(depreciatedAmount),
				accumulatedDepreciation,
				revaluationAmount: roundCurrency(revaluationAmount),
				netBookValue: Math.max(roundCurrency(netBookValue), 0),
			};
			rows.push(row);

			// ERPNext's chart is a grouped projection of the report rows. The
			// default date field is Purchase Date; lifecycle posting months do not
			// create independent chart events.
			if (isInReportWindow(asset.purchaseDate, fromDate, toDate)) {
				const chartPoint = monthlyChartMap.get(monthKey(purchaseDate));
				if (chartPoint) {
					chartPoint.assetValue +=
						row.netPurchaseAmount -
						row.openingAccumulatedDepreciation -
						row.depreciatedAmount +
						row.revaluationAmount;
					chartPoint.depreciatedAmount += row.depreciatedAmount;
				}
			}

			totalPurchaseAmount += grossValue;
			totalDepreciatedAmount += depreciatedAmount;
			totalAccumulatedDepreciation += accumulatedDepreciation;
			totalRevaluationAmount += revaluationAmount;
			totalNetBookValue += netBookValue;
		}

		return {
			rows,
			chartPoints: Array.from(monthlyChartMap.entries()).map(
				([month, value]) => ({
					month,
					assetValue: roundCurrency(value.assetValue),
					depreciatedAmount: roundCurrency(value.depreciatedAmount),
				}),
			),
			summary: {
				totalAssets: rows.length,
				totalPurchaseAmount: roundCurrency(totalPurchaseAmount),
				totalDepreciatedAmount: roundCurrency(totalDepreciatedAmount),
				totalAccumulatedDepreciation: roundCurrency(
					totalAccumulatedDepreciation,
				),
				totalRevaluationAmount: roundCurrency(totalRevaluationAmount),
				totalNetBookValue: roundCurrency(totalNetBookValue),
			},
			scope: {
				organizationId,
				companyId: company.id,
				company: company.name,
				financeBookId: scopeFinanceBookId,
				financeBook: scopeFinanceBookName,
				financeBookSelection,
				fromDate,
				toDate,
				asOfDate: toDate,
				status: statusFilter,
			},
		};
	}
}
