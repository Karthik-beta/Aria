/**
 * Asset service — CRUD for Assets, Locations, and Asset Categories.
 *
 * Follows the ERPNext Asset module business logic:
 * - Series generated as AST-YYYY-NNNNN
 * - Status lifecycle: DRAFT → SUBMITTED → depreciation states / SOLD / SCRAPPED
 * - All amounts stored as Decimal(18,6) in DB, returned as number to clients
 *
 * @module AssetService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/asset | ERPNext Asset}
 */
import type { Asset } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import {
	allocateDocumentSeries,
	formatDocumentSeries,
	getSeriesSeedValue,
} from "../../shared/document-series";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { FiscalYearService } from "../../shared/fiscal-year/fiscal-year.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import type { PrismaAssetCapitalization } from "./asset.types";
import {
	toAsset,
	toAssetCapitalizationItem,
	toAssetCategory,
	toAssetDepreciationSchedule,
	toAssetDisposalItem,
	toAssetLocation,
	toAssetMaintenance,
	toAssetMaintenanceLog,
	toAssetMaintenanceLogListItem,
	toAssetMovement,
	toAssetRepairItem,
	toAssetValueAdjustment,
	toMaintenanceTeam,
} from "./asset.types";
import { AssetAccountingService } from "./asset-accounting.service";
import { buildAssetActivityReportResult } from "./asset-activity-report";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetDashboardSubService } from "./asset-dashboard.service";
import { buildAssetDepreciationLedgerResult } from "./asset-depreciation-ledger-report";
import { buildAssetDepreciationsAndBalancesResult } from "./asset-depreciations-and-balances-report";
import {
	type AssetOrganizationId,
	assertAssetOrganizationId,
	assetWhereForOrganization,
	companyWhereForOrganization,
} from "./asset-organization-scope";
import { AssetStockPostingService } from "./asset-stock-posting.service";
import {
	buildDepreciationSchedulePreview,
	buildRevaluationEntryLines,
	deriveFixedAssetAccount,
	getAssetValueAdjustmentDirection,
	getAssetValueAdjustmentResultState,
} from "./asset-value-adjustment.utils";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetDepreciationLifecycleService } from "./depreciation/asset-depreciation-lifecycle.service";
import { AssetDepreciationRevisionService } from "./depreciation/asset-depreciation-revision.service";
import {
	businessDate,
	dateOnlyUtc,
	depreciationTimeZone,
} from "./depreciation/depreciation.config";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { DepreciationBarrierService } from "./depreciation/depreciation-barrier.service";
import { FixedAssetRegisterReportService } from "./fixed-asset-register-report";
import {
	inferRestoredAssetStatus,
	type RestorableAssetStatus,
	resolveMaintenanceAssetStatus,
} from "./maintenance-status";

const LIST_TAKE_MAX = 250;
const CURRENCY_SCALE = 6;

@Injectable()
export class AssetService {
	private readonly logger = new Logger(AssetService.name);
	private readonly assetInclude = {
		assetCategory: { select: { id: true, name: true } },
		company: { select: { id: true, name: true, organizationId: true } },
		location: { select: { id: true, name: true } },
		activities: {
			include: { user: { select: { id: true, name: true } } },
			orderBy: { createdAt: "desc" as const },
		},
		financeBooks: {
			include: { financeBook: { select: { name: true } } },
			orderBy: { createdAt: "asc" as const },
		},
	} as const;

	private readonly assetMovementInclude = {
		company: { select: { id: true, name: true } },
		items: {
			include: {
				sourceLocation: { select: { name: true } },
				targetLocation: { select: { name: true } },
				asset: { select: { assetName: true } },
			},
		},
	} as const;

	private readonly assetRepairInclude = {
		company: { select: { id: true, name: true } },
		asset: { select: { assetName: true } },
		consumedItems: {
			include: {
				consumedAsset: { select: { assetName: true } },
			},
		},
		purchaseInvoices: true,
	} as const;

	private readonly assetCapitalizationInclude = {
		company: { select: { id: true, name: true } },
		targetAsset: { select: { assetName: true } },
		stockItems: true,
		assetItems: {
			include: {
				asset: { select: { assetName: true } },
			},
		},
		serviceItems: true,
	} as const;

	private readonly assetDisposalInclude = {
		company: { select: { id: true, name: true } },
		asset: { select: { assetName: true } },
		accountingEntry: { select: { series: true } },
	} as const;

	private readonly assetAdjustmentInclude = {
		financeBook: { select: { name: true } },
		asset: {
			select: {
				id: true,
				series: true,
				assetName: true,
				companyId: true,
				company: { select: { name: true } },
				assetCategory: { select: { name: true } },
			},
		},
		revaluationEntry: {
			include: {
				company: { select: { id: true, name: true } },
				lines: { orderBy: { createdAt: "asc" as const } },
			},
		},
		depreciationSchedule: {
			include: {
				entries: { orderBy: { sequence: "asc" as const } },
			},
		},
	} as const;

	private readonly assetAdjustmentContextSelect = {
		id: true,
		series: true,
		assetName: true,
		companyId: true,
		company: { select: { id: true, name: true, organizationId: true } },
		status: true,
		purchaseDate: true,
		availableForUseDate: true,
		netPurchaseAmount: true,
		openingAccumulatedDepreciation: true,
		openingNumberOfBookedDepreciations: true,
		isFullyDepreciated: true,
		valueAfterDepreciation: true,
		calculateDepreciation: true,
		depreciationMethod: true,
		totalNumberOfDepreciations: true,
		frequencyOfDepreciation: true,
		assetCategory: {
			select: {
				id: true,
				name: true,
				depreciationMethod: true,
				totalNumberOfDepreciations: true,
				frequencyOfDepreciation: true,
				dailyProrataBased: true,
				shiftBased: true,
				rateOfDepreciation: true,
				expectedValueAfterUsefulLife: true,
				nonDepreciableCategory: true,
			},
		},
		financeBooks: {
			include: { financeBook: { select: { name: true } } },
			orderBy: { createdAt: "asc" as const },
		},
	} as const;

	constructor(
		private readonly prisma: PrismaService,
		private readonly dashboard: AssetDashboardSubService,
		private readonly fiscalYearService: FiscalYearService,
		private readonly depreciationLifecycle?: AssetDepreciationLifecycleService,
		private readonly depreciationBarrier?: DepreciationBarrierService,
		private readonly fixedAssetRegisterReportService?: FixedAssetRegisterReportService,
		private readonly accounting: AssetAccountingService = new AssetAccountingService(),
		private readonly stockPosting: AssetStockPostingService = new AssetStockPostingService(),
		private readonly depreciationRevision: AssetDepreciationRevisionService = new AssetDepreciationRevisionService(),
	) {}

	private async ensureReportDepreciation(
		toDate: Date,
		organizationId: AssetOrganizationId,
		company?: string,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		const today = dateOnlyUtc(businessDate(depreciationTimeZone()));
		const throughDate = toDate < today ? toDate : today;
		await this.depreciationBarrier?.ensureDepreciationPosted({
			kind: "organization",
			organizationId,
			throughDate,
			...(company ? { company } : {}),
		});
	}

	private assertOrganizationScope(organizationId: AssetOrganizationId): void {
		assertAssetOrganizationId(organizationId);
	}

	/** Applies organization ownership to a capitalization and every linked asset. */
	private assetCapitalizationWhereForOrganization(
		organizationId: AssetOrganizationId,
		where: Prisma.AssetCapitalizationWhereInput = {},
	): Prisma.AssetCapitalizationWhereInput {
		return {
			AND: [
				{ company: { is: { organizationId } } },
				{
					assetItems: {
						every: {
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
				{
					OR: [
						{ targetAssetId: null },
						{
							targetAsset: {
								is: assetWhereForOrganization(organizationId),
							},
						},
					],
				},
				where,
			],
		};
	}

	/** Resolves a stable Company ID against the trusted active Organization. */
	private async resolveCompanyForOrganization(
		organizationId: string,
		companyId: string,
		client: PrismaService | Prisma.TransactionClient = this.prisma,
	): Promise<{ id: string; name: string }> {
		if (!organizationId || organizationId === "__super_admin__") {
			throw new BadRequestException(
				"Select an organization before accessing asset data",
			);
		}

		const company = await client.company.findFirst({
			where: { id: companyId, organizationId },
			select: { id: true, name: true, disabled: true },
		});
		if (!company) {
			throw new NotFoundException(
				`Company "${companyId}" is not available in the active organization`,
			);
		}
		if (company.disabled) {
			throw new BadRequestException(
				`Company "${company.name}" is disabled in the active organization`,
			);
		}

		return { id: company.id, name: company.name };
	}

	// ============================================================================
	// Dashboard
	// ============================================================================

	async getDashboardData(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardData> {
		this.assertOrganizationScope(organizationId);
		return this.dashboard.getDashboardData(organizationId);
	}

	async getDashboardOverviewData(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardOverviewData> {
		this.assertOrganizationScope(organizationId);
		return this.dashboard.getDashboardOverviewData(organizationId);
	}

	async getDashboardTopChartsData(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardTopChartsData> {
		this.assertOrganizationScope(organizationId);
		return this.dashboard.getDashboardTopChartsData(organizationId);
	}

	async getDashboardBottomChartsData(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardBottomChartsData> {
		this.assertOrganizationScope(organizationId);
		return this.dashboard.getDashboardBottomChartsData(organizationId);
	}

	// ============================================================================
	// Series Generation
	// ============================================================================

	/**
	 * Generates a unique asset series in format AST-YYYY-NNNNN.
	 * Uses a database-backed counter to stay safe under concurrent creates.
	 */
	/**
	 * Generates the next sequential series identifier for an asset.
	 * Format: AST-YYYY-NNNNN
	 */
	private async generateAssetSeries(
		date: Date,
		organizationId: AssetOrganizationId,
		tx?: Prisma.TransactionClient,
	): Promise<string> {
		const client = tx ?? this.prisma;
		const year = date.getFullYear();
		const prefix = `AST-${year}-`;
		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			const updated = await client.documentSeriesCounter.update({
				where: { key: prefix },
				data: { value: { increment: 1 } },
			});
			return formatDocumentSeries(prefix, updated.value);
		}

		const last = await client.asset.findFirst({
			where: assetWhereForOrganization(organizationId, {
				series: { startsWith: prefix },
			}),
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, last?.series),
		);
	}

	/**
	 * Generates the next sequential series identifier for an asset value adjustment.
	 * Format: AVA-YYYY-NNNNN
	 */
	private async generateAssetValueAdjustmentSeries(
		date: Date,
		organizationId: AssetOrganizationId,
		tx?: Prisma.TransactionClient,
	): Promise<string> {
		const client = tx ?? this.prisma;
		const year = date.getFullYear();
		const prefix = `AVA-${year}-`;
		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			const updated = await client.documentSeriesCounter.update({
				where: { key: prefix },
				data: { value: { increment: 1 } },
			});
			return formatDocumentSeries(prefix, updated.value);
		}

		const last = await client.assetValueAdjustment.findFirst({
			where: {
				AND: [
					{ asset: { is: assetWhereForOrganization(organizationId) } },
					{ series: { startsWith: prefix } },
				],
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, last?.series),
		);
	}

	/**
	 * Generates the next sequential series identifier for an asset revaluation journal entry.
	 * Format: JE-AVA-YYYY-NNNNN
	 */
	private async generateAssetRevaluationEntrySeries(
		date: Date,
		organizationId: AssetOrganizationId,
		tx?: Prisma.TransactionClient,
	): Promise<string> {
		const client = tx ?? this.prisma;
		const year = date.getFullYear();
		const prefix = `JE-AVA-${year}-`;
		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			const updated = await client.documentSeriesCounter.update({
				where: { key: prefix },
				data: { value: { increment: 1 } },
			});
			return formatDocumentSeries(prefix, updated.value);
		}

		const last = await client.assetRevaluationEntry.findFirst({
			where: {
				AND: [
					{ company: { is: { organizationId } } },
					{ asset: { is: assetWhereForOrganization(organizationId) } },
					{ series: { startsWith: prefix } },
				],
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, last?.series),
		);
	}

	/**
	 * Generates the next sequential series identifier for an asset movement.
	 * Format: MOV-YYYY-NNNNN
	 */
	private async generateAssetMovementSeries(
		date: Date,
		organizationId: AssetOrganizationId,
		tx?: Prisma.TransactionClient,
	): Promise<string> {
		const client = tx ?? this.prisma;
		const year = date.getFullYear();
		const prefix = `MOV-${year}-`;
		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			const updated = await client.documentSeriesCounter.update({
				where: { key: prefix },
				data: { value: { increment: 1 } },
			});
			return formatDocumentSeries(prefix, updated.value);
		}

		const last = await client.assetMovement.findFirst({
			where: {
				AND: [
					{ company: { is: { organizationId } } },
					{ series: { startsWith: prefix } },
				],
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, last?.series),
		);
	}

	/**
	 * Generates the next sequential series identifier for an asset repair.
	 * Format: REP-YYYY-NNNNN
	 */
	private async generateAssetRepairSeries(
		date: Date,
		organizationId: AssetOrganizationId,
		tx?: Prisma.TransactionClient,
	): Promise<string> {
		const client = tx ?? this.prisma;
		const year = date.getFullYear();
		const prefix = `REP-${year}-`;
		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			const updated = await client.documentSeriesCounter.update({
				where: { key: prefix },
				data: { value: { increment: 1 } },
			});
			return formatDocumentSeries(prefix, updated.value);
		}

		const last = await client.assetRepair.findFirst({
			where: {
				AND: [
					{ company: { is: { organizationId } } },
					{ asset: { is: assetWhereForOrganization(organizationId) } },
					{ series: { startsWith: prefix } },
				],
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, last?.series),
		);
	}

	/**
	 * Generates the next sequential series identifier for an asset capitalization.
	 * Format: CAP-YYYY-NNNNN
	 */
	private async generateAssetCapitalizationSeries(
		date: Date,
		organizationId: AssetOrganizationId,
		tx?: Prisma.TransactionClient,
	): Promise<string> {
		const client = tx ?? this.prisma;
		const year = date.getFullYear();
		const prefix = `CAP-${year}-`;
		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			const updated = await client.documentSeriesCounter.update({
				where: { key: prefix },
				data: { value: { increment: 1 } },
			});
			return formatDocumentSeries(prefix, updated.value);
		}

		const last = await client.assetCapitalization.findFirst({
			where: this.assetCapitalizationWhereForOrganization(organizationId, {
				series: { startsWith: prefix },
			}),
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, last?.series),
		);
	}

	/**
	 * Generates the next sequential series identifier for an asset disposal.
	 * Format: DISP-YYYY-NNNNN
	 */
	private async generateAssetDisposalSeries(
		date: Date,
		organizationId: AssetOrganizationId,
		tx?: Prisma.TransactionClient,
	): Promise<string> {
		const client = tx ?? this.prisma;
		const year = date.getFullYear();
		const prefix = `DISP-${year}-`;
		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			const updated = await client.documentSeriesCounter.update({
				where: { key: prefix },
				data: { value: { increment: 1 } },
			});
			return formatDocumentSeries(prefix, updated.value);
		}

		const last = await client.assetDisposal.findFirst({
			where: {
				AND: [
					{ company: { is: { organizationId } } },
					{ asset: { is: assetWhereForOrganization(organizationId) } },
					{ series: { startsWith: prefix } },
				],
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, last?.series),
		);
	}

	private roundCurrency(value: number): number {
		return Number(value.toFixed(CURRENCY_SCALE));
	}

	private assertValidOperationalDate(date: Date, label: string): void {
		if (Number.isNaN(date.getTime())) {
			throw new BadRequestException(`${label} must be a valid date.`);
		}
		const today = dateOnlyUtc(businessDate(depreciationTimeZone()));
		if (dateOnlyUtc(date) > today) {
			throw new BadRequestException(`${label} cannot be in the future.`);
		}
	}

	private async lockAssets(
		tx: Prisma.TransactionClient,
		assetIds: readonly string[],
	): Promise<void> {
		for (const assetId of [...new Set(assetIds)].sort()) {
			await tx.$queryRaw(Prisma.sql`
				SELECT pg_advisory_xact_lock(hashtext(${`asset:${assetId}`})) IS NULL AS "locked"
			`);
		}
	}

	private async lockMaintenanceTeams(
		tx: Prisma.TransactionClient,
		teamIds: readonly string[],
	): Promise<void> {
		if (typeof tx.$queryRaw !== "function") return;
		for (const teamId of [...new Set(teamIds)].sort()) {
			await tx.$queryRaw(Prisma.sql`
				SELECT pg_advisory_xact_lock(hashtext(${`maintenance-team:${teamId}`})) IS NULL AS "locked"
			`);
		}
	}

	/** Keeps maintenance-driven status transitions deterministic across API and scheduler paths. */
	private async syncMaintenanceAssetStatus(
		tx: Prisma.TransactionClient,
		assetId: string,
		organizationId: AssetOrganizationId,
		restoredStatus?: RestorableAssetStatus,
	): Promise<void> {
		const asset = await tx.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			select: {
				status: true,
				isFullyDepreciated: true,
				valueAfterDepreciation: true,
				netPurchaseAmount: true,
			},
		});
		if (!asset) return;

		const [openRepair, dueMaintenance, postedDepreciations] = await Promise.all(
			[
				tx.assetRepair.findFirst({
					where: {
						assetId,
						asset: { is: assetWhereForOrganization(organizationId) },
						repairStatus: { in: ["DRAFT", "PENDING"] },
					},
					select: { id: true },
				}),
				tx.assetMaintenanceTask.findFirst({
					where: {
						maintenance: {
							is: {
								assetId,
								asset: { is: assetWhereForOrganization(organizationId) },
							},
						},
						OR: [
							{ maintenanceStatus: "OVERDUE" },
							{
								maintenanceStatus: "PLANNED",
								nextDueDate: { lte: new Date() },
							},
						],
					},
					select: { id: true },
				}),
				tx.assetDepreciationJournalEntry.count({
					where: {
						assetId,
						asset: { is: assetWhereForOrganization(organizationId) },
						status: "POSTED",
					},
				}),
			],
		);

		const fallback =
			restoredStatus ??
			inferRestoredAssetStatus({
				isFullyDepreciated: asset.isFullyDepreciated,
				valueAfterDepreciation: asset.valueAfterDepreciation,
				netPurchaseAmount: asset.netPurchaseAmount,
				hasPostedDepreciation: postedDepreciations > 0,
			});
		const desired = resolveMaintenanceAssetStatus({
			hasOpenRepair: Boolean(openRepair),
			hasDueMaintenance: Boolean(dueMaintenance),
			restoredStatus: fallback,
		});
		if (
			asset.status === "IN_MAINTENANCE" ||
			asset.status === "OUT_OF_ORDER" ||
			openRepair ||
			dueMaintenance
		) {
			if (asset.status !== desired) {
				await this.updateOwnedAsset(tx, organizationId, assetId, {
					status: desired,
				});
			}
		}
	}

	/** Mutates an Asset only when its Company still belongs to the trusted organization. */
	private async updateOwnedAsset(
		tx: Prisma.TransactionClient,
		organizationId: AssetOrganizationId,
		assetId: string,
		data: Prisma.AssetUpdateManyArgs["data"],
	): Promise<void> {
		const updated = await tx.asset.updateMany({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			data,
		});
		if (updated.count !== 1) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}
	}

	private async getAssetAccountingContext(
		tx: Prisma.TransactionClient,
		organizationId: AssetOrganizationId,
		asset: {
			series: string;
			companyId: string;
			assetCategoryId: string | null;
		},
		costCenter?: string | null,
	): Promise<{
		fixedAssetAccount: string;
		accumulatedDepreciationAccount: string | null;
		costCenter: string | null;
	}> {
		if (!asset.assetCategoryId) {
			throw new BadRequestException(
				`Asset ${asset.series} requires an asset category before accounting can be posted.`,
			);
		}
		const company = await tx.company.findFirst({
			where: companyWhereForOrganization(organizationId, {
				id: asset.companyId,
			}),
			select: {
				id: true,
				name: true,
				disabled: true,
				defaultCostCenter: true,
				accumulatedDepreciationAccount: true,
			},
		});
		if (!company || company.disabled) {
			throw new BadRequestException(
				`Company ${asset.companyId} is missing or disabled.`,
			);
		}
		const accounts = await tx.assetCategoryAccount.findUnique({
			where: {
				assetCategoryId_companyId: {
					assetCategoryId: asset.assetCategoryId,
					companyId: company.id,
				},
			},
			select: {
				fixedAssetAccount: true,
				accumulatedDepreciationAccount: true,
			},
		});
		if (!accounts?.fixedAssetAccount.trim()) {
			throw new BadRequestException(
				`A fixed asset account is required for asset ${asset.series} and company ${company.name}.`,
			);
		}
		return {
			fixedAssetAccount: accounts.fixedAssetAccount.trim(),
			accumulatedDepreciationAccount:
				accounts.accumulatedDepreciationAccount?.trim() ||
				company.accumulatedDepreciationAccount?.trim() ||
				null,
			costCenter:
				costCenter?.trim() || company.defaultCostCenter?.trim() || null,
		};
	}

	private async getFixedAssetBalance(
		tx: Prisma.TransactionClient,
		organizationId: AssetOrganizationId,
		assetId: string,
		netPurchaseAmount: number,
	): Promise<number> {
		const adjustments = await tx.assetValueAdjustment.aggregate({
			where: {
				assetId,
				status: "SUBMITTED",
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			_sum: { differenceAmount: true },
		});
		return this.roundCurrency(
			netPurchaseAmount + Number(adjustments._sum.differenceAmount ?? 0),
		);
	}

	private normalizeOptionalText(
		value: string | null | undefined,
	): string | null {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	}

	private getOpeningAssetValue(
		netPurchaseAmount: number | null | undefined,
		openingAccumulatedDepreciation: number | null | undefined,
	): number {
		return Math.max(
			this.roundCurrency(
				(netPurchaseAmount ?? 0) - (openingAccumulatedDepreciation ?? 0),
			),
			0,
		);
	}

	private getLastDayOfMonth(date: Date): Date {
		const d = new Date(date);
		d.setMonth(d.getMonth() + 1, 0);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	private validateDepreciationFields(
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
		if (
			totalNumberOfDepreciations !== null &&
			totalNumberOfDepreciations <= 0
		) {
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
					`Opening accumulated depreciation must not exceed depreciable amount (${this.roundCurrency(depreciableAmount)})`,
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

	private resolveCurrentAssetValue(asset: {
		valueAfterDepreciation: Prisma.Decimal | null;
		netPurchaseAmount: Prisma.Decimal | null;
		openingAccumulatedDepreciation: Prisma.Decimal | null;
	}): number {
		const explicitValue = Number(asset.valueAfterDepreciation ?? 0);
		if (explicitValue > 0) {
			return this.roundCurrency(explicitValue);
		}

		return this.getOpeningAssetValue(
			asset.netPurchaseAmount ? Number(asset.netPurchaseAmount) : 0,
			asset.openingAccumulatedDepreciation
				? Number(asset.openingAccumulatedDepreciation)
				: 0,
		);
	}

	private async getAssetCategoryDefaults(assetCategoryId?: string | null) {
		if (!assetCategoryId) {
			return null;
		}

		return this.prisma.assetCategory.findUnique({
			where: { id: assetCategoryId },
			select: {
				id: true,
				name: true,
				depreciationMethod: true,
				totalNumberOfDepreciations: true,
				frequencyOfDepreciation: true,
				nonDepreciableCategory: true,
				expectedValueAfterUsefulLife: true,
			},
		});
	}

	/** Validates company-owned category accounts while keeping shared masters global. */
	private async validateAssetCategoryReferences(
		organizationId: AssetOrganizationId,
		accounts?: readonly { companyId: string }[] | null,
		financeBooks?: readonly { financeBookId: string }[] | null,
	): Promise<void> {
		this.assertOrganizationScope(organizationId);
		for (const companyId of new Set(
			(accounts ?? []).map((account) => account.companyId),
		)) {
			await this.resolveCompanyForOrganization(organizationId, companyId);
		}

		const financeBookIds = [
			...new Set((financeBooks ?? []).map((book) => book.financeBookId)),
		];
		if (financeBookIds.length === 0) return;
		const existingFinanceBooks = await this.prisma.financeBook.findMany({
			where: { id: { in: financeBookIds } },
			select: { id: true },
		});
		if (existingFinanceBooks.length !== financeBookIds.length) {
			throw new NotFoundException(
				"One or more finance books referenced by the asset category do not exist",
			);
		}
	}

	/**
	 * Builds the canonical Company ownership predicate for category accounts.
	 * The category remains shared; only rows whose Company belongs to the
	 * trusted active Organization may be read or replaced.
	 */
	private assetCategoryAccountsWhereForOrganization(
		organizationId: AssetOrganizationId,
	): Prisma.AssetCategoryAccountWhereInput {
		return {
			company: { is: companyWhereForOrganization(organizationId) },
		};
	}

	/**
	 * Hydrates shared category fields and only this Organization's account
	 * defaults. Finance-book defaults remain shared under the current model.
	 */
	private assetCategoryIncludeForOrganization(
		organizationId: AssetOrganizationId,
	) {
		return {
			financeBookDefaults: {
				include: { financeBook: { select: { name: true } } },
				orderBy: { createdAt: "asc" as const },
			},
			accounts: {
				where: this.assetCategoryAccountsWhereForOrganization(organizationId),
				include: { company: { select: { name: true } } },
				orderBy: { createdAt: "asc" as const },
			},
		} as const;
	}

	/** Resolves every Company ID owned by the trusted Organization for writes. */
	private async findOrganizationCompanyIds(
		organizationId: AssetOrganizationId,
	): Promise<string[]> {
		const companies = await this.prisma.company.findMany({
			where: companyWhereForOrganization(organizationId),
			select: { id: true },
		});
		return companies.map((company) => company.id);
	}

	private async getAssetAdjustmentContextOrThrow(
		assetId: string,
		organizationId: AssetOrganizationId,
		client: Pick<Prisma.TransactionClient, "asset"> = this.prisma,
	) {
		this.assertOrganizationScope(organizationId);
		const asset = await client.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			select: this.assetAdjustmentContextSelect,
		});

		if (!asset) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}

		return {
			id: asset.id,
			series: asset.series,
			assetName: asset.assetName,
			companyId: asset.companyId,
			company: asset.company.name,
			status: asset.status as Asset.AssetStatus,
			purchaseDate: asset.purchaseDate,
			availableForUseDate: asset.availableForUseDate ?? null,
			netPurchaseAmount: asset.netPurchaseAmount,
			openingAccumulatedDepreciation: asset.openingAccumulatedDepreciation,
			openingNumberOfBookedDepreciations:
				asset.openingNumberOfBookedDepreciations,
			isFullyDepreciated: asset.isFullyDepreciated,
			valueAfterDepreciation: asset.valueAfterDepreciation,
			calculateDepreciation: asset.calculateDepreciation,
			depreciationMethod:
				(asset.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
			totalNumberOfDepreciations: asset.totalNumberOfDepreciations ?? null,
			frequencyOfDepreciation: asset.frequencyOfDepreciation ?? null,
			assetCategory: asset.assetCategory
				? {
						id: asset.assetCategory.id,
						name: asset.assetCategory.name,
						depreciationMethod:
							(asset.assetCategory
								.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
						totalNumberOfDepreciations:
							asset.assetCategory.totalNumberOfDepreciations ?? null,
						frequencyOfDepreciation:
							asset.assetCategory.frequencyOfDepreciation ?? null,
						dailyProrataBased: asset.assetCategory.dailyProrataBased ?? null,
						shiftBased: asset.assetCategory.shiftBased ?? null,
						rateOfDepreciation: asset.assetCategory.rateOfDepreciation ?? null,
						expectedValueAfterUsefulLife:
							asset.assetCategory.expectedValueAfterUsefulLife ?? null,
						nonDepreciableCategory: asset.assetCategory.nonDepreciableCategory,
					}
				: null,
			financeBooks: asset.financeBooks.map((book) => ({
				id: book.id,
				financeBookId: book.financeBookId,
				financeBookName: book.financeBook.name,
				depreciationMethod: book.depreciationMethod as Asset.DepreciationMethod,
				totalNumberOfDepreciations: book.totalNumberOfDepreciations,
				frequencyOfDepreciation: book.frequencyOfDepreciation,
				depreciationStartDate: book.depreciationStartDate,
				dailyProrataBased: book.dailyProrataBased,
				shiftBased: book.shiftBased,
				rateOfDepreciation:
					book.rateOfDepreciation == null
						? null
						: Number(book.rateOfDepreciation),
				expectedValueAfterUsefulLife: Number(book.expectedValueAfterUsefulLife),
				openingAccumulatedDepreciation: Number(
					book.openingAccumulatedDepreciation,
				),
				openingNumberOfBookedDepreciations:
					book.openingNumberOfBookedDepreciations,
				valueAfterDepreciation: Number(book.valueAfterDepreciation),
				totalNumberOfBookedDepreciations: book.totalNumberOfBookedDepreciations,
				lastPostedDepreciationDate: book.lastPostedDepreciationDate ?? null,
				postingStatus: book.postingStatus as Asset.DepreciationPostingStatus,
			})),
		};
	}

	private resolveAssetAdjustmentFinanceBook(
		asset: Pick<
			Awaited<ReturnType<AssetService["getAssetAdjustmentContextOrThrow"]>>,
			"financeBooks" | "series"
		>,
		financeBookId?: string | null,
	) {
		if (financeBookId) {
			const selected = asset.financeBooks.find(
				(book) => book.financeBookId === financeBookId,
			);
			if (!selected) {
				throw new BadRequestException(
					`Finance book ${financeBookId} is not configured for asset ${asset.series}.`,
				);
			}
			return selected;
		}

		return asset.financeBooks.length === 1 ? asset.financeBooks[0] : null;
	}

	private getAdjustedSalvageValue(
		currentAssetValue: number,
		newAssetValue: number,
		currentSalvageValue: number,
	): number {
		if (currentSalvageValue <= 0 || currentAssetValue <= 0) {
			return this.roundCurrency(Math.max(currentSalvageValue, 0));
		}

		return this.roundCurrency(
			(currentSalvageValue * newAssetValue) / currentAssetValue,
		);
	}

	private assertAssetValueAdjustmentPreviewIsValid(
		preview: Asset.AssetValueAdjustmentPreview,
	): void {
		if (preview.validationMessages.length > 0) {
			throw new BadRequestException(preview.validationMessages[0]);
		}
	}

	private async buildAssetValueAdjustmentPreview(
		asset: {
			id: string;
			series: string;
			assetName: string;
			companyId: string;
			company: string;
			status: Asset.AssetStatus;
			purchaseDate: Date;
			netPurchaseAmount: Prisma.Decimal | null;
			openingAccumulatedDepreciation: Prisma.Decimal | null;
			openingNumberOfBookedDepreciations: number;
			isFullyDepreciated: boolean;
			valueAfterDepreciation: Prisma.Decimal | null;
			calculateDepreciation: boolean;
			depreciationMethod: Asset.DepreciationMethod | null;
			totalNumberOfDepreciations: number | null;
			frequencyOfDepreciation: number | null;
			assetCategory: {
				name: string;
				depreciationMethod: Asset.DepreciationMethod | null;
				totalNumberOfDepreciations: number | null;
				frequencyOfDepreciation: number | null;
				dailyProrataBased: boolean | null;
				shiftBased: boolean | null;
				rateOfDepreciation: number | null;
				expectedValueAfterUsefulLife: Prisma.Decimal | null;
				nonDepreciableCategory: boolean;
			} | null;
			financeBooks: Array<{
				id: string;
				financeBookId: string;
				financeBookName: string;
				depreciationMethod: Asset.DepreciationMethod;
				totalNumberOfDepreciations: number;
				frequencyOfDepreciation: number;
				depreciationStartDate: Date;
				dailyProrataBased: boolean;
				shiftBased: boolean;
				rateOfDepreciation: number | null;
				expectedValueAfterUsefulLife: number;
				openingAccumulatedDepreciation: number;
				openingNumberOfBookedDepreciations: number;
				valueAfterDepreciation: number;
				totalNumberOfBookedDepreciations: number;
				lastPostedDepreciationDate: Date | null;
				postingStatus: Asset.DepreciationPostingStatus;
			}>;
		},
		input: Pick<
			Asset.PreviewAssetValueAdjustmentInput,
			"adjustmentDate" | "financeBookId" | "newAssetValue"
		>,
	): Promise<Asset.AssetValueAdjustmentPreview> {
		const selectedFinanceBook = this.resolveAssetAdjustmentFinanceBook(
			asset,
			input.financeBookId,
		);
		const currentAssetValue = selectedFinanceBook
			? this.roundCurrency(selectedFinanceBook.valueAfterDepreciation)
			: this.resolveCurrentAssetValue(asset);
		const differenceAmount = this.roundCurrency(
			input.newAssetValue - currentAssetValue,
		);
		const adjustedSalvageValue = selectedFinanceBook
			? this.getAdjustedSalvageValue(
					currentAssetValue,
					input.newAssetValue,
					selectedFinanceBook.expectedValueAfterUsefulLife,
				)
			: null;
		const schedulePreview =
			asset.calculateDepreciation && selectedFinanceBook
				? await buildDepreciationSchedulePreview({
						adjustmentDate: input.adjustmentDate,
						currentAssetValue,
						newAssetValue: input.newAssetValue,
						purchaseAmount: asset.netPurchaseAmount
							? Number(asset.netPurchaseAmount)
							: 0,
						openingAccumulatedDepreciation:
							selectedFinanceBook.openingAccumulatedDepreciation,
						bookedDepreciations:
							selectedFinanceBook.totalNumberOfBookedDepreciations,
						depreciationMethod: selectedFinanceBook.depreciationMethod,
						totalNumberOfDepreciations:
							selectedFinanceBook.totalNumberOfDepreciations,
						frequencyOfDepreciation:
							selectedFinanceBook.frequencyOfDepreciation,
						dailyProrataBased: selectedFinanceBook.dailyProrataBased,
						shiftBased: selectedFinanceBook.shiftBased,
						rateOfDepreciation: selectedFinanceBook.rateOfDepreciation,
						expectedValueAfterUsefulLife: adjustedSalvageValue,
						getFiscalYearEndDate: (date: Date) =>
							this.fiscalYearService.getFiscalYearEndDate(date),
					})
				: null;
		const rootCurrentAssetValue = this.resolveCurrentAssetValue(asset);
		const resultingRootAssetValue = this.roundCurrency(
			rootCurrentAssetValue + differenceAmount,
		);
		const resultState = getAssetValueAdjustmentResultState(
			asset.status,
			resultingRootAssetValue,
		);
		const validationMessages: string[] = [];

		if (asset.calculateDepreciation && asset.financeBooks.length === 0) {
			validationMessages.push(
				"This depreciating asset has no configured finance book.",
			);
		} else if (asset.financeBooks.length > 1 && !input.financeBookId) {
			validationMessages.push(
				"Select the finance book whose carrying value and schedule should be revised.",
			);
		}

		if (
			asset.status === "DRAFT" ||
			asset.status === "CANCELLED" ||
			asset.status === "SOLD" ||
			asset.status === "SCRAPPED"
		) {
			validationMessages.push(
				"Only active assets can be adjusted. Draft, cancelled, sold, and scrapped assets are not eligible.",
			);
		}

		if (
			dateOnlyUtc(input.adjustmentDate).getTime() <
			dateOnlyUtc(asset.purchaseDate).getTime()
		) {
			validationMessages.push(
				"The adjustment date cannot be earlier than the asset purchase date.",
			);
		}

		if (
			selectedFinanceBook?.lastPostedDepreciationDate &&
			dateOnlyUtc(input.adjustmentDate).getTime() <
				dateOnlyUtc(selectedFinanceBook.lastPostedDepreciationDate).getTime()
		) {
			validationMessages.push(
				"The adjustment date cannot be earlier than the selected finance book's last posted depreciation date.",
			);
		}

		if (input.newAssetValue < 0) {
			validationMessages.push("The new asset value must be zero or greater.");
		}

		if (differenceAmount === 0) {
			validationMessages.push(
				"The new asset value must be different from the current carrying value.",
			);
		}

		if (
			asset.calculateDepreciation &&
			selectedFinanceBook &&
			!schedulePreview
		) {
			validationMessages.push(
				"This asset requires depreciation settings before a value adjustment can be submitted.",
			);
		}

		if (selectedFinanceBook?.depreciationMethod === "MANUAL") {
			validationMessages.push(
				"Manual depreciation requires future schedule entries before this value adjustment can be submitted.",
			);
		}

		if (
			selectedFinanceBook &&
			selectedFinanceBook.totalNumberOfDepreciations <=
				selectedFinanceBook.totalNumberOfBookedDepreciations
		) {
			validationMessages.push(
				"The selected finance book must have at least one unbooked depreciation period.",
			);
		}

		return {
			assetId: asset.id,
			companyId: asset.companyId,
			assetSeries: asset.series,
			assetName: asset.assetName,
			assetCategoryName: asset.assetCategory?.name ?? null,
			company: asset.company,
			financeBookId: selectedFinanceBook?.financeBookId ?? null,
			financeBookName: selectedFinanceBook?.financeBookName ?? null,
			assetFinanceBookId: selectedFinanceBook?.id ?? null,
			adjustmentDate: input.adjustmentDate,
			currentAssetValue,
			newAssetValue: this.roundCurrency(input.newAssetValue),
			differenceAmount,
			direction: getAssetValueAdjustmentDirection(differenceAmount),
			fixedAssetAccount: deriveFixedAssetAccount(asset.assetCategory?.name),
			resultingStatus: resultState.status,
			resultingIsFullyDepreciated: resultState.isFullyDepreciated,
			validationMessages,
			depreciationSchedule: schedulePreview,
		};
	}

	// ============================================================================
	// Asset Methods
	// ============================================================================

	async findAllAssets(
		organizationId: AssetOrganizationId,
		params?: Asset.ListAssetsInput,
	): Promise<Asset.AssetListResult> {
		this.assertOrganizationScope(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Prisma.AssetWhereInput = {};
		if (params?.status) where.status = params.status;
		if (params?.assetCategoryId) where.assetCategoryId = params.assetCategoryId;
		if (params?.locationId) where.locationId = params.locationId;
		if (params?.company)
			where.company = {
				is: {
					organizationId,
					name: { contains: params.company, mode: "insensitive" },
				},
			};
		if (params?.search) {
			where.OR = [
				{ series: { contains: params.search, mode: "insensitive" } },
				{ assetName: { contains: params.search, mode: "insensitive" } },
				{ itemCode: { contains: params.search, mode: "insensitive" } },
				{ custodian: { contains: params.search, mode: "insensitive" } },
				{ department: { contains: params.search, mode: "insensitive" } },
			];
		}

		const scopedWhere = assetWhereForOrganization(organizationId, where);
		const [items, totalCount] = await Promise.all([
			this.prisma.asset.findMany({
				where: scopedWhere,
				include: this.assetInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.asset.count({ where: scopedWhere }),
		]);

		return { items: items.map(toAsset), totalCount };
	}

	async findAssetById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetItem | null> {
		this.assertOrganizationScope(organizationId);
		const asset = await this.prisma.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id }),
			include: this.assetInclude,
		});
		return asset ? toAsset(asset) : null;
	}

	async listAssetDepreciationSchedules(
		assetId: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDepreciationScheduleListResult> {
		this.assertOrganizationScope(organizationId);
		const exists = await this.prisma.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			select: { id: true },
		});
		if (!exists) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}
		const schedules = await this.prisma.assetDepreciationSchedule.findMany({
			where: {
				assetId,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			include: { entries: { orderBy: { sequence: "asc" } } },
			orderBy: [{ assetFinanceBookId: "asc" }, { revisionNumber: "desc" }],
		});
		return { items: schedules.map(toAssetDepreciationSchedule) };
	}

	async findAssetByBarcode(
		barcode: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetItem | null> {
		this.assertOrganizationScope(organizationId);
		const asset = await this.prisma.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { barcode }),
			include: this.assetInclude,
		});
		return asset ? toAsset(asset) : null;
	}

	async createAsset(
		input: Asset.CreateAssetInput,
		organizationId: string,
		actorId?: string | null,
	): Promise<Asset.AssetItem> {
		this.assertOrganizationScope(organizationId);
		if (input.status && input.status !== "DRAFT") {
			throw new BadRequestException(
				"Create the asset as a draft, then use the explicit submit action",
			);
		}
		const company = await this.resolveCompanyForOrganization(
			organizationId,
			input.companyId,
		);
		if (input.barcode && input.barcode.trim().length > 0) {
			const existingWithBarcode = await this.prisma.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					barcode: input.barcode.trim(),
				}),
				select: { id: true, assetName: true },
			});
			if (existingWithBarcode) {
				throw new ConflictException(
					`Barcode "${input.barcode}" is already registered to asset "${existingWithBarcode.assetName}"`,
				);
			}
		}

		const purchaseDate =
			input.purchaseDate instanceof Date ? input.purchaseDate : new Date();
		const series = await this.generateAssetSeries(purchaseDate, organizationId);
		const categoryDefaults = await this.getAssetCategoryDefaults(
			input.assetCategoryId,
		);

		if (input.assetCategoryId && !categoryDefaults) {
			throw new NotFoundException(
				`Asset category ${input.assetCategoryId} not found`,
			);
		}

		const calculateDepreciation =
			input.calculateDepreciation ??
			(categoryDefaults ? !categoryDefaults.nonDepreciableCategory : false);
		const openingAccumulatedDepreciation =
			input.openingAccumulatedDepreciation ?? 0;
		const netPurchaseAmount = input.netPurchaseAmount ?? 0;
		const valueAfterDepreciation = this.getOpeningAssetValue(
			netPurchaseAmount,
			openingAccumulatedDepreciation,
		);
		const depreciationMethod =
			input.depreciationMethod ??
			(categoryDefaults?.depreciationMethod as Asset.DepreciationMethod | null) ??
			null;
		const totalNumberOfDepreciations =
			input.totalNumberOfDepreciations ??
			categoryDefaults?.totalNumberOfDepreciations ??
			null;
		const frequencyOfDepreciation =
			input.frequencyOfDepreciation ??
			categoryDefaults?.frequencyOfDepreciation ??
			null;
		const expectedValueAfterUsefulLife =
			input.expectedValueAfterUsefulLife ??
			(categoryDefaults?.expectedValueAfterUsefulLife != null
				? Number(categoryDefaults.expectedValueAfterUsefulLife)
				: null);
		const availableForUseDate =
			input.availableForUseDate instanceof Date
				? input.availableForUseDate
				: null;
		const depreciationStartDate =
			input.depreciationStartDate ??
			(availableForUseDate
				? this.getLastDayOfMonth(availableForUseDate)
				: null);

		this.validateDepreciationFields(
			netPurchaseAmount,
			expectedValueAfterUsefulLife,
			depreciationStartDate,
			purchaseDate,
			availableForUseDate,
			totalNumberOfDepreciations,
			frequencyOfDepreciation,
			openingAccumulatedDepreciation,
			input.openingNumberOfBookedDepreciations ?? null,
			calculateDepreciation,
		);

		const created = await this.prisma.asset.create({
			data: {
				series,
				assetName: input.assetName,
				assetType: input.assetType ?? "EXISTING_ASSET",
				itemCode: input.itemCode ?? "",
				barcode: input.barcode ?? null,
				assetCategoryId: input.assetCategoryId ?? null,
				companyId: company.id,
				locationId: input.locationId ?? null,
				custodian: input.custodian ?? null,
				department: input.department ?? null,
				purchaseDate,
				availableForUseDate,
				netPurchaseAmount: netPurchaseAmount.toString(),
				assetQuantity: input.assetQuantity ?? 1,
				calculateDepreciation,
				openingAccumulatedDepreciation:
					openingAccumulatedDepreciation.toString(),
				openingNumberOfBookedDepreciations:
					input.openingNumberOfBookedDepreciations ?? undefined,
				isFullyDepreciated:
					input.isFullyDepreciated ?? valueAfterDepreciation <= 0,
				valueAfterDepreciation: valueAfterDepreciation.toString(),
				maintenanceRequired: input.maintenanceRequired ?? false,
				assetOwner: input.assetOwner ?? "COMPANY",
				assetOwnerCompany: input.assetOwnerCompany ?? null,
				supplier: input.supplier ?? null,
				customer: input.customer ?? null,
				policyNumber: input.policyNumber ?? null,
				insurer: input.insurer ?? null,
				insuredValue: input.insuredValue?.toString() ?? null,
				insuranceStartDate:
					input.insuranceStartDate instanceof Date
						? input.insuranceStartDate
						: null,
				insuranceEndDate:
					input.insuranceEndDate instanceof Date
						? input.insuranceEndDate
						: null,
				depreciationMethod,
				totalNumberOfDepreciations,
				frequencyOfDepreciation,
				expectedValueAfterUsefulLife:
					expectedValueAfterUsefulLife?.toString() ?? null,
				depreciationStartDate,
				purchaseReceipt: input.purchaseReceipt ?? null,
				purchaseInvoice: input.purchaseInvoice ?? null,
				status: "DRAFT",
			},
		});

		await this.depreciationLifecycle?.configureAssetBooks(
			created.id,
			input.financeBooks,
			organizationId,
		);

		await this.prisma.assetActivity.create({
			data: {
				assetId: created.id,
				activity: `Asset created with series ${series}`,
				userId: actorId ?? null,
			},
		});

		const asset = await this.prisma.asset.findFirstOrThrow({
			where: assetWhereForOrganization(organizationId, { id: created.id }),
			include: this.assetInclude,
		});

		this.logger.log(`Created asset ${series}`);
		return toAsset(asset);
	}

	async updateAsset(
		input: Asset.UpdateAssetInput,
		organizationId: string,
		actorId?: string | null,
	): Promise<Asset.AssetItem> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: input.id }),
			select: {
				id: true,
				companyId: true,
				status: true,
				assetType: true,
				assetCategoryId: true,
				netPurchaseAmount: true,
				openingAccumulatedDepreciation: true,
				calculateDepreciation: true,
				depreciationMethod: true,
				totalNumberOfDepreciations: true,
				frequencyOfDepreciation: true,
				valueAfterDepreciation: true,
				isFullyDepreciated: true,
				openingNumberOfBookedDepreciations: true,
			},
		});
		if (!existing) throw new NotFoundException(`Asset ${input.id} not found`);
		const currentCompany = await this.prisma.company.findFirst({
			where: { id: existing.companyId, organizationId },
			select: { id: true, name: true },
		});
		if (!currentCompany) {
			throw new NotFoundException(
				`Asset ${input.id} is not available in the active organization`,
			);
		}
		const nextCompany =
			input.companyId !== undefined
				? await this.resolveCompanyForOrganization(
						organizationId,
						input.companyId,
					)
				: currentCompany;
		if (nextCompany.id !== currentCompany.id) {
			throw new BadRequestException(
				"Asset Company reassignment is not supported by ordinary Asset updates; use an explicit transfer workflow",
			);
		}

		if (input.barcode && input.barcode.trim().length > 0) {
			const existingWithBarcode = await this.prisma.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					barcode: input.barcode.trim(),
				}),
				select: { id: true, assetName: true },
			});
			if (existingWithBarcode && existingWithBarcode.id !== input.id) {
				throw new ConflictException(
					`Barcode "${input.barcode}" is already registered to asset "${existingWithBarcode.assetName}"`,
				);
			}
		}

		if (existing.status === "CANCELLED") {
			throw new BadRequestException("Cannot update a cancelled asset");
		}

		const depreciationCriticalEdit = [
			input.assetType,
			input.assetCategoryId,
			input.companyId,
			input.purchaseDate,
			input.availableForUseDate,
			input.netPurchaseAmount,
			input.calculateDepreciation,
			input.openingAccumulatedDepreciation,
			input.openingNumberOfBookedDepreciations,
			input.depreciationMethod,
			input.totalNumberOfDepreciations,
			input.frequencyOfDepreciation,
			input.expectedValueAfterUsefulLife,
			input.depreciationStartDate,
			input.financeBooks,
		].some((value) => value !== undefined);
		if (existing.status !== "DRAFT" && depreciationCriticalEdit) {
			throw new BadRequestException(
				"Depreciation-critical fields cannot be edited after submission; use a supported rescheduling or value-adjustment workflow",
			);
		}
		if (input.status !== undefined) {
			throw new BadRequestException(
				"Use the explicit submit or cancel asset action to change lifecycle status",
			);
		}

		const categoryDefaults = await this.getAssetCategoryDefaults(
			input.assetCategoryId !== undefined
				? input.assetCategoryId
				: existing.assetCategoryId,
		);

		if (input.assetCategoryId && !categoryDefaults) {
			throw new NotFoundException(
				`Asset category ${input.assetCategoryId} not found`,
			);
		}

		const nextNetPurchaseAmount =
			input.netPurchaseAmount ?? Number(existing.netPurchaseAmount);
		const nextOpeningAccumulatedDepreciation =
			input.openingAccumulatedDepreciation ??
			Number(existing.openingAccumulatedDepreciation);
		const shouldRecalculateValueAfterDepreciation =
			input.valueAfterDepreciation === undefined &&
			(input.netPurchaseAmount !== undefined ||
				input.openingAccumulatedDepreciation !== undefined);
		const derivedValueAfterDepreciation = this.getOpeningAssetValue(
			nextNetPurchaseAmount,
			nextOpeningAccumulatedDepreciation,
		);
		const nextValueAfterDepreciation =
			input.valueAfterDepreciation ??
			(shouldRecalculateValueAfterDepreciation
				? derivedValueAfterDepreciation
				: Number(existing.valueAfterDepreciation));
		const shouldInheritDepreciationSettings =
			input.assetCategoryId !== undefined &&
			input.depreciationMethod === undefined;
		const shouldInheritTotalDepreciations =
			input.assetCategoryId !== undefined &&
			input.totalNumberOfDepreciations === undefined;
		const shouldInheritFrequency =
			input.assetCategoryId !== undefined &&
			input.frequencyOfDepreciation === undefined;
		const shouldInheritExpectedValueAfterUsefulLife =
			input.assetCategoryId !== undefined &&
			input.expectedValueAfterUsefulLife === undefined;
		const shouldInheritDepreciationStartDate =
			input.assetCategoryId !== undefined &&
			input.depreciationStartDate === undefined;
		const calculateDepreciation =
			input.calculateDepreciation ??
			(input.assetCategoryId !== undefined && categoryDefaults
				? !categoryDefaults.nonDepreciableCategory
				: existing.calculateDepreciation);
		const nextAvailableForUseDate =
			input.availableForUseDate instanceof Date
				? input.availableForUseDate
				: null;
		const nextDepreciationStartDate =
			input.depreciationStartDate ??
			(nextAvailableForUseDate
				? this.getLastDayOfMonth(nextAvailableForUseDate)
				: null);
		const nextExpectedValueAfterUsefulLife =
			input.expectedValueAfterUsefulLife ??
			(shouldInheritExpectedValueAfterUsefulLife &&
			categoryDefaults?.expectedValueAfterUsefulLife != null
				? Number(categoryDefaults.expectedValueAfterUsefulLife)
				: null);

		this.validateDepreciationFields(
			nextNetPurchaseAmount,
			nextExpectedValueAfterUsefulLife,
			nextDepreciationStartDate,
			input.purchaseDate instanceof Date ? input.purchaseDate : new Date(),
			nextAvailableForUseDate,
			input.totalNumberOfDepreciations ?? existing.totalNumberOfDepreciations,
			input.frequencyOfDepreciation ?? existing.frequencyOfDepreciation,
			nextOpeningAccumulatedDepreciation,
			input.openingNumberOfBookedDepreciations ??
				existing.openingNumberOfBookedDepreciations,
			calculateDepreciation,
		);

		const asset = await this.prisma.$transaction(async (tx) => {
			const transitioned = await tx.asset.updateMany({
				where: assetWhereForOrganization(organizationId, { id: input.id }),
				data: {
					...(input.assetName !== undefined && { assetName: input.assetName }),
					...(input.assetType !== undefined && { assetType: input.assetType }),
					...(input.itemCode !== undefined && {
						itemCode: input.itemCode ?? "",
					}),
					...(input.barcode !== undefined && { barcode: input.barcode }),
					...(input.assetCategoryId !== undefined && {
						assetCategoryId: input.assetCategoryId,
					}),
					...(input.locationId !== undefined && {
						locationId: input.locationId,
					}),
					...(input.custodian !== undefined && { custodian: input.custodian }),
					...(input.department !== undefined && {
						department: input.department,
					}),
					...(input.purchaseDate instanceof Date && {
						purchaseDate: input.purchaseDate,
					}),
					...(input.availableForUseDate !== undefined && {
						availableForUseDate:
							input.availableForUseDate instanceof Date
								? input.availableForUseDate
								: null,
					}),
					...(input.disposalDate !== undefined && {
						disposalDate:
							input.disposalDate instanceof Date ? input.disposalDate : null,
					}),
					...(input.netPurchaseAmount !== undefined &&
						input.netPurchaseAmount !== null && {
							netPurchaseAmount: input.netPurchaseAmount.toString(),
						}),
					...(input.assetQuantity !== undefined && {
						assetQuantity: input.assetQuantity,
					}),
					...(input.calculateDepreciation !== undefined ||
					input.assetCategoryId !== undefined
						? {
								calculateDepreciation,
							}
						: {}),
					...(input.openingAccumulatedDepreciation !== undefined &&
						input.openingAccumulatedDepreciation !== null && {
							openingAccumulatedDepreciation:
								input.openingAccumulatedDepreciation.toString(),
						}),
					...(input.openingNumberOfBookedDepreciations !== undefined &&
						input.openingNumberOfBookedDepreciations !== null && {
							openingNumberOfBookedDepreciations:
								input.openingNumberOfBookedDepreciations,
						}),
					...(input.isFullyDepreciated !== undefined ||
					shouldRecalculateValueAfterDepreciation
						? {
								isFullyDepreciated:
									input.isFullyDepreciated ?? nextValueAfterDepreciation <= 0,
							}
						: {}),
					...(input.valueAfterDepreciation !== undefined ||
					shouldRecalculateValueAfterDepreciation
						? {
								valueAfterDepreciation: nextValueAfterDepreciation.toString(),
							}
						: {}),
					...(input.maintenanceRequired !== undefined && {
						maintenanceRequired: input.maintenanceRequired,
					}),
					...(input.assetOwner !== undefined && {
						assetOwner: input.assetOwner,
					}),
					...(input.assetOwnerCompany !== undefined && {
						assetOwnerCompany: input.assetOwnerCompany,
					}),
					...(input.supplier !== undefined && { supplier: input.supplier }),
					...(input.customer !== undefined && { customer: input.customer }),
					...(input.policyNumber !== undefined && {
						policyNumber: input.policyNumber,
					}),
					...(input.insurer !== undefined && { insurer: input.insurer }),
					...(input.insuredValue !== undefined && {
						insuredValue:
							input.insuredValue !== null
								? input.insuredValue.toString()
								: null,
					}),
					...(input.insuranceStartDate !== undefined && {
						insuranceStartDate:
							input.insuranceStartDate instanceof Date
								? input.insuranceStartDate
								: null,
					}),
					...(input.insuranceEndDate !== undefined && {
						insuranceEndDate:
							input.insuranceEndDate instanceof Date
								? input.insuranceEndDate
								: null,
					}),
					...(input.depreciationMethod !== undefined && {
						depreciationMethod: input.depreciationMethod,
					}),
					...(shouldInheritDepreciationSettings && {
						depreciationMethod:
							(categoryDefaults?.depreciationMethod as Asset.DepreciationMethod | null) ??
							null,
					}),
					...(input.totalNumberOfDepreciations !== undefined && {
						totalNumberOfDepreciations: input.totalNumberOfDepreciations,
					}),
					...(shouldInheritTotalDepreciations && {
						totalNumberOfDepreciations:
							categoryDefaults?.totalNumberOfDepreciations ?? null,
					}),
					...(input.frequencyOfDepreciation !== undefined && {
						frequencyOfDepreciation: input.frequencyOfDepreciation,
					}),
					...(shouldInheritFrequency && {
						frequencyOfDepreciation:
							categoryDefaults?.frequencyOfDepreciation ?? null,
					}),
					...(input.expectedValueAfterUsefulLife !== undefined && {
						expectedValueAfterUsefulLife:
							input.expectedValueAfterUsefulLife !== null
								? input.expectedValueAfterUsefulLife.toString()
								: null,
					}),
					...(shouldInheritExpectedValueAfterUsefulLife &&
					categoryDefaults?.expectedValueAfterUsefulLife != null
						? {
								expectedValueAfterUsefulLife:
									categoryDefaults.expectedValueAfterUsefulLife.toString(),
							}
						: {}),
					...(input.depreciationStartDate !== undefined && {
						depreciationStartDate:
							input.depreciationStartDate instanceof Date
								? input.depreciationStartDate
								: null,
					}),
					...(shouldInheritDepreciationStartDate && nextAvailableForUseDate
						? {
								depreciationStartDate: this.getLastDayOfMonth(
									nextAvailableForUseDate,
								),
							}
						: {}),
					...(input.purchaseReceipt !== undefined && {
						purchaseReceipt: input.purchaseReceipt,
					}),
					...(input.purchaseInvoice !== undefined && {
						purchaseInvoice: input.purchaseInvoice,
					}),
					...(input.status !== undefined && { status: input.status }),
				},
			});
			if (transitioned.count !== 1) {
				throw new NotFoundException(`Asset ${input.id} not found`);
			}
			const updated = await tx.asset.findFirstOrThrow({
				where: assetWhereForOrganization(organizationId, { id: input.id }),
				include: this.assetInclude,
			});
			await tx.assetActivity.create({
				data: {
					assetId: input.id,
					activity: "Asset updated",
					userId: actorId ?? null,
				},
			});
			return updated;
		});

		if (existing.status === "DRAFT" && input.financeBooks !== undefined) {
			await this.depreciationLifecycle?.configureAssetBooks(
				input.id,
				input.financeBooks,
				organizationId,
			);
			const refreshed = await this.prisma.asset.findFirstOrThrow({
				where: assetWhereForOrganization(organizationId, { id: input.id }),
				include: this.assetInclude,
			});
			return toAsset(refreshed);
		}

		return toAsset(asset);
	}

	/** Submits a draft asset and activates its precomputed schedules. */
	async submitAsset(
		id: string,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetItem> {
		this.assertOrganizationScope(organizationId);
		if (!this.depreciationLifecycle) {
			throw new Error("Depreciation lifecycle service is unavailable");
		}
		if (
			!(await this.prisma.asset.findFirst({
				where: assetWhereForOrganization(organizationId, { id }),
				select: { id: true },
			}))
		) {
			throw new NotFoundException(`Asset ${id} not found`);
		}
		await this.depreciationLifecycle.submitAsset(id, organizationId, actorId);
		const asset = await this.prisma.asset.findFirstOrThrow({
			where: assetWhereForOrganization(organizationId, { id }),
			include: this.assetInclude,
		});
		return toAsset(asset);
	}

	/** Cancels an unposted asset and cancels its open schedules. */
	async cancelAsset(
		id: string,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetItem> {
		this.assertOrganizationScope(organizationId);
		if (!this.depreciationLifecycle) {
			throw new Error("Depreciation lifecycle service is unavailable");
		}
		if (
			!(await this.prisma.asset.findFirst({
				where: assetWhereForOrganization(organizationId, { id }),
				select: { id: true },
			}))
		) {
			throw new NotFoundException(`Asset ${id} not found`);
		}
		await this.depreciationLifecycle.cancelAsset(id, organizationId, actorId);
		const asset = await this.prisma.asset.findFirstOrThrow({
			where: assetWhereForOrganization(organizationId, { id }),
			include: this.assetInclude,
		});
		return toAsset(asset);
	}

	async deleteAsset(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<{ success: boolean; id: string }> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id }),
			select: { id: true, status: true },
		});
		if (!existing) throw new NotFoundException(`Asset ${id} not found`);

		if (existing.status === "SUBMITTED") {
			throw new BadRequestException(
				"Cannot delete a submitted asset. Cancel it first.",
			);
		}

		const deleted = await this.prisma.asset.deleteMany({
			where: assetWhereForOrganization(organizationId, { id }),
		});
		if (deleted.count !== 1)
			throw new NotFoundException(`Asset ${id} not found`);
		return { success: true, id };
	}

	async deleteManyAssets(
		ids: string[],
		organizationId: AssetOrganizationId,
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		this.assertOrganizationScope(organizationId);
		const uniqueIds = [...new Set(ids)];
		const assets = await this.prisma.asset.findMany({
			where: assetWhereForOrganization(organizationId, {
				id: { in: uniqueIds },
			}),
			select: { id: true, status: true },
		});
		if (assets.length !== uniqueIds.length) {
			throw new NotFoundException(
				"One or more assets are not available in the active organization",
			);
		}

		const submitted = assets.filter((a) => a.status === "SUBMITTED");
		if (submitted.length > 0) {
			throw new BadRequestException(
				`Cannot delete submitted assets: ${submitted.map((a) => a.id).join(", ")}`,
			);
		}

		await this.prisma.asset.deleteMany({
			where: assetWhereForOrganization(organizationId, {
				id: { in: uniqueIds },
			}),
		});
		return { success: true, count: uniqueIds.length, ids: uniqueIds };
	}

	async findAssetActivityReport(
		input: Asset.ListAssetActivityReportInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetActivityReportResult> {
		this.assertOrganizationScope(organizationId);
		const fromDate = new Date(input.fromDate);
		fromDate.setHours(0, 0, 0, 0);

		const toDate = new Date(input.toDate);
		toDate.setHours(23, 59, 59, 999);

		const where: Prisma.AssetActivityWhereInput = {
			createdAt: {
				gte: fromDate,
				lte: toDate,
			},
		};

		if (input.activity) {
			where.activity = {
				contains: input.activity,
				mode: "insensitive",
			};
		}

		const assetWhere: Prisma.AssetWhereInput = {};

		if (input.company) {
			assetWhere.company = {
				is: {
					name: { contains: input.company, mode: "insensitive" },
				},
			};
		}

		if (input.asset) {
			assetWhere.OR = [
				{
					series: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
				{
					assetName: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
			];
		}

		if (input.assetCategory) {
			assetWhere.assetCategory = {
				is: {
					name: {
						contains: input.assetCategory,
						mode: "insensitive",
					},
				},
			};
		}

		where.asset = {
			is: assetWhereForOrganization(organizationId, assetWhere),
		};

		const activities = await this.prisma.assetActivity.findMany({
			where,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			select: {
				id: true,
				assetId: true,
				userId: true,
				user: {
					select: {
						id: true,
						name: true,
					},
				},
				activity: true,
				createdAt: true,
				asset: {
					select: {
						id: true,
						series: true,
						assetName: true,
						company: { select: { name: true } },
						status: true,
						assetCategory: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		return buildAssetActivityReportResult({
			activities: activities.map((activity) => ({
				id: activity.id,
				assetId: activity.assetId,
				assetSeries: activity.asset.series,
				assetName: activity.asset.assetName,
				assetCategory: activity.asset.assetCategory
					? {
							id: activity.asset.assetCategory.id,
							name: activity.asset.assetCategory.name,
						}
					: null,
				company: activity.asset.company.name,
				assetStatus: activity.asset.status as Asset.AssetStatus,
				activity: activity.activity,
				user: activity.user
					? {
							id: activity.user.id,
							name: activity.user.name,
						}
					: null,
				userId: activity.userId ?? null,
				userName: activity.user?.name ?? null,
				createdAt: activity.createdAt,
			})),
		});
	}

	async findAssetDepreciationLedger(
		input: Asset.ListAssetDepreciationLedgerInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDepreciationLedgerResult> {
		this.assertOrganizationScope(organizationId);
		const fromDate = new Date(input.fromDate);
		fromDate.setHours(0, 0, 0, 0);

		const toDate = new Date(input.toDate);
		toDate.setHours(23, 59, 59, 999);
		await this.ensureReportDepreciation(toDate, organizationId, input.company);

		const assetWhere: Prisma.AssetWhereInput = {};

		if (input.company) {
			assetWhere.company = {
				is: {
					name: { contains: input.company, mode: "insensitive" },
				},
			};
		}

		if (input.asset) {
			assetWhere.OR = [
				{
					series: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
				{
					assetName: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
			];
		}

		if (input.assetCategory) {
			assetWhere.assetCategory = {
				is: {
					name: {
						contains: input.assetCategory,
						mode: "insensitive",
					},
				},
			};
		}

		if (input.costCenter) {
			assetWhere.valueAdjustments = {
				some: {
					status: "SUBMITTED",
					adjustmentDate: { lte: toDate },
					costCenter: {
						contains: input.costCenter,
						mode: "insensitive",
					},
				},
			};
		}

		const assets = await this.prisma.asset.findMany({
			where: assetWhereForOrganization(organizationId, assetWhere),
			select: {
				id: true,
				series: true,
				assetName: true,
				company: { select: { name: true } },
				purchaseDate: true,
				netPurchaseAmount: true,
				status: true,
				assetCategory: {
					select: {
						id: true,
						name: true,
					},
				},
				valueAdjustments: {
					where: {
						status: "SUBMITTED",
						adjustmentDate: { lte: toDate },
						...(input.costCenter
							? {
									costCenter: {
										contains: input.costCenter,
										mode: "insensitive" as const,
									},
								}
							: {}),
					},
					orderBy: [{ adjustmentDate: "asc" }, { createdAt: "asc" }],
					select: {
						id: true,
						series: true,
						adjustmentDate: true,
						costCenter: true,
						revaluationEntry: {
							select: {
								series: true,
							},
						},
						depreciationSchedule: {
							select: {
								id: true,
								revisionNumber: true,
								startDate: true,
								depreciationMethod: true,
								openingAccumulatedDepreciation: true,
								entries: {
									where: { posting: { is: { status: "POSTED" } } },
									orderBy: { sequence: "asc" },
									select: {
										id: true,
										sequence: true,
										scheduleDate: true,
										depreciationAmount: true,
										accumulatedDepreciationAmount: true,
										bookValueAfterDepreciation: true,
									},
								},
							},
						},
					},
				},
				depreciationSchedules: {
					where: {
						entries: { some: { posting: { is: { status: "POSTED" } } } },
					},
					orderBy: [{ startDate: "asc" }, { revisionNumber: "asc" }],
					select: {
						id: true,
						revisionNumber: true,
						startDate: true,
						depreciationMethod: true,
						openingAccumulatedDepreciation: true,
						adjustment: {
							select: {
								id: true,
								series: true,
								adjustmentDate: true,
								costCenter: true,
								revaluationEntry: { select: { series: true } },
							},
						},
						entries: {
							where: { posting: { is: { status: "POSTED" } } },
							orderBy: { sequence: "asc" },
							select: {
								id: true,
								sequence: true,
								scheduleDate: true,
								depreciationAmount: true,
								accumulatedDepreciationAmount: true,
								bookValueAfterDepreciation: true,
							},
						},
					},
				},
			},
		});

		return buildAssetDepreciationLedgerResult({
			fromDate,
			toDate,
			assets: assets.map((asset) => ({
				id: asset.id,
				series: asset.series,
				assetName: asset.assetName,
				company: asset.company.name,
				purchaseDate: asset.purchaseDate ?? null,
				netPurchaseAmount: asset.netPurchaseAmount
					? Number(asset.netPurchaseAmount)
					: null,
				status: asset.status as Asset.AssetStatus,
				assetCategory: asset.assetCategory
					? {
							id: asset.assetCategory.id,
							name: asset.assetCategory.name,
						}
					: null,
				adjustments: asset.depreciationSchedules.map((schedule) => ({
					id: schedule.adjustment?.id ?? schedule.id,
					series:
						schedule.adjustment?.series ??
						`DEP-SCHEDULE-${schedule.revisionNumber}`,
					adjustmentDate:
						schedule.adjustment?.adjustmentDate ?? schedule.startDate,
					costCenter: schedule.adjustment?.costCenter ?? null,
					revaluationEntrySeries:
						schedule.adjustment?.revaluationEntry?.series ?? null,
					schedule: {
						id: schedule.id,
						revisionNumber: schedule.revisionNumber,
						startDate: schedule.startDate,
						depreciationMethod:
							(schedule.depreciationMethod as Asset.DepreciationMethod | null) ??
							null,
						openingAccumulatedDepreciation: Number(
							schedule.openingAccumulatedDepreciation,
						),
						entries: schedule.entries.map((entry) => ({
							id: entry.id,
							sequence: entry.sequence,
							scheduleDate: entry.scheduleDate,
							depreciationAmount: Number(entry.depreciationAmount),
							accumulatedDepreciationAmount: Number(
								entry.accumulatedDepreciationAmount,
							),
							bookValueAfterDepreciation: Number(
								entry.bookValueAfterDepreciation,
							),
						})),
					},
				})),
			})),
		});
	}

	async findAssetDepreciationsAndBalances(
		input: Asset.ListAssetDepreciationsAndBalancesInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDepreciationsAndBalancesResult> {
		this.assertOrganizationScope(organizationId);
		const fromDate = new Date(input.fromDate);
		fromDate.setHours(0, 0, 0, 0);

		const toDate = new Date(input.toDate);
		toDate.setHours(23, 59, 59, 999);
		await this.ensureReportDepreciation(toDate, organizationId, input.company);

		const assetWhere: Prisma.AssetWhereInput = {
			purchaseDate: {
				lte: toDate,
			},
		};

		if (input.company) {
			assetWhere.company = {
				is: {
					name: { contains: input.company, mode: "insensitive" },
				},
			};
		}

		if (input.asset) {
			assetWhere.OR = [
				{
					series: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
				{
					assetName: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
			];
		}

		if (input.assetCategory) {
			assetWhere.assetCategory = {
				is: {
					name: {
						contains: input.assetCategory,
						mode: "insensitive",
					},
				},
			};
		}

		const assets = await this.prisma.asset.findMany({
			where: assetWhereForOrganization(organizationId, assetWhere),
			select: {
				id: true,
				series: true,
				assetName: true,
				company: { select: { name: true } },
				purchaseDate: true,
				disposalDate: true,
				netPurchaseAmount: true,
				openingAccumulatedDepreciation: true,
				status: true,
				assetCategory: {
					select: {
						id: true,
						name: true,
					},
				},
				valueAdjustments: {
					where: {
						status: "SUBMITTED",
						adjustmentDate: { lte: toDate },
					},
					orderBy: [{ adjustmentDate: "asc" }, { createdAt: "asc" }],
					select: {
						id: true,
						adjustmentDate: true,
						differenceAmount: true,
						depreciationSchedule: {
							select: {
								id: true,
								revisionNumber: true,
								startDate: true,
								openingAccumulatedDepreciation: true,
								entries: {
									where: { posting: { is: { status: "POSTED" } } },
									orderBy: { sequence: "asc" },
									select: {
										id: true,
										sequence: true,
										scheduleDate: true,
										depreciationAmount: true,
										accumulatedDepreciationAmount: true,
										bookValueAfterDepreciation: true,
									},
								},
							},
						},
					},
				},
				depreciationSchedules: {
					where: {
						entries: { some: { posting: { is: { status: "POSTED" } } } },
					},
					orderBy: [{ startDate: "asc" }, { revisionNumber: "asc" }],
					select: {
						id: true,
						revisionNumber: true,
						startDate: true,
						openingAccumulatedDepreciation: true,
						entries: {
							where: { posting: { is: { status: "POSTED" } } },
							orderBy: { sequence: "asc" },
							select: {
								id: true,
								sequence: true,
								scheduleDate: true,
								depreciationAmount: true,
								accumulatedDepreciationAmount: true,
								bookValueAfterDepreciation: true,
							},
						},
					},
				},
			},
		});

		return buildAssetDepreciationsAndBalancesResult({
			fromDate,
			toDate,
			groupBy: input.groupBy,
			assets: assets.map((asset) => ({
				id: asset.id,
				series: asset.series,
				assetName: asset.assetName,
				company: asset.company.name,
				purchaseDate: asset.purchaseDate,
				disposalDate: asset.disposalDate ?? null,
				netPurchaseAmount: Number(asset.netPurchaseAmount ?? 0),
				openingAccumulatedDepreciation: Number(
					asset.openingAccumulatedDepreciation ?? 0,
				),
				status: asset.status as Asset.AssetStatus,
				assetCategory: asset.assetCategory
					? {
							id: asset.assetCategory.id,
							name: asset.assetCategory.name,
						}
					: null,
				adjustments: [
					...asset.valueAdjustments.map((adjustment) => ({
						id: adjustment.id,
						adjustmentDate: adjustment.adjustmentDate,
						differenceAmount: Number(adjustment.differenceAmount),
						schedule: null,
					})),
					...asset.depreciationSchedules.map((schedule) => ({
						id: schedule.id,
						adjustmentDate: schedule.startDate,
						differenceAmount: 0,
						schedule: {
							id: schedule.id,
							revisionNumber: schedule.revisionNumber,
							startDate: schedule.startDate,
							openingAccumulatedDepreciation: Number(
								schedule.openingAccumulatedDepreciation,
							),
							entries: schedule.entries.map((entry) => ({
								id: entry.id,
								sequence: entry.sequence,
								scheduleDate: entry.scheduleDate,
								depreciationAmount: Number(entry.depreciationAmount),
								accumulatedDepreciationAmount: Number(
									entry.accumulatedDepreciationAmount,
								),
								bookValueAfterDepreciation: Number(
									entry.bookValueAfterDepreciation,
								),
							})),
						},
					})),
				],
			})),
		});
	}

	async findFixedAssetRegisterReport(
		input: Asset.ListFixedAssetRegisterReportInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.FixedAssetRegisterReportResult> {
		this.assertOrganizationScope(organizationId);
		const toDate = new Date(input.toDate);
		toDate.setHours(23, 59, 59, 999);
		await this.ensureReportDepreciation(toDate, organizationId, input.company);

		const reportService =
			this.fixedAssetRegisterReportService ??
			new FixedAssetRegisterReportService(this.prisma);
		return reportService.generateReport(input, organizationId);
	}

	async findAllAssetValueAdjustments(
		organizationId: AssetOrganizationId,
		params?: Asset.ListAssetValueAdjustmentsInput,
	): Promise<Asset.AssetValueAdjustmentListResult> {
		this.assertOrganizationScope(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Prisma.AssetValueAdjustmentWhereInput = {};
		if (params?.status) where.status = params.status;
		if (params?.assetId) where.assetId = params.assetId;
		if (params?.company) {
			where.asset = {
				is: {
					company: {
						is: {
							name: { contains: params.company, mode: "insensitive" },
						},
					},
				},
			};
		}
		if (params?.direction) where.direction = params.direction;
		if (params?.search) {
			where.OR = [
				{ series: { contains: params.search, mode: "insensitive" } },
				{
					asset: {
						assetName: { contains: params.search, mode: "insensitive" },
					},
				},
				{
					asset: {
						series: { contains: params.search, mode: "insensitive" },
					},
				},
				{
					differenceAccount: { contains: params.search, mode: "insensitive" },
				},
				{
					fixedAssetAccount: { contains: params.search, mode: "insensitive" },
				},
			];
		}

		const scopedWhere: Prisma.AssetValueAdjustmentWhereInput = {
			AND: [
				{ asset: { is: assetWhereForOrganization(organizationId) } },
				where,
			],
		};
		const [items, totalCount] = await Promise.all([
			this.prisma.assetValueAdjustment.findMany({
				where: scopedWhere,
				include: this.assetAdjustmentInclude,
				orderBy: [{ adjustmentDate: "desc" }, { createdAt: "desc" }],
				skip,
				take,
			}),
			this.prisma.assetValueAdjustment.count({ where: scopedWhere }),
		]);

		return {
			items: items.map(toAssetValueAdjustment),
			totalCount,
		};
	}

	async findAssetValueAdjustmentById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetValueAdjustmentItem | null> {
		this.assertOrganizationScope(organizationId);
		const adjustment = await this.prisma.assetValueAdjustment.findFirst({
			where: {
				id,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			include: this.assetAdjustmentInclude,
		});

		return adjustment ? toAssetValueAdjustment(adjustment) : null;
	}

	async previewAssetValueAdjustment(
		input: Asset.PreviewAssetValueAdjustmentInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetValueAdjustmentPreview> {
		const asset = await this.getAssetAdjustmentContextOrThrow(
			input.assetId,
			organizationId,
		);
		return this.buildAssetValueAdjustmentPreview(asset, input);
	}

	async createAssetValueAdjustment(
		input: Asset.CreateAssetValueAdjustmentInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetValueAdjustmentItem> {
		const asset = await this.getAssetAdjustmentContextOrThrow(
			input.assetId,
			organizationId,
		);
		const preview = await this.buildAssetValueAdjustmentPreview(asset, input);
		this.assertAssetValueAdjustmentPreviewIsValid(preview);

		const created = await this.prisma.assetValueAdjustment.create({
			data: {
				series: await this.generateAssetValueAdjustmentSeries(
					input.adjustmentDate,
					organizationId,
				),
				assetId: asset.id,
				financeBookId: preview.financeBookId,
				assetCategorySnapshot: asset.assetCategory?.name ?? null,
				adjustmentDate: input.adjustmentDate,
				currentAssetValue: preview.currentAssetValue.toString(),
				newAssetValue: preview.newAssetValue.toString(),
				differenceAmount: preview.differenceAmount.toString(),
				differenceAccount: input.differenceAccount.trim(),
				fixedAssetAccount: preview.fixedAssetAccount,
				costCenter: this.normalizeOptionalText(input.costCenter),
				notes: this.normalizeOptionalText(input.notes),
				status: "DRAFT",
				direction: preview.direction,
				previousAssetStatus: asset.status,
				previousIsFullyDepreciated: asset.isFullyDepreciated,
				previousAssetValueAfterDepreciation:
					this.resolveCurrentAssetValue(asset).toString(),
			},
			include: this.assetAdjustmentInclude,
		});

		return toAssetValueAdjustment(created);
	}

	async updateAssetValueAdjustment(
		input: Asset.UpdateAssetValueAdjustmentInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetValueAdjustmentItem> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.assetValueAdjustment.findFirst({
			where: {
				id: input.id,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: {
				id: true,
				status: true,
				assetId: true,
				financeBookId: true,
				adjustmentDate: true,
				newAssetValue: true,
				differenceAccount: true,
				costCenter: true,
				notes: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(
				`Asset value adjustment ${input.id} not found`,
			);
		}
		if (existing.status !== "DRAFT") {
			throw new BadRequestException(
				"Only draft asset value adjustments can be edited.",
			);
		}

		const targetAssetId = input.assetId ?? existing.assetId;
		const requestedFinanceBookId =
			input.financeBookId !== undefined
				? input.financeBookId
				: targetAssetId !== existing.assetId
					? null
					: existing.financeBookId;
		const asset = await this.getAssetAdjustmentContextOrThrow(
			targetAssetId,
			organizationId,
		);
		const draftInput = {
			adjustmentDate: input.adjustmentDate ?? existing.adjustmentDate,
			newAssetValue: input.newAssetValue ?? Number(existing.newAssetValue),
			financeBookId: requestedFinanceBookId,
		};
		const preview = await this.buildAssetValueAdjustmentPreview(
			asset,
			draftInput,
		);
		this.assertAssetValueAdjustmentPreviewIsValid(preview);

		const updateData = {
			assetId: asset.id,
			financeBookId: preview.financeBookId,
			assetCategorySnapshot: asset.assetCategory?.name ?? null,
			adjustmentDate: draftInput.adjustmentDate,
			currentAssetValue: preview.currentAssetValue.toString(),
			newAssetValue: preview.newAssetValue.toString(),
			differenceAmount: preview.differenceAmount.toString(),
			differenceAccount:
				input.differenceAccount?.trim() ?? existing.differenceAccount,
			fixedAssetAccount: preview.fixedAssetAccount,
			costCenter:
				input.costCenter !== undefined
					? this.normalizeOptionalText(input.costCenter)
					: existing.costCenter,
			notes:
				input.notes !== undefined
					? this.normalizeOptionalText(input.notes)
					: existing.notes,
			direction: preview.direction,
			previousAssetStatus: asset.status,
			previousIsFullyDepreciated: asset.isFullyDepreciated,
			previousAssetValueAfterDepreciation:
				this.resolveCurrentAssetValue(asset).toString(),
		};
		const updated = await this.prisma.$transaction(async (tx) => {
			const transition = await tx.assetValueAdjustment.updateMany({
				where: {
					id: input.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: updateData,
			});
			if (transition.count !== 1) {
				throw new NotFoundException(
					`Asset value adjustment ${input.id} not found`,
				);
			}
			return tx.assetValueAdjustment.findFirstOrThrow({
				where: {
					id: input.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.assetAdjustmentInclude,
			});
		});

		return toAssetValueAdjustment(updated);
	}

	async submitAssetValueAdjustment(
		input: Asset.SubmitAssetValueAdjustmentInput,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetValueAdjustmentItem> {
		this.assertOrganizationScope(organizationId);
		const pendingAdjustment = await this.prisma.assetValueAdjustment.findFirst({
			where: {
				id: input.id,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: {
				id: true,
				assetId: true,
				financeBookId: true,
				adjustmentDate: true,
				status: true,
			},
		});

		if (!pendingAdjustment) {
			throw new NotFoundException(
				`Asset value adjustment ${input.id} not found`,
			);
		}
		if (pendingAdjustment.status !== "DRAFT") {
			throw new BadRequestException(
				"Only draft asset value adjustments can be submitted.",
			);
		}

		await this.depreciationBarrier?.ensureDepreciationPosted({
			kind: "organization",
			organizationId,
			throughDate: pendingAdjustment.adjustmentDate,
			assetIds: [pendingAdjustment.assetId],
			...(pendingAdjustment.financeBookId
				? { financeBookId: pendingAdjustment.financeBookId }
				: {}),
		});

		const updated = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [pendingAdjustment.assetId]);
			await tx.$queryRaw(Prisma.sql`
				SELECT pg_advisory_xact_lock(hashtext(${`asset-value-adjustment:${input.id}`})) IS NULL AS "locked"
			`);
			const adjustment = await tx.assetValueAdjustment.findFirst({
				where: {
					id: input.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				select: {
					id: true,
					series: true,
					assetId: true,
					financeBookId: true,
					adjustmentDate: true,
					currentAssetValue: true,
					newAssetValue: true,
					differenceAccount: true,
					costCenter: true,
					notes: true,
					status: true,
				},
			});
			if (!adjustment || adjustment.status !== "DRAFT") {
				throw new ConflictException(
					"The asset value adjustment changed before it could be submitted.",
				);
			}
			if (adjustment.assetId !== pendingAdjustment.assetId) {
				throw new ConflictException(
					"The adjustment asset changed before submission. Refresh the draft and try again.",
				);
			}

			const asset = await this.getAssetAdjustmentContextOrThrow(
				adjustment.assetId,
				organizationId,
				tx,
			);
			const preview = await this.buildAssetValueAdjustmentPreview(asset, {
				financeBookId: adjustment.financeBookId,
				adjustmentDate: adjustment.adjustmentDate,
				newAssetValue: Number(adjustment.newAssetValue),
			});
			this.assertAssetValueAdjustmentPreviewIsValid(preview);
			if (
				Math.abs(
					Number(adjustment.currentAssetValue) - preview.currentAssetValue,
				) > 0.000001
			) {
				throw new ConflictException(
					"The selected finance book's carrying value changed while this adjustment was in draft. Refresh the draft before submitting it.",
				);
			}

			const revaluationLines = buildRevaluationEntryLines({
				differenceAmount: preview.differenceAmount,
				fixedAssetAccount: preview.fixedAssetAccount,
				differenceAccount: adjustment.differenceAccount,
				costCenter: adjustment.costCenter ?? null,
			});
			const now = new Date();
			const entrySeries = await this.generateAssetRevaluationEntrySeries(
				adjustment.adjustmentDate,
				organizationId,
				tx,
			);

			await tx.assetRevaluationEntry.create({
				data: {
					series: entrySeries,
					adjustmentId: adjustment.id,
					assetId: asset.id,
					companyId: asset.companyId,
					postingDate: adjustment.adjustmentDate,
					remarks: `Asset revaluation for ${asset.series} via ${adjustment.series}`,
					lines: {
						create: revaluationLines.map((line) => ({
							lineType: line.lineType,
							account: line.account,
							debitAmount: line.debitAmount.toString(),
							creditAmount: line.creditAmount.toString(),
							costCenter: line.costCenter,
						})),
					},
				},
			});

			if (asset.calculateDepreciation && preview.financeBookId) {
				const selectedFinanceBook = asset.financeBooks.find(
					(book) => book.financeBookId === preview.financeBookId,
				);
				if (!selectedFinanceBook) {
					throw new ConflictException(
						"The selected finance book is no longer configured for this asset.",
					);
				}
				const adjustedSalvageValue = this.getAdjustedSalvageValue(
					preview.currentAssetValue,
					preview.newAssetValue,
					selectedFinanceBook.expectedValueAfterUsefulLife,
				);
				await this.depreciationRevision.revise(tx, organizationId, {
					assetId: asset.id,
					financeBookId: preview.financeBookId,
					effectiveDate: adjustment.adjustmentDate,
					valueDelta: preview.differenceAmount,
					salvageValueDelta: this.roundCurrency(
						adjustedSalvageValue -
							selectedFinanceBook.expectedValueAfterUsefulLife,
					),
					usefulLifeDeltaMonths: 0,
					adjustmentId: adjustment.id,
					notes:
						this.normalizeOptionalText(adjustment.notes) ??
						`Projected from adjustment ${adjustment.series}`,
				});
			}

			const previousRootValue = this.resolveCurrentAssetValue(asset);
			const resultingRootValue = this.roundCurrency(
				previousRootValue + preview.differenceAmount,
			);
			const resultState = getAssetValueAdjustmentResultState(
				asset.status,
				resultingRootValue,
			);
			await this.updateOwnedAsset(tx, organizationId, asset.id, {
				valueAfterDepreciation: resultingRootValue.toString(),
				isFullyDepreciated: resultState.isFullyDepreciated,
				status: resultState.status,
			});

			await tx.assetActivity.create({
				data: {
					assetId: asset.id,
					activity: `Asset value adjustment ${adjustment.series} submitted. Carrying value changed from ${preview.currentAssetValue.toFixed(2)} to ${preview.newAssetValue.toFixed(2)} via ${entrySeries}.`,
					userId: actorId ?? null,
				},
			});

			const submitted = await tx.assetValueAdjustment.updateMany({
				where: {
					id: adjustment.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: {
					financeBookId: preview.financeBookId,
					currentAssetValue: preview.currentAssetValue.toString(),
					newAssetValue: preview.newAssetValue.toString(),
					differenceAmount: preview.differenceAmount.toString(),
					fixedAssetAccount: preview.fixedAssetAccount,
					direction: preview.direction,
					previousAssetStatus: asset.status,
					previousIsFullyDepreciated: asset.isFullyDepreciated,
					previousAssetValueAfterDepreciation: previousRootValue.toString(),
					status: "SUBMITTED",
					submittedAt: now,
					cancelledAt: null,
				},
			});
			if (submitted.count !== 1) {
				throw new NotFoundException(
					`Asset value adjustment ${adjustment.id} not found`,
				);
			}
			return tx.assetValueAdjustment.findFirstOrThrow({
				where: {
					id: adjustment.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.assetAdjustmentInclude,
			});
		});

		return toAssetValueAdjustment(updated);
	}

	async cancelAssetValueAdjustment(
		input: Asset.CancelAssetValueAdjustmentInput,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetValueAdjustmentItem> {
		this.assertOrganizationScope(organizationId);
		const pendingAdjustment = await this.prisma.assetValueAdjustment.findFirst({
			where: {
				id: input.id,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: {
				id: true,
				assetId: true,
				status: true,
			},
		});

		if (!pendingAdjustment) {
			throw new NotFoundException(
				`Asset value adjustment ${input.id} not found`,
			);
		}
		if (pendingAdjustment.status !== "SUBMITTED") {
			throw new BadRequestException(
				"Only submitted asset value adjustments can be cancelled.",
			);
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [pendingAdjustment.assetId]);
			await tx.$queryRaw(Prisma.sql`
				SELECT pg_advisory_xact_lock(hashtext(${`asset-value-adjustment:${input.id}`})) IS NULL AS "locked"
			`);
			const adjustment = await tx.assetValueAdjustment.findFirst({
				where: {
					id: input.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				select: {
					id: true,
					series: true,
					assetId: true,
					financeBookId: true,
					currentAssetValue: true,
					status: true,
					previousAssetStatus: true,
					previousIsFullyDepreciated: true,
					previousAssetValueAfterDepreciation: true,
					submittedAt: true,
					revaluationEntry: { select: { id: true } },
					depreciationSchedule: { select: { id: true } },
				},
			});
			if (!adjustment || adjustment.status !== "SUBMITTED") {
				throw new ConflictException(
					"The asset value adjustment changed before it could be cancelled.",
				);
			}
			const asset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					id: adjustment.assetId,
				}),
				select: { companyId: true, calculateDepreciation: true },
			});
			if (!asset) {
				throw new NotFoundException(`Asset ${adjustment.assetId} not found`);
			}
			if (
				asset.calculateDepreciation &&
				(!adjustment.financeBookId || !adjustment.depreciationSchedule)
			) {
				throw new BadRequestException(
					"This depreciating adjustment has incomplete finance-book history and cannot be cancelled safely.",
				);
			}

			const newerSubmittedAdjustments = await tx.assetValueAdjustment.count({
				where: {
					assetId: adjustment.assetId,
					asset: { is: assetWhereForOrganization(organizationId) },
					status: "SUBMITTED",
					submittedAt: { gt: adjustment.submittedAt ?? new Date(0) },
				},
			});
			if (newerSubmittedAdjustments > 0) {
				throw new BadRequestException(
					"Only the latest submitted asset value adjustment can be cancelled.",
				);
			}
			if (!adjustment.revaluationEntry) {
				throw new BadRequestException(
					"The revaluation entry for this asset value adjustment is missing.",
				);
			}

			if (adjustment.depreciationSchedule) {
				if (!adjustment.financeBookId) {
					throw new BadRequestException(
						"The adjustment's finance book identity is missing.",
					);
				}
				await this.depreciationRevision.restoreRevision(tx, organizationId, {
					assetId: adjustment.assetId,
					financeBookId: adjustment.financeBookId,
					scheduleId: adjustment.depreciationSchedule.id,
					previousValueAfterDepreciation: Number(adjustment.currentAssetValue),
				});
			}

			const reversedRevaluation = await tx.assetRevaluationEntry.updateMany({
				where: {
					id: adjustment.revaluationEntry.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: {
					status: "REVERSED",
					reversedAt: new Date(),
				},
			});
			if (reversedRevaluation.count !== 1) {
				throw new NotFoundException(
					`Asset revaluation entry ${adjustment.revaluationEntry.id} not found`,
				);
			}

			await this.updateOwnedAsset(tx, organizationId, adjustment.assetId, {
				valueAfterDepreciation: Number(
					adjustment.previousAssetValueAfterDepreciation ??
						adjustment.currentAssetValue,
				).toString(),
				status: adjustment.previousAssetStatus,
				isFullyDepreciated: adjustment.previousIsFullyDepreciated,
			});

			await tx.assetActivity.create({
				data: {
					assetId: adjustment.assetId,
					activity: `Asset value adjustment ${adjustment.series} cancelled and the previous carrying value was restored.`,
					userId: actorId ?? null,
				},
			});

			const cancelled = await tx.assetValueAdjustment.updateMany({
				where: {
					id: adjustment.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: {
					status: "CANCELLED",
					cancelledAt: new Date(),
				},
			});
			if (cancelled.count !== 1) {
				throw new NotFoundException(
					`Asset value adjustment ${adjustment.id} not found`,
				);
			}
			return tx.assetValueAdjustment.findFirstOrThrow({
				where: {
					id: adjustment.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.assetAdjustmentInclude,
			});
		});

		return toAssetValueAdjustment(updated);
	}

	async deleteAssetValueAdjustment(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<{ success: boolean; id: string }> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.assetValueAdjustment.findFirst({
			where: {
				id,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: { id: true, status: true },
		});

		if (!existing) {
			throw new NotFoundException(`Asset value adjustment ${id} not found`);
		}
		if (existing.status !== "DRAFT") {
			throw new BadRequestException(
				"Only draft asset value adjustments can be deleted.",
			);
		}

		const deleted = await this.prisma.assetValueAdjustment.deleteMany({
			where: {
				id,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
		});
		if (deleted.count !== 1) {
			throw new NotFoundException(`Asset value adjustment ${id} not found`);
		}
		return { success: true, id };
	}

	// ============================================================================
	// Location Methods
	// ============================================================================

	async findAllLocations(
		organizationId: AssetOrganizationId,
		params?: Asset.ListLocationsInput,
	): Promise<Asset.LocationListResult> {
		this.assertOrganizationScope(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.isGroup !== undefined) where.isGroup = params.isGroup;
		if (params?.search) {
			where.name = { contains: params.search, mode: "insensitive" };
		}

		const locationSelect = {
			id: true,
			name: true,
			parentLocationId: true,
			parentLocation: { select: { name: true } },
			isGroup: true,
			createdAt: true,
			updatedAt: true,
		} as const;

		const [items, totalCount] = await Promise.all([
			this.prisma.location.findMany({
				where,
				select: locationSelect,
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.location.count({ where }),
		]);

		return { items: items.map(toAssetLocation), totalCount };
	}

	async findLocationById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.Location | null> {
		this.assertOrganizationScope(organizationId);
		const loc = await this.prisma.location.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				parentLocationId: true,
				parentLocation: { select: { name: true } },
				isGroup: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		return loc ? toAssetLocation(loc) : null;
	}

	async createLocation(
		input: Asset.CreateLocationInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.Location> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.location.findUnique({
			where: { name: input.name },
			select: { id: true },
		});
		if (existing) {
			throw new BadRequestException(
				`Location with name "${input.name}" already exists`,
			);
		}

		const locationSelectFields = {
			id: true,
			name: true,
			parentLocationId: true,
			parentLocation: { select: { name: true } },
			isGroup: true,
			createdAt: true,
			updatedAt: true,
		} as const;

		const loc = await this.prisma.location.create({
			data: {
				name: input.name,
				parentLocationId: input.parentLocationId ?? null,
				isGroup: input.isGroup ?? false,
			},
			select: locationSelectFields,
		});
		return toAssetLocation(loc);
	}

	async updateLocation(
		input: Asset.UpdateLocationInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.Location> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.location.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing)
			throw new NotFoundException(`Location ${input.id} not found`);

		const loc = await this.prisma.location.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined && { name: input.name }),
				...(input.parentLocationId !== undefined && {
					parentLocationId: input.parentLocationId,
				}),
				...(input.isGroup !== undefined && { isGroup: input.isGroup }),
			},
			select: {
				id: true,
				name: true,
				parentLocationId: true,
				parentLocation: { select: { name: true } },
				isGroup: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		return toAssetLocation(loc);
	}

	async deleteLocation(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<{ success: boolean; id: string }> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.location.findUnique({
			where: { id },
			select: { id: true, _count: { select: { assets: true } } },
		});
		if (!existing) throw new NotFoundException(`Location ${id} not found`);
		if (existing._count.assets > 0) {
			throw new BadRequestException(
				"Cannot delete a location that is assigned to assets",
			);
		}
		await this.prisma.location.delete({ where: { id } });
		return { success: true, id };
	}

	// ============================================================================
	// Finance Book Methods
	// ============================================================================

	/** Lists named finance books used by independent depreciation schedules. */
	async findAllFinanceBooks(
		organizationId: AssetOrganizationId,
		params?: {
			skip?: number;
			take?: number;
			search?: string;
		},
	): Promise<Asset.FinanceBookListResult> {
		this.assertOrganizationScope(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);
		const where = params?.search
			? { name: { contains: params.search, mode: "insensitive" as const } }
			: {};
		const [items, totalCount] = await Promise.all([
			this.prisma.financeBook.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.financeBook.count({ where }),
		]);
		return { items, totalCount };
	}

	/** Creates a uniquely named finance book. */
	async createFinanceBook(
		input: { name: string },
		organizationId: AssetOrganizationId,
	): Promise<Asset.FinanceBook> {
		this.assertOrganizationScope(organizationId);
		const name = input.name.trim();
		const existing = await this.prisma.financeBook.findUnique({
			where: { name },
			select: { id: true },
		});
		if (existing) {
			throw new ConflictException(`Finance book "${name}" already exists`);
		}
		return this.prisma.financeBook.create({ data: { name } });
	}

	/** Renames an existing finance book. */
	async updateFinanceBook(
		input: {
			id: string;
			name: string;
		},
		organizationId: AssetOrganizationId,
	): Promise<Asset.FinanceBook> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.financeBook.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing)
			throw new NotFoundException(`Finance book ${input.id} not found`);
		return this.prisma.financeBook.update({
			where: { id: input.id },
			data: { name: input.name.trim() },
		});
	}

	/** Deletes an unused finance book. */
	async deleteFinanceBook(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<{ success: true; id: string }> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.financeBook.findUnique({
			where: { id },
			select: {
				id: true,
				_count: {
					select: {
						assetFinanceBooks: true,
						categoryDefaults: true,
						companies: true,
					},
				},
			},
		});
		if (!existing) throw new NotFoundException(`Finance book ${id} not found`);
		const references =
			existing._count.assetFinanceBooks +
			existing._count.categoryDefaults +
			existing._count.companies;
		if (references > 0) {
			throw new BadRequestException(
				"Cannot delete a finance book that is in use",
			);
		}
		await this.prisma.financeBook.delete({ where: { id } });
		return { success: true, id };
	}

	// ============================================================================
	// Asset Category Methods
	// ============================================================================

	async findAllAssetCategories(
		organizationId: AssetOrganizationId,
		params?: Asset.ListAssetCategoriesInput,
	): Promise<Asset.AssetCategoryListResult> {
		this.assertOrganizationScope(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.search) {
			where.name = { contains: params.search, mode: "insensitive" };
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetCategory.findMany({
				where,
				include: this.assetCategoryIncludeForOrganization(organizationId),
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.assetCategory.count({ where }),
		]);

		return { items: items.map(toAssetCategory), totalCount };
	}

	async findAssetCategoryById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetCategory | null> {
		this.assertOrganizationScope(organizationId);
		const cat = await this.prisma.assetCategory.findUnique({
			where: { id },
			include: this.assetCategoryIncludeForOrganization(organizationId),
		});
		return cat ? toAssetCategory(cat) : null;
	}

	async createAssetCategory(
		input: Asset.CreateAssetCategoryInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetCategory> {
		this.assertOrganizationScope(organizationId);
		await this.validateAssetCategoryReferences(
			organizationId,
			input.accounts,
			input.financeBooks,
		);
		const existing = await this.prisma.assetCategory.findUnique({
			where: { name: input.name },
			select: { id: true },
		});
		if (existing) {
			throw new BadRequestException(
				`Asset category "${input.name}" already exists`,
			);
		}

		const cat = await this.prisma.assetCategory.create({
			data: {
				name: input.name,
				depreciationMethod: input.depreciationMethod ?? null,
				totalNumberOfDepreciations: input.totalNumberOfDepreciations ?? null,
				frequencyOfDepreciation: input.frequencyOfDepreciation ?? null,
				dailyProrataBased: input.dailyProrataBased ?? false,
				shiftBased: input.shiftBased ?? false,
				rateOfDepreciation: input.rateOfDepreciation ?? null,
				expectedValueAfterUsefulLife: input.expectedValueAfterUsefulLife
					? new Prisma.Decimal(input.expectedValueAfterUsefulLife)
					: null,
				nonDepreciableCategory: input.nonDepreciableCategory ?? false,
				enableCwipAccounting: input.enableCwipAccounting ?? false,
				financeBookDefaults: input.financeBooks?.length
					? {
							create: input.financeBooks.map((book) => ({
								financeBookId: book.financeBookId,
								depreciationMethod: book.depreciationMethod,
								totalNumberOfDepreciations: book.totalNumberOfDepreciations,
								frequencyOfDepreciation: book.frequencyOfDepreciation,
								dailyProrataBased: book.dailyProrataBased ?? false,
								shiftBased: book.shiftBased ?? false,
								rateOfDepreciation:
									book.rateOfDepreciation == null
										? null
										: new Prisma.Decimal(book.rateOfDepreciation),
								expectedValueAfterUsefulLife:
									book.expectedValueAfterUsefulLife == null
										? null
										: new Prisma.Decimal(book.expectedValueAfterUsefulLife),
							})),
						}
					: undefined,
				accounts: input.accounts?.length
					? {
							create: input.accounts.map((account) => ({
								companyId: account.companyId,
								fixedAssetAccount: account.fixedAssetAccount,
								accumulatedDepreciationAccount: this.normalizeOptionalText(
									account.accumulatedDepreciationAccount,
								),
								depreciationExpenseAccount: this.normalizeOptionalText(
									account.depreciationExpenseAccount,
								),
								capitalWorkInProgressAccount: this.normalizeOptionalText(
									account.capitalWorkInProgressAccount,
								),
							})),
						}
					: undefined,
			},
			include: this.assetCategoryIncludeForOrganization(organizationId),
		});
		return toAssetCategory(cat);
	}

	async updateAssetCategory(
		input: Asset.UpdateAssetCategoryInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetCategory> {
		this.assertOrganizationScope(organizationId);
		await this.validateAssetCategoryReferences(
			organizationId,
			input.accounts,
			input.financeBooks,
		);
		const organizationCompanyIds =
			input.accounts === undefined
				? undefined
				: await this.findOrganizationCompanyIds(organizationId);
		const existing = await this.prisma.assetCategory.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Asset category ${input.id} not found`);
		}

		const cat = await this.prisma.assetCategory.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined && { name: input.name }),
				...(input.depreciationMethod !== undefined && {
					depreciationMethod: input.depreciationMethod,
				}),
				...(input.totalNumberOfDepreciations !== undefined && {
					totalNumberOfDepreciations: input.totalNumberOfDepreciations,
				}),
				...(input.frequencyOfDepreciation !== undefined && {
					frequencyOfDepreciation: input.frequencyOfDepreciation,
				}),
				...(input.dailyProrataBased !== undefined && {
					dailyProrataBased: input.dailyProrataBased ?? false,
				}),
				...(input.shiftBased !== undefined && {
					shiftBased: input.shiftBased ?? false,
				}),
				...(input.rateOfDepreciation !== undefined && {
					rateOfDepreciation: input.rateOfDepreciation,
				}),
				...(input.expectedValueAfterUsefulLife !== undefined && {
					expectedValueAfterUsefulLife: input.expectedValueAfterUsefulLife
						? new Prisma.Decimal(input.expectedValueAfterUsefulLife)
						: null,
				}),
				...(input.nonDepreciableCategory !== undefined && {
					nonDepreciableCategory: input.nonDepreciableCategory,
				}),
				...(input.enableCwipAccounting !== undefined && {
					enableCwipAccounting: input.enableCwipAccounting,
				}),
				...(input.financeBooks !== undefined && {
					financeBookDefaults: {
						deleteMany: {},
						create: input.financeBooks.map((book) => ({
							financeBookId: book.financeBookId,
							depreciationMethod: book.depreciationMethod,
							totalNumberOfDepreciations: book.totalNumberOfDepreciations,
							frequencyOfDepreciation: book.frequencyOfDepreciation,
							dailyProrataBased: book.dailyProrataBased ?? false,
							shiftBased: book.shiftBased ?? false,
							rateOfDepreciation:
								book.rateOfDepreciation == null
									? null
									: new Prisma.Decimal(book.rateOfDepreciation),
							expectedValueAfterUsefulLife:
								book.expectedValueAfterUsefulLife == null
									? null
									: new Prisma.Decimal(book.expectedValueAfterUsefulLife),
						})),
					},
				}),
				...(input.accounts !== undefined && {
					accounts: {
						deleteMany: {
							companyId: { in: organizationCompanyIds ?? [] },
						},
						create: input.accounts.map((account) => ({
							companyId: account.companyId,
							fixedAssetAccount: account.fixedAssetAccount,
							accumulatedDepreciationAccount: this.normalizeOptionalText(
								account.accumulatedDepreciationAccount,
							),
							depreciationExpenseAccount: this.normalizeOptionalText(
								account.depreciationExpenseAccount,
							),
							capitalWorkInProgressAccount: this.normalizeOptionalText(
								account.capitalWorkInProgressAccount,
							),
						})),
					},
				}),
			},
			include: this.assetCategoryIncludeForOrganization(organizationId),
		});
		return toAssetCategory(cat);
	}

	async deleteAssetCategory(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<{ success: boolean; id: string }> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.assetCategory.findUnique({
			where: { id },
			select: { id: true, _count: { select: { assets: true } } },
		});
		if (!existing) {
			throw new NotFoundException(`Asset category ${id} not found`);
		}
		if (existing._count.assets > 0) {
			throw new BadRequestException(
				"Cannot delete an asset category that is assigned to assets",
			);
		}
		await this.prisma.assetCategory.delete({ where: { id } });
		return { success: true, id };
	}

	// ============================================================================
	// Asset Maintenance Team Methods
	// ============================================================================

	async findAllMaintenanceTeams(
		organizationId: AssetOrganizationId,
		params?: Asset.ListMaintenanceTeamsInput,
	): Promise<Asset.AssetMaintenanceTeamListResult> {
		this.assertOrganizationScope(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Prisma.AssetMaintenanceTeamWhereInput = {
			company: { is: { organizationId } },
		};
		if (params?.company)
			where.company = {
				is: {
					organizationId,
					name: { contains: params.company, mode: "insensitive" },
				},
			};
		if (params?.search) {
			where.OR = [
				{ name: { contains: params.search, mode: "insensitive" } },
				{
					maintenanceManager: { contains: params.search, mode: "insensitive" },
				},
				{
					maintenanceManagerName: {
						contains: params.search,
						mode: "insensitive",
					},
				},
				{
					company: {
						is: { name: { contains: params.search, mode: "insensitive" } },
					},
				},
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenanceTeam.findMany({
				where,
				include: {
					company: { select: { id: true, name: true } },
					members: { orderBy: { createdAt: "asc" } },
				},
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenanceTeam.count({ where }),
		]);

		return { items: items.map(toMaintenanceTeam), totalCount };
	}

	async findMaintenanceTeamById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetMaintenanceTeam | null> {
		this.assertOrganizationScope(organizationId);
		const team = await this.prisma.assetMaintenanceTeam.findFirst({
			where: { id, company: { is: { organizationId } } },
			include: {
				company: { select: { id: true, name: true } },
				members: { orderBy: { createdAt: "asc" } },
			},
		});
		return team ? toMaintenanceTeam(team) : null;
	}

	async createMaintenanceTeam(
		input: Asset.CreateAssetMaintenanceTeamInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetMaintenanceTeam> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { name: input.name },
			select: { id: true },
		});
		if (existing) {
			throw new BadRequestException(
				`A maintenance team with the name "${input.name}" already exists`,
			);
		}
		const company = await this.prisma.company.findFirst({
			where: companyWhereForOrganization(organizationId, {
				id: input.companyId,
			}),
			select: { id: true, disabled: true },
		});
		if (!company || company.disabled) {
			throw new BadRequestException(
				`Company ${input.companyId} is missing or disabled`,
			);
		}

		const team = await this.prisma.assetMaintenanceTeam.create({
			data: {
				name: input.name,
				maintenanceManager: input.maintenanceManager ?? null,
				maintenanceManagerName: input.maintenanceManagerName ?? null,
				companyId: input.companyId,
				members: {
					create: input.members.map((m) => ({
						teamMember: m.teamMember,
						fullName: m.fullName,
						maintenanceRole: m.maintenanceRole,
					})),
				},
			},
			include: {
				company: { select: { id: true, name: true } },
				members: { orderBy: { createdAt: "asc" } },
			},
		});

		this.logger.log(`Created maintenance team "${team.name}"`);
		return toMaintenanceTeam(team);
	}

	async updateMaintenanceTeam(
		input: Asset.UpdateAssetMaintenanceTeamInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetMaintenanceTeam> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.assetMaintenanceTeam.findFirst({
			where: { id: input.id, company: { is: { organizationId } } },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Maintenance team ${input.id} not found`);
		}

		if (input.name !== undefined) {
			const nameConflict = await this.prisma.assetMaintenanceTeam.findFirst({
				where: { name: input.name, company: { is: { organizationId } } },
				select: { id: true },
			});
			if (nameConflict && nameConflict.id !== input.id) {
				throw new BadRequestException(
					`A maintenance team with the name "${input.name}" already exists`,
				);
			}
		}
		if (input.companyId !== undefined) {
			const company = await this.prisma.company.findFirst({
				where: companyWhereForOrganization(organizationId, {
					id: input.companyId,
				}),
				select: { id: true, disabled: true },
			});
			if (!company || company.disabled) {
				throw new BadRequestException(
					`Company ${input.companyId} is missing or disabled`,
				);
			}
			const conflictingMaintenance =
				await this.prisma.assetMaintenance?.findFirst?.({
					where: {
						maintenanceTeamId: input.id,
						companyId: { not: input.companyId },
						maintenanceTeam: {
							is: { company: { is: { organizationId } } },
						},
					},
					select: { id: true },
				});
			if (conflictingMaintenance) {
				throw new BadRequestException(
					"A maintenance team cannot change company while it has maintenance records for another company.",
				);
			}
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			await this.lockMaintenanceTeams(tx, [input.id]);
			if (input.companyId !== undefined) {
				const conflictingMaintenance = await tx.assetMaintenance?.findFirst?.({
					where: {
						maintenanceTeamId: input.id,
						companyId: { not: input.companyId },
						maintenanceTeam: {
							is: { company: { is: { organizationId } } },
						},
					},
					select: { id: true },
				});
				if (conflictingMaintenance) {
					throw new BadRequestException(
						"A maintenance team cannot change company while it has maintenance records for another company.",
					);
				}
			}
			const teamTransition = await tx.assetMaintenanceTeam.updateMany({
				where: { id: input.id, company: { is: { organizationId } } },
				data: {
					...(input.name !== undefined && { name: input.name }),
					...(input.maintenanceManager !== undefined && {
						maintenanceManager: input.maintenanceManager,
					}),
					...(input.maintenanceManagerName !== undefined && {
						maintenanceManagerName: input.maintenanceManagerName,
					}),
					...(input.companyId !== undefined && { companyId: input.companyId }),
				},
			});
			if (teamTransition.count !== 1) {
				throw new NotFoundException(`Maintenance team ${input.id} not found`);
			}

			if (input.members !== undefined) {
				const keptIds = input.members
					.filter((m): m is typeof m & { id: string } => Boolean(m.id))
					.map((m) => m.id);

				if (keptIds.length > 0) {
					const owned = await tx.assetMaintenanceTeamMember.findMany({
						where: {
							id: { in: keptIds },
							teamId: input.id,
							team: {
								is: { company: { is: { organizationId } } },
							},
						},
						select: { id: true },
					});
					const ownedIds = new Set(owned.map((m) => m.id));
					const foreignId = keptIds.find((mid) => !ownedIds.has(mid));
					if (foreignId) {
						throw new BadRequestException(
							`Team member with ID ${foreignId} does not belong to this team`,
						);
					}
				}

				if (keptIds.length === 0) {
					await tx.assetMaintenanceTeamMember.deleteMany({
						where: {
							teamId: input.id,
							team: {
								is: { company: { is: { organizationId } } },
							},
						},
					});
				} else {
					await tx.assetMaintenanceTeamMember.deleteMany({
						where: {
							teamId: input.id,
							id: { notIn: keptIds },
							team: {
								is: { company: { is: { organizationId } } },
							},
						},
					});
				}

				for (const member of input.members) {
					if (member.id) {
						const memberUpdate = await tx.assetMaintenanceTeamMember.updateMany(
							{
								where: {
									id: member.id,
									teamId: input.id,
									team: {
										is: { company: { is: { organizationId } } },
									},
								},
								data: {
									teamMember: member.teamMember,
									fullName: member.fullName,
									maintenanceRole: member.maintenanceRole,
								},
							},
						);
						if (memberUpdate.count !== 1) {
							throw new BadRequestException(
								`Team member with ID ${member.id} does not belong to this team`,
							);
						}
					} else {
						await tx.assetMaintenanceTeamMember.create({
							data: {
								teamId: input.id,
								teamMember: member.teamMember,
								fullName: member.fullName,
								maintenanceRole: member.maintenanceRole,
							},
						});
					}
				}
			}

			return tx.assetMaintenanceTeam.findFirstOrThrow({
				where: { id: input.id, company: { is: { organizationId } } },
				include: {
					company: { select: { id: true, name: true } },
					members: { orderBy: { createdAt: "asc" } },
				},
			});
		});

		return toMaintenanceTeam(updated);
	}

	async deleteMaintenanceTeam(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<{ success: boolean; id: string }> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.assetMaintenanceTeam.findFirst({
			where: { id, company: { is: { organizationId } } },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Maintenance team ${id} not found`);
		}
		const deleted = await this.prisma.assetMaintenanceTeam.deleteMany({
			where: { id, company: { is: { organizationId } } },
		});
		if (deleted.count !== 1) {
			throw new NotFoundException(`Maintenance team ${id} not found`);
		}
		return { success: true, id };
	}

	async deleteManyMaintenanceTeams(
		ids: string[],
		organizationId: AssetOrganizationId,
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		this.assertOrganizationScope(organizationId);
		const unique = [...new Set(ids)];
		const existing = await this.prisma.assetMaintenanceTeam.findMany({
			where: {
				id: { in: unique },
				company: { is: { organizationId } },
			},
			select: { id: true },
		});
		if (existing.length !== unique.length) {
			throw new NotFoundException(
				"One or more maintenance teams are not available in the active organization",
			);
		}
		const result = await this.prisma.assetMaintenanceTeam.deleteMany({
			where: {
				id: { in: unique },
				company: { is: { organizationId } },
			},
		});
		return { success: true, count: result.count, ids: unique };
	}

	// ============================================================================
	// Asset Maintenance Methods
	// ============================================================================

	/**
	 * Calculates the next due date based on the periodicity and reference date.
	 *
	 * @remarks
	 * Mirrors ERPNext calculate_next_due_date:
	 * - Uses lastCompletionDate as base if it is more recent than startDate.
	 * - Returns null when the calculated date would exceed endDate or when
	 *   startDate >= endDate.
	 */
	calculateNextDueDate(
		periodicity: Asset.AssetMaintenancePeriodicity,
		startDate: Date,
		endDate: Date | null | undefined,
		lastCompletionDate: Date | null | undefined,
	): Date | null {
		const base =
			lastCompletionDate && lastCompletionDate > startDate
				? lastCompletionDate
				: startDate;

		if (endDate && base >= endDate) return null;

		let next: Date;
		const d = new Date(base);

		switch (periodicity) {
			case "DAILY":
				next = new Date(d.setDate(d.getDate() + 1));
				break;
			case "WEEKLY":
				next = new Date(d.setDate(d.getDate() + 7));
				break;
			case "MONTHLY":
				next = new Date(d.setMonth(d.getMonth() + 1));
				break;
			case "QUARTERLY":
				next = new Date(d.setMonth(d.getMonth() + 3));
				break;
			case "HALF_YEARLY":
				next = new Date(d.setMonth(d.getMonth() + 6));
				break;
			case "YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 1));
				break;
			case "TWO_YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 2));
				break;
			case "THREE_YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 3));
				break;
			default:
				return null;
		}

		if (endDate && next >= endDate) return null;
		return next;
	}

	private readonly maintenanceInclude = {
		company: { select: { id: true, name: true } },
		asset: {
			select: {
				assetName: true,
				itemCode: true,
				assetCategory: { select: { name: true } },
			},
		},
		maintenanceTeam: { select: { name: true } },
		tasks: { orderBy: { createdAt: "asc" as const } },
	};

	async findAllAssetMaintenances(
		organizationId: AssetOrganizationId,
		params?: Asset.ListAssetMaintenancesInput,
	): Promise<Asset.AssetMaintenanceListResult> {
		this.assertOrganizationScope(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Prisma.AssetMaintenanceWhereInput = {
			company: { is: { organizationId } },
			asset: { is: assetWhereForOrganization(organizationId) },
		};
		if (params?.company)
			where.company = {
				is: {
					organizationId,
					name: { contains: params.company, mode: "insensitive" },
				},
			};
		if (params?.maintenanceTeamId)
			where.maintenanceTeamId = params.maintenanceTeamId;
		if (params?.status)
			where.tasks = { some: { maintenanceStatus: params.status } };
		if (params?.search) {
			where.OR = [
				{
					company: {
						is: { name: { contains: params.search, mode: "insensitive" } },
					},
				},
				{
					asset: {
						assetName: { contains: params.search, mode: "insensitive" },
					},
				},
				{
					maintenanceTeam: {
						name: { contains: params.search, mode: "insensitive" },
					},
				},
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenance.findMany({
				where,
				include: this.maintenanceInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenance.count({ where }),
		]);

		return { items: items.map(toAssetMaintenance), totalCount };
	}

	async findAssetMaintenanceById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetMaintenanceRecord | null> {
		this.assertOrganizationScope(organizationId);
		const record = await this.prisma.assetMaintenance.findFirst({
			where: {
				id,
				company: { is: { organizationId } },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			include: this.maintenanceInclude,
		});
		return record ? toAssetMaintenance(record) : null;
	}

	async findAssetMaintenanceByAssetId(
		assetId: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetMaintenanceRecord | null> {
		this.assertOrganizationScope(organizationId);
		const record = await this.prisma.assetMaintenance.findFirst({
			where: {
				assetId,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			include: this.maintenanceInclude,
		});
		return record ? toAssetMaintenance(record) : null;
	}

	async findAssetMaintenanceLogs(
		maintenanceId: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetMaintenanceLogItem[]> {
		this.assertOrganizationScope(organizationId);
		const logs = await this.prisma.assetMaintenanceLog.findMany({
			where: {
				maintenanceId,
				maintenance: {
					is: {
						company: { is: { organizationId } },
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});
		return logs.map(toAssetMaintenanceLog);
	}

	private readonly logWithContextInclude = {
		maintenance: {
			select: {
				id: true,
				assetId: true,
				companyId: true,
				company: { select: { name: true } },
				asset: { select: { id: true, assetName: true } },
			},
		},
		task: {
			select: {
				id: true,
				maintenanceTask: true,
				maintenanceType: true,
				periodicity: true,
				assignToName: true,
				nextDueDate: true,
			},
		},
	} as const;

	async findAllAssetMaintenanceLogs(
		organizationId: AssetOrganizationId,
		params?: Asset.ListAssetMaintenanceLogsInput,
	): Promise<Asset.AssetMaintenanceLogListResult> {
		this.assertOrganizationScope(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Prisma.AssetMaintenanceLogWhereInput = {
			maintenance: {
				is: {
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			},
		};
		if (params?.maintenanceId) where.maintenanceId = params.maintenanceId;
		if (params?.status) where.maintenanceStatus = params.status;
		if (params?.search) {
			where.OR = [
				{
					maintenance: {
						asset: {
							assetName: {
								contains: params.search,
								mode: "insensitive",
							},
						},
					},
				},
				{
					task: {
						maintenanceTask: {
							contains: params.search,
							mode: "insensitive",
						},
					},
				},
				{
					maintenance: {
						company: {
							is: {
								name: {
									contains: params.search,
									mode: "insensitive",
								},
							},
						},
					},
				},
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenanceLog.findMany({
				where,
				include: this.logWithContextInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenanceLog.count({ where }),
		]);

		return {
			items: items.map(toAssetMaintenanceLogListItem),
			totalCount,
		};
	}

	async cancelAssetMaintenanceLog(
		input: Asset.CancelAssetMaintenanceLogInput,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetMaintenanceLogItem> {
		this.assertOrganizationScope(organizationId);
		const log = await this.prisma.assetMaintenanceLog.findFirst({
			where: {
				id: input.logId,
				maintenance: {
					is: {
						company: { is: { organizationId } },
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				},
			},
			select: {
				id: true,
				maintenanceId: true,
				taskId: true,
				maintenanceStatus: true,
				maintenance: { select: { assetId: true } },
			},
		});
		if (!log)
			throw new NotFoundException(`Maintenance log ${input.logId} not found`);
		if (log.maintenanceStatus === "COMPLETED") {
			throw new BadRequestException(
				"Cannot cancel a completed maintenance log",
			);
		}
		if (log.maintenanceStatus === "CANCELLED") {
			throw new BadRequestException("Maintenance log is already cancelled");
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			if (log.maintenance) await this.lockAssets(tx, [log.maintenance.assetId]);
			// Re-read after the asset lock so two requests cannot both transition
			// the same log based on the preflight status.
			const currentLog = await tx.assetMaintenanceLog.findFirst({
				where: {
					id: input.logId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
				select: { maintenanceStatus: true },
			});
			if (!currentLog) {
				throw new NotFoundException(`Maintenance log ${input.logId} not found`);
			}
			if (currentLog.maintenanceStatus === "COMPLETED") {
				throw new BadRequestException(
					"Cannot cancel a completed maintenance log",
				);
			}
			if (currentLog.maintenanceStatus === "CANCELLED") {
				throw new BadRequestException("Maintenance log is already cancelled");
			}
			const cancelledTransition = await tx.assetMaintenanceLog.updateMany({
				where: {
					id: input.logId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
				data: { maintenanceStatus: "CANCELLED" },
			});
			if (cancelledTransition.count !== 1) {
				throw new NotFoundException(`Maintenance log ${input.logId} not found`);
			}

			const taskTransition = await tx.assetMaintenanceTask.updateMany({
				where: {
					id: log.taskId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
				data: { maintenanceStatus: "CANCELLED" },
			});
			if (taskTransition.count !== 1) {
				throw new NotFoundException(`Maintenance task ${log.taskId} not found`);
			}
			if (log.maintenance) {
				await this.syncMaintenanceAssetStatus(
					tx,
					log.maintenance.assetId,
					organizationId,
				);
			}
			if (actorId && log.maintenance) {
				await tx.assetActivity.create({
					data: {
						assetId: log.maintenance.assetId,
						userId: actorId,
						activity: "Asset maintenance log cancelled",
					},
				});
			}

			return tx.assetMaintenanceLog.findFirstOrThrow({
				where: {
					id: input.logId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
			});
		});

		return toAssetMaintenanceLog(updated);
	}

	async createAssetMaintenance(
		input: Asset.CreateAssetMaintenanceInput,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetMaintenanceRecord> {
		this.assertOrganizationScope(organizationId);
		// Verify asset exists and is not already assigned to a maintenance record
		const asset = await this.prisma.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: input.assetId }),
			select: {
				id: true,
				assetName: true,
				itemCode: true,
				companyId: true,
				company: { select: { name: true } },
				maintenance: { select: { id: true } },
			},
		});
		if (!asset) throw new NotFoundException(`Asset ${input.assetId} not found`);
		if (asset.companyId !== input.companyId) {
			throw new BadRequestException(
				`Maintenance company must match asset company ${asset.company.name}.`,
			);
		}
		if (asset.maintenance) {
			throw new BadRequestException(
				`Asset "${asset.assetName}" already has a maintenance record`,
			);
		}

		// Verify team exists
		const team = await this.prisma.assetMaintenanceTeam.findFirst({
			where: {
				id: input.maintenanceTeamId,
				company: { is: { organizationId } },
			},
			select: {
				id: true,
				companyId: true,
				company: { select: { name: true } },
			},
		});
		if (!team) {
			throw new NotFoundException(
				`Maintenance team ${input.maintenanceTeamId} not found`,
			);
		}
		if (team.companyId !== asset.companyId) {
			throw new BadRequestException(
				`Maintenance team company ${team.company.name} does not match asset company ${asset.company.name}.`,
			);
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Validate tasks
		for (const task of input.tasks) {
			if (task.endDate && task.startDate >= task.endDate) {
				throw new BadRequestException(
					`Start date must be before end date for task "${task.maintenanceTask}"`,
				);
			}
		}

		const maintenance = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [input.assetId]);
			await this.lockMaintenanceTeams(tx, [input.maintenanceTeamId]);
			// Re-read the asset after taking its advisory lock. Company and
			// maintenance ownership must come from this locked snapshot rather
			// than from the preflight read above.
			const lockedAsset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, { id: input.assetId }),
				select: {
					id: true,
					assetName: true,
					companyId: true,
					company: { select: { name: true } },
					maintenance: { select: { id: true } },
				},
			});
			if (!lockedAsset) {
				throw new NotFoundException(`Asset ${input.assetId} not found`);
			}
			if (lockedAsset.companyId !== input.companyId) {
				throw new BadRequestException(
					`Maintenance company must match asset company ${lockedAsset.company.name}.`,
				);
			}
			if (lockedAsset.maintenance) {
				throw new BadRequestException(
					`Asset "${lockedAsset.assetName}" already has a maintenance record`,
				);
			}
			const lockedTeam = await tx.assetMaintenanceTeam.findFirst({
				where: {
					id: input.maintenanceTeamId,
					company: { is: { organizationId } },
				},
				select: {
					id: true,
					companyId: true,
					company: { select: { name: true } },
				},
			});
			if (!lockedTeam) {
				throw new NotFoundException(
					`Maintenance team ${input.maintenanceTeamId} not found`,
				);
			}
			if (lockedTeam.companyId !== lockedAsset.companyId) {
				throw new BadRequestException(
					`Maintenance team company ${lockedTeam.company.name} does not match asset company ${lockedAsset.company.name}.`,
				);
			}
			const created = await tx.assetMaintenance.create({
				data: {
					assetId: input.assetId,
					companyId: lockedAsset.companyId,
					maintenanceTeamId: input.maintenanceTeamId,
					maintenanceManager: input.maintenanceManager ?? null,
					maintenanceManagerName: input.maintenanceManagerName ?? null,
				},
			});

			for (const taskInput of input.tasks) {
				const nextDueDate =
					taskInput.nextDueDate ??
					this.calculateNextDueDate(
						taskInput.periodicity,
						taskInput.startDate,
						taskInput.endDate ?? null,
						taskInput.lastCompletionDate ?? null,
					);

				const isOverdue = nextDueDate && nextDueDate < today;
				const status =
					taskInput.maintenanceStatus === "CANCELLED"
						? "CANCELLED"
						: isOverdue
							? "OVERDUE"
							: taskInput.maintenanceStatus;

				const task = await tx.assetMaintenanceTask.create({
					data: {
						maintenanceId: created.id,
						maintenanceTask: taskInput.maintenanceTask,
						maintenanceType: taskInput.maintenanceType ?? null,
						maintenanceStatus: status,
						startDate: taskInput.startDate,
						periodicity: taskInput.periodicity,
						endDate: taskInput.endDate ?? null,
						certificateRequired: taskInput.certificateRequired ?? false,
						assignTo: taskInput.assignTo ?? null,
						assignToName: taskInput.assignToName ?? null,
						nextDueDate: nextDueDate ?? null,
						lastCompletionDate: taskInput.lastCompletionDate ?? null,
						description: taskInput.description ?? null,
					},
				});

				// Create initial maintenance log for this task
				await tx.assetMaintenanceLog.create({
					data: {
						maintenanceId: created.id,
						taskId: task.id,
						maintenanceStatus:
							status === "CANCELLED"
								? "CANCELLED"
								: isOverdue
									? "OVERDUE"
									: "PLANNED",
					},
				});
			}
			await this.syncMaintenanceAssetStatus(tx, input.assetId, organizationId);
			if (actorId) {
				await tx.assetActivity.create({
					data: {
						assetId: input.assetId,
						userId: actorId,
						activity: "Asset maintenance plan created",
					},
				});
			}

			return tx.assetMaintenance.findFirstOrThrow({
				where: {
					id: created.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.maintenanceInclude,
			});
		});

		this.logger.log(`Created asset maintenance for asset ${input.assetId}`);
		return toAssetMaintenance(maintenance);
	}

	async updateAssetMaintenance(
		input: Asset.UpdateAssetMaintenanceInput,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetMaintenanceRecord> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.assetMaintenance.findFirst({
			where: {
				id: input.id,
				company: { is: { organizationId } },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: {
				id: true,
				assetId: true,
				companyId: true,
				company: { select: { name: true } },
				maintenanceTeamId: true,
				maintenanceTeam: {
					select: { companyId: true, company: { select: { name: true } } },
				},
			},
		});
		if (!existing) {
			throw new NotFoundException(`Asset maintenance ${input.id} not found`);
		}

		const asset = await this.prisma.asset.findFirst({
			where: assetWhereForOrganization(organizationId, {
				id: existing.assetId,
			}),
			select: { companyId: true, company: { select: { name: true } } },
		});
		if (!asset)
			throw new NotFoundException(`Asset ${existing.assetId} not found`);
		if (input.companyId !== undefined && input.companyId !== asset.companyId) {
			throw new BadRequestException(
				`Maintenance company must match asset company ${asset.company.name}.`,
			);
		}
		if (existing.companyId !== asset.companyId) {
			throw new BadRequestException(
				`Maintenance company must match asset company ${asset.company.name}.`,
			);
		}
		if (existing.maintenanceTeam.companyId !== asset.companyId) {
			throw new BadRequestException(
				`Maintenance team company ${existing.maintenanceTeam.company.name} does not match asset company ${asset.company.name}.`,
			);
		}

		if (input.maintenanceTeamId !== undefined) {
			const team = await this.prisma.assetMaintenanceTeam.findFirst({
				where: {
					id: input.maintenanceTeamId,
					company: { is: { organizationId } },
				},
				select: {
					id: true,
					companyId: true,
					company: { select: { name: true } },
				},
			});
			if (!team) {
				throw new NotFoundException(
					`Maintenance team ${input.maintenanceTeamId} not found`,
				);
			}
			if (team.companyId !== asset.companyId) {
				throw new BadRequestException(
					`Maintenance team company ${team.company.name} does not match asset company ${asset.company.name}.`,
				);
			}
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (input.tasks) {
			for (const task of input.tasks) {
				if (task.endDate && task.startDate >= task.endDate) {
					throw new BadRequestException(
						`Start date must be before end date for task "${task.maintenanceTask}"`,
					);
				}
			}
		}

		const maintenance = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [existing.assetId]);
			await this.lockMaintenanceTeams(tx, [
				input.maintenanceTeamId ?? existing.maintenanceTeamId,
			]);
			const lockedAsset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					id: existing.assetId,
				}),
				select: { companyId: true, company: { select: { name: true } } },
			});
			if (!lockedAsset) {
				throw new NotFoundException(`Asset ${existing.assetId} not found`);
			}
			if (existing.companyId !== lockedAsset.companyId) {
				throw new BadRequestException(
					`Maintenance company must match asset company ${lockedAsset.company.name}.`,
				);
			}
			if (
				lockedAsset.companyId !== input.companyId &&
				input.companyId !== undefined
			) {
				throw new BadRequestException(
					`Maintenance company must match asset company ${lockedAsset.company.name}.`,
				);
			}
			const lockedTeamId =
				input.maintenanceTeamId ?? existing.maintenanceTeamId;
			const lockedTeam = await tx.assetMaintenanceTeam.findFirst({
				where: {
					id: lockedTeamId,
					company: { is: { organizationId } },
				},
				select: { companyId: true, company: { select: { name: true } } },
			});
			if (!lockedTeam) {
				throw new NotFoundException(
					`Maintenance team ${lockedTeamId} not found`,
				);
			}
			if (lockedTeam.companyId !== lockedAsset.companyId) {
				throw new BadRequestException(
					`Maintenance team company ${lockedTeam.company.name} does not match asset company ${lockedAsset.company.name}.`,
				);
			}
			const maintenanceTransition = await tx.assetMaintenance.updateMany({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: {
					companyId: lockedAsset.companyId,
					...(input.maintenanceTeamId !== undefined && {
						maintenanceTeamId: input.maintenanceTeamId,
					}),
					...(input.maintenanceManager !== undefined && {
						maintenanceManager: input.maintenanceManager,
					}),
					...(input.maintenanceManagerName !== undefined && {
						maintenanceManagerName: input.maintenanceManagerName,
					}),
				},
			});
			if (maintenanceTransition.count !== 1) {
				throw new NotFoundException(`Asset maintenance ${input.id} not found`);
			}

			if (input.tasks !== undefined) {
				const keptIds = input.tasks
					.filter((t): t is typeof t & { id: string } => Boolean(t.id))
					.map((t) => t.id);

				// Verify kept task IDs belong to this maintenance record
				if (keptIds.length > 0) {
					const ownedTasks = await tx.assetMaintenanceTask.findMany({
						where: {
							id: { in: keptIds },
							maintenanceId: input.id,
							maintenance: {
								is: {
									company: { is: { organizationId } },
									asset: { is: assetWhereForOrganization(organizationId) },
								},
							},
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedTasks.map((t) => t.id));
					const foreignId = keptIds.find((tid) => !ownedIds.has(tid));
					if (foreignId) {
						throw new BadRequestException(
							`Task with ID ${foreignId} does not belong to this maintenance record`,
						);
					}
				}

				// Identify removed tasks and cancel their open logs
				const removedTasks =
					keptIds.length === 0
						? await tx.assetMaintenanceTask.findMany({
								where: {
									maintenanceId: input.id,
									maintenance: {
										is: {
											company: { is: { organizationId } },
											asset: { is: assetWhereForOrganization(organizationId) },
										},
									},
								},
								select: { id: true },
							})
						: await tx.assetMaintenanceTask.findMany({
								where: {
									maintenanceId: input.id,
									id: { notIn: keptIds },
									maintenance: {
										is: {
											company: { is: { organizationId } },
											asset: { is: assetWhereForOrganization(organizationId) },
										},
									},
								},
								select: { id: true },
							});

				for (const rt of removedTasks) {
					await tx.assetMaintenanceLog.updateMany({
						where: {
							taskId: rt.id,
							maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
							maintenance: {
								is: {
									id: input.id,
									company: { is: { organizationId } },
									asset: { is: assetWhereForOrganization(organizationId) },
								},
							},
						},
						data: { maintenanceStatus: "CANCELLED" },
					});
				}

				if (keptIds.length === 0) {
					await tx.assetMaintenanceTask.deleteMany({
						where: {
							maintenanceId: input.id,
							maintenance: {
								is: {
									company: { is: { organizationId } },
									asset: { is: assetWhereForOrganization(organizationId) },
								},
							},
						},
					});
				} else {
					await tx.assetMaintenanceTask.deleteMany({
						where: {
							maintenanceId: input.id,
							id: { notIn: keptIds },
							maintenance: {
								is: {
									company: { is: { organizationId } },
									asset: { is: assetWhereForOrganization(organizationId) },
								},
							},
						},
					});
				}

				for (const taskInput of input.tasks) {
					const nextDueDate =
						taskInput.nextDueDate ??
						this.calculateNextDueDate(
							taskInput.periodicity,
							taskInput.startDate,
							taskInput.endDate ?? null,
							taskInput.lastCompletionDate ?? null,
						);

					const isOverdue = nextDueDate && nextDueDate < today;
					const status =
						taskInput.maintenanceStatus === "CANCELLED"
							? "CANCELLED"
							: isOverdue
								? "OVERDUE"
								: taskInput.maintenanceStatus;

					if (taskInput.id) {
						// Update existing task
						const taskTransition = await tx.assetMaintenanceTask.updateMany({
							where: {
								id: taskInput.id,
								maintenance: {
									is: {
										id: input.id,
										company: { is: { organizationId } },
										asset: { is: assetWhereForOrganization(organizationId) },
									},
								},
							},
							data: {
								maintenanceTask: taskInput.maintenanceTask,
								maintenanceType: taskInput.maintenanceType ?? null,
								maintenanceStatus: status,
								startDate: taskInput.startDate,
								periodicity: taskInput.periodicity,
								endDate: taskInput.endDate ?? null,
								certificateRequired: taskInput.certificateRequired ?? false,
								assignTo: taskInput.assignTo ?? null,
								assignToName: taskInput.assignToName ?? null,
								nextDueDate: nextDueDate ?? null,
								lastCompletionDate: taskInput.lastCompletionDate ?? null,
								description: taskInput.description ?? null,
							},
						});
						if (taskTransition.count !== 1) {
							throw new NotFoundException(
								`Task with ID ${taskInput.id} does not belong to this maintenance record`,
							);
						}

						// Ensure there is an open log for this task; create if missing
						const openLog = await tx.assetMaintenanceLog.findFirst({
							where: {
								taskId: taskInput.id,
								maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
								maintenance: {
									is: {
										id: input.id,
										company: { is: { organizationId } },
										asset: { is: assetWhereForOrganization(organizationId) },
									},
								},
							},
						});
						if (!openLog) {
							await tx.assetMaintenanceLog.create({
								data: {
									maintenanceId: input.id,
									taskId: taskInput.id,
									maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED",
								},
							});
						} else {
							const logTransition = await tx.assetMaintenanceLog.updateMany({
								where: {
									id: openLog.id,
									maintenance: {
										is: {
											id: input.id,
											company: { is: { organizationId } },
											asset: { is: assetWhereForOrganization(organizationId) },
										},
									},
								},
								data: {
									maintenanceStatus:
										status === "CANCELLED"
											? "CANCELLED"
											: isOverdue
												? "OVERDUE"
												: "PLANNED",
								},
							});
							if (logTransition.count !== 1) {
								throw new NotFoundException(
									`Maintenance log ${openLog.id} not found`,
								);
							}
						}
					} else {
						// Create new task
						const newTask = await tx.assetMaintenanceTask.create({
							data: {
								maintenanceId: input.id,
								maintenanceTask: taskInput.maintenanceTask,
								maintenanceType: taskInput.maintenanceType ?? null,
								maintenanceStatus: status,
								startDate: taskInput.startDate,
								periodicity: taskInput.periodicity,
								endDate: taskInput.endDate ?? null,
								certificateRequired: taskInput.certificateRequired ?? false,
								assignTo: taskInput.assignTo ?? null,
								assignToName: taskInput.assignToName ?? null,
								nextDueDate: nextDueDate ?? null,
								lastCompletionDate: taskInput.lastCompletionDate ?? null,
								description: taskInput.description ?? null,
							},
						});

						await tx.assetMaintenanceLog.create({
							data: {
								maintenanceId: input.id,
								taskId: newTask.id,
								maintenanceStatus:
									status === "CANCELLED"
										? "CANCELLED"
										: isOverdue
											? "OVERDUE"
											: "PLANNED",
							},
						});
					}
				}
			}
			await this.syncMaintenanceAssetStatus(
				tx,
				existing.assetId,
				organizationId,
			);
			if (actorId) {
				await tx.assetActivity.create({
					data: {
						assetId: existing.assetId,
						userId: actorId,
						activity: "Asset maintenance plan updated",
					},
				});
			}

			return tx.assetMaintenance.findFirstOrThrow({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.maintenanceInclude,
			});
		});

		return toAssetMaintenance(maintenance);
	}

	async deleteAssetMaintenance(
		id: string,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<{ success: boolean; id: string }> {
		this.assertOrganizationScope(organizationId);
		const existing = await this.prisma.assetMaintenance.findFirst({
			where: {
				id,
				company: { is: { organizationId } },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: { id: true, assetId: true },
		});
		if (!existing) {
			throw new NotFoundException(`Asset maintenance ${id} not found`);
		}
		await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [existing.assetId]);
			const deleted = await tx.assetMaintenance.deleteMany({
				where: {
					id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			});
			if (deleted.count !== 1) {
				throw new NotFoundException(`Asset maintenance ${id} not found`);
			}
			await this.syncMaintenanceAssetStatus(
				tx,
				existing.assetId,
				organizationId,
			);
			if (actorId) {
				await tx.assetActivity.create({
					data: {
						assetId: existing.assetId,
						userId: actorId,
						activity: "Asset maintenance plan deleted",
					},
				});
			}
		});
		return { success: true, id };
	}

	async deleteManyAssetMaintenances(
		ids: string[],
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		this.assertOrganizationScope(organizationId);
		const unique = [...new Set(ids)];
		const existing = await this.prisma.assetMaintenance.findMany({
			where: {
				id: { in: unique },
				company: { is: { organizationId } },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: { id: true, assetId: true },
		});
		const lockedRecords = [...existing].sort((a, b) =>
			a.assetId.localeCompare(b.assetId),
		);
		if (lockedRecords.length !== unique.length) {
			throw new NotFoundException(
				"One or more maintenance records are not available in the active organization",
			);
		}
		const result = await this.prisma.$transaction(async (tx) => {
			for (const record of lockedRecords)
				await this.lockAssets(tx, [record.assetId]);
			const deleted = await tx.assetMaintenance.deleteMany({
				where: {
					id: { in: unique },
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			});
			for (const record of lockedRecords) {
				await this.syncMaintenanceAssetStatus(
					tx,
					record.assetId,
					organizationId,
				);
				if (actorId) {
					await tx.assetActivity.create({
						data: {
							assetId: record.assetId,
							userId: actorId,
							activity: "Asset maintenance plan deleted",
						},
					});
				}
			}
			return deleted;
		});
		return { success: true, count: result.count, ids: unique };
	}

	async completeAssetMaintenanceLog(
		input: Asset.CompleteAssetMaintenanceLogInput,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetMaintenanceLogItem> {
		this.assertOrganizationScope(organizationId);
		const log = await this.prisma.assetMaintenanceLog.findFirst({
			where: {
				id: input.logId,
				maintenance: {
					is: {
						company: { is: { organizationId } },
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				},
			},
			select: {
				id: true,
				maintenanceId: true,
				taskId: true,
				maintenanceStatus: true,
				maintenance: { select: { assetId: true } },
			},
		});
		if (!log)
			throw new NotFoundException(`Maintenance log ${input.logId} not found`);
		if (log.maintenanceStatus === "COMPLETED") {
			throw new BadRequestException("Maintenance log is already completed");
		}
		if (log.maintenanceStatus === "CANCELLED") {
			throw new BadRequestException(
				"Cannot complete a cancelled maintenance log",
			);
		}

		const updatedLog = await this.prisma.$transaction(async (tx) => {
			if (log.maintenance) await this.lockAssets(tx, [log.maintenance.assetId]);
			// Re-read after the asset lock to make completion exactly-once when
			// duplicate requests arrive concurrently.
			const currentLog = await tx.assetMaintenanceLog.findFirst({
				where: {
					id: input.logId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
				select: {
					maintenanceId: true,
					taskId: true,
					maintenanceStatus: true,
				},
			});
			if (!currentLog) {
				throw new NotFoundException(`Maintenance log ${input.logId} not found`);
			}
			if (currentLog.maintenanceStatus === "COMPLETED") {
				throw new BadRequestException("Maintenance log is already completed");
			}
			if (currentLog.maintenanceStatus === "CANCELLED") {
				throw new BadRequestException(
					"Cannot complete a cancelled maintenance log",
				);
			}
			// Mark log as completed
			const completedTransition = await tx.assetMaintenanceLog.updateMany({
				where: {
					id: input.logId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
				data: {
					maintenanceStatus: "COMPLETED",
					completionDate: input.completionDate,
					actionsPerformed: input.actionsPerformed ?? null,
					hasCertificate: input.hasCertificate ?? false,
					certificateAttachment: input.certificateAttachment ?? null,
				},
			});
			if (completedTransition.count !== 1) {
				throw new NotFoundException(`Maintenance log ${input.logId} not found`);
			}

			// Update task's lastCompletionDate and recalculate nextDueDate
			const task = await tx.assetMaintenanceTask.findFirstOrThrow({
				where: {
					id: currentLog.taskId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
			});
			if (task.maintenanceStatus === "CANCELLED") {
				throw new ConflictException(
					"Cannot complete a maintenance log whose task is cancelled",
				);
			}

			const newNextDueDate = this.calculateNextDueDate(
				task.periodicity as Asset.AssetMaintenancePeriodicity,
				task.startDate,
				task.endDate ?? null,
				input.completionDate,
			);

			const taskTransition = await tx.assetMaintenanceTask.updateMany({
				where: {
					id: currentLog.taskId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
				data: {
					lastCompletionDate: input.completionDate,
					nextDueDate: newNextDueDate ?? null,
					maintenanceStatus: newNextDueDate ? "PLANNED" : "CANCELLED",
				},
			});
			if (taskTransition.count !== 1) {
				throw new NotFoundException(
					`Maintenance task ${currentLog.taskId} not found`,
				);
			}

			// Create next open log if there is a next due date
			if (newNextDueDate) {
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				await tx.assetMaintenanceLog.create({
					data: {
						maintenanceId: currentLog.maintenanceId,
						taskId: currentLog.taskId,
						maintenanceStatus: newNextDueDate < today ? "OVERDUE" : "PLANNED",
					},
				});
			}
			if (log.maintenance) {
				await this.syncMaintenanceAssetStatus(
					tx,
					log.maintenance.assetId,
					organizationId,
				);
			}
			if (actorId && log.maintenance) {
				await tx.assetActivity.create({
					data: {
						assetId: log.maintenance.assetId,
						userId: actorId,
						activity: "Asset maintenance log completed",
					},
				});
			}

			return tx.assetMaintenanceLog.findFirstOrThrow({
				where: {
					id: input.logId,
					maintenance: {
						is: {
							company: { is: { organizationId } },
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
				},
			});
		});

		return toAssetMaintenanceLog(updatedLog);
	}

	// ============================================================================
	// Phase 2 Lifecycle Workflows & Document Management
	// ============================================================================

	/**
	 * Scraps an asset, transitioning its status to SCRAPPED and generating an AssetDisposal record.
	 *
	 * @param input Scrap asset parameters including assetId, disposalDate, and optional notes
	 * @returns The created AssetDisposal domain object
	 */
	async scrapAsset(
		input: Asset.ScrapAssetInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetDisposal> {
		this.assertOrganizationScope(organizationId);
		return this.postAssetDisposal({
			assetId: input.assetId,
			organizationId,
			disposalDate: input.disposalDate,
			disposalType: "SCRAP",
			salesAmount: 0,
			gainLossAccount: input.gainLossAccount,
			costCenter: input.costCenter,
			notes: input.notes,
			actorId,
		});
	}

	/**
	 * Sells an asset, transitioning its status to SOLD and generating an AssetDisposal record.
	 *
	 * @param input Sell asset parameters including assetId, disposalDate, salesAmount, and optional notes
	 * @returns The created AssetDisposal domain object
	 */
	async sellAsset(
		input: Asset.SellAssetInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetDisposal> {
		this.assertOrganizationScope(organizationId);
		return this.postAssetDisposal({
			assetId: input.assetId,
			organizationId,
			disposalDate: input.disposalDate,
			disposalType: "SELL",
			salesAmount: input.salesAmount,
			proceedsAccount: input.proceedsAccount,
			gainLossAccount: input.gainLossAccount,
			costCenter: input.costCenter,
			notes: input.notes,
			actorId,
		});
	}

	private async postAssetDisposal(input: {
		assetId: string;
		organizationId: AssetOrganizationId;
		disposalDate: Date;
		disposalType: "SCRAP" | "SELL";
		salesAmount: number;
		proceedsAccount?: string | null;
		gainLossAccount: string;
		costCenter?: string | null;
		notes?: string | null;
		actorId?: string;
	}): Promise<Asset.AssetDisposal> {
		this.assertOrganizationScope(input.organizationId);
		this.assertValidOperationalDate(input.disposalDate, "Disposal date");
		await this.depreciationBarrier?.ensureDepreciationPosted({
			kind: "organization",
			organizationId: input.organizationId,
			throughDate: input.disposalDate,
			assetIds: [input.assetId],
		});

		const disposal = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [input.assetId]);
			const asset = await tx.asset.findFirst({
				where: assetWhereForOrganization(input.organizationId, {
					id: input.assetId,
				}),
				select: {
					id: true,
					series: true,
					companyId: true,
					company: { select: { name: true } },
					assetCategoryId: true,
					purchaseDate: true,
					availableForUseDate: true,
					status: true,
					netPurchaseAmount: true,
					valueAfterDepreciation: true,
					isFullyDepreciated: true,
				},
			});
			if (!asset) {
				throw new NotFoundException(
					`Asset with ID ${input.assetId} not found.`,
				);
			}
			if (
				asset.status !== "SUBMITTED" &&
				asset.status !== "PARTIALLY_DEPRECIATED" &&
				asset.status !== "FULLY_DEPRECIATED"
			) {
				throw new BadRequestException(
					`Asset ${asset.series} cannot be disposed because its status is ${asset.status}.`,
				);
			}
			const firstOperationalDate =
				asset.availableForUseDate ?? asset.purchaseDate;
			if (dateOnlyUtc(input.disposalDate) < dateOnlyUtc(firstOperationalDate)) {
				throw new BadRequestException(
					"Disposal date cannot be before the asset's purchase or available-for-use date.",
				);
			}
			const laterDepreciation = await tx.assetDepreciationJournalEntry.count({
				where: {
					assetId: asset.id,
					status: "POSTED",
					postingDate: { gt: input.disposalDate },
					asset: { is: assetWhereForOrganization(input.organizationId) },
				},
			});
			if (laterDepreciation > 0) {
				throw new BadRequestException(
					"Asset cannot be disposed before its latest posted depreciation.",
				);
			}

			const context = await this.getAssetAccountingContext(
				tx,
				input.organizationId,
				asset,
				input.costCenter,
			);
			const carryingValue = this.roundCurrency(
				Number(asset.valueAfterDepreciation),
			);
			const fixedAssetBalance = await this.getFixedAssetBalance(
				tx,
				input.organizationId,
				asset.id,
				Number(asset.netPurchaseAmount),
			);
			const accumulatedDepreciation = this.roundCurrency(
				fixedAssetBalance - carryingValue,
			);
			if (carryingValue < 0 || accumulatedDepreciation < 0) {
				throw new BadRequestException(
					`Asset ${asset.series} has an inconsistent carrying value and cannot be disposed.`,
				);
			}
			if (
				accumulatedDepreciation > 0 &&
				!context.accumulatedDepreciationAccount
			) {
				throw new BadRequestException(
					`An accumulated depreciation account is required for asset ${asset.series}.`,
				);
			}
			const salesAmount = this.roundCurrency(input.salesAmount);
			const gainLossAmount = this.roundCurrency(salesAmount - carryingValue);
			const series = await this.generateAssetDisposalSeries(
				input.disposalDate,
				input.organizationId,
				tx,
			);
			let created = await tx.assetDisposal.create({
				data: {
					series,
					assetId: asset.id,
					companyId: asset.companyId,
					disposalDate: input.disposalDate,
					disposalType: input.disposalType,
					salesAmount,
					gainLossAmount,
					fixedAssetAccount: context.fixedAssetAccount,
					accumulatedDepreciationAccount:
						context.accumulatedDepreciationAccount,
					proceedsAccount: input.proceedsAccount?.trim() || null,
					gainLossAccount: input.gainLossAccount.trim(),
					costCenter: context.costCenter,
					previousAssetStatus: asset.status,
					previousIsFullyDepreciated: asset.isFullyDepreciated,
					status: "POSTED",
					notes: input.notes ?? null,
				},
				include: this.assetDisposalInclude,
			});

			const lines = [
				...(fixedAssetBalance > 0
					? [
							{
								account: context.fixedAssetAccount,
								debitAmount: 0,
								creditAmount: fixedAssetBalance,
								costCenter: context.costCenter,
							},
						]
					: []),
				...(accumulatedDepreciation > 0
					? [
							{
								account: context.accumulatedDepreciationAccount as string,
								debitAmount: accumulatedDepreciation,
								creditAmount: 0,
								costCenter: context.costCenter,
							},
						]
					: []),
				...(salesAmount > 0
					? [
							{
								account: input.proceedsAccount as string,
								debitAmount: salesAmount,
								creditAmount: 0,
								costCenter: context.costCenter,
							},
						]
					: []),
				...(gainLossAmount !== 0
					? [
							{
								account: input.gainLossAccount,
								debitAmount: gainLossAmount < 0 ? -gainLossAmount : 0,
								creditAmount: gainLossAmount > 0 ? gainLossAmount : 0,
								costCenter: context.costCenter,
							},
						]
					: []),
			];
			if (lines.length >= 2) {
				const entry = await this.accounting.createPostedEntry(
					tx,
					input.organizationId,
					{
						companyId: asset.companyId,
						assetId: asset.id,
						sourceType: "DISPOSAL",
						sourceId: created.id,
						postingDate: input.disposalDate,
						remarks: `Asset ${asset.series} ${input.disposalType === "SELL" ? "sold" : "scrapped"} via ${series}`,
						lines,
					},
				);
				const linkedDisposal = await tx.assetDisposal.updateMany({
					where: {
						id: created.id,
						company: { is: { organizationId: input.organizationId } },
						asset: { is: assetWhereForOrganization(input.organizationId) },
					},
					data: { accountingEntryId: entry.id },
				});
				if (linkedDisposal.count !== 1) {
					throw new NotFoundException(`Disposal ${created.id} not found`);
				}
				created = await tx.assetDisposal.findFirstOrThrow({
					where: {
						id: created.id,
						company: { is: { organizationId: input.organizationId } },
						asset: { is: assetWhereForOrganization(input.organizationId) },
					},
					include: this.assetDisposalInclude,
				});
			}

			await this.depreciationRevision.closeOpenSchedules(
				tx,
				input.organizationId,
				asset.id,
			);
			await this.updateOwnedAsset(tx, input.organizationId, asset.id, {
				status: input.disposalType === "SELL" ? "SOLD" : "SCRAPPED",
				disposalDate: input.disposalDate,
			});
			await tx.assetActivity.create({
				data: {
					assetId: asset.id,
					userId: input.actorId ?? null,
					activity: `Asset ${input.disposalType === "SELL" ? "sold" : "scrapped"} via disposal ${series}${created.accountingEntry?.series ? ` and accounting entry ${created.accountingEntry.series}` : ""}`,
				},
			});
			return created;
		});

		return toAssetDisposalItem(disposal);
	}

	/**
	 * Restores a scrapped or sold asset back to an active operational status.
	 *
	 * @param input Restore asset parameters containing assetId
	 * @returns The restored AssetItem domain object
	 */
	async restoreAsset(
		input: Asset.RestoreAssetInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetItem> {
		this.assertOrganizationScope(organizationId);
		const updatedAsset = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [input.assetId]);
			const asset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					id: input.assetId,
				}),
				include: this.assetInclude,
			});
			if (!asset) {
				throw new NotFoundException(
					`Asset with ID ${input.assetId} not found.`,
				);
			}
			if (asset.status !== "SCRAPPED" && asset.status !== "SOLD") {
				throw new BadRequestException(
					`Asset ${asset.series} is not scrapped or sold (current status: ${asset.status}).`,
				);
			}
			const disposal = await tx.assetDisposal.findFirst({
				where: {
					assetId: asset.id,
					status: "POSTED",
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					series: true,
					createdAt: true,
					disposalDate: true,
					accountingEntryId: true,
					previousAssetStatus: true,
					previousIsFullyDepreciated: true,
				},
			});
			if (!disposal) {
				throw new BadRequestException(
					`The posted disposal for asset ${asset.series} is missing.`,
				);
			}
			const [laterDepreciation, laterAccounting] = await Promise.all([
				tx.assetDepreciationJournalEntry.count({
					where: {
						assetId: asset.id,
						status: "POSTED",
						createdAt: { gt: disposal.createdAt },
					},
				}),
				tx.assetAccountingEntry.count({
					where: {
						assetId: asset.id,
						status: "POSTED",
						createdAt: { gt: disposal.createdAt },
						...(disposal.accountingEntryId
							? { id: { not: disposal.accountingEntryId } }
							: {}),
					},
				}),
			]);
			if (laterDepreciation > 0 || laterAccounting > 0) {
				throw new ConflictException(
					"The disposal cannot be restored after later depreciation or asset accounting has been posted.",
				);
			}
			if (disposal.accountingEntryId) {
				await this.accounting.reversePostedEntry(
					tx,
					organizationId,
					disposal.accountingEntryId,
				);
			}
			await this.depreciationRevision.reactivateLatestClosedSchedules(
				tx,
				organizationId,
				asset.id,
			);
			const cancelledDisposal = await tx.assetDisposal.updateMany({
				where: {
					id: disposal.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "CANCELLED" },
			});
			if (cancelledDisposal.count !== 1) {
				throw new NotFoundException(`Disposal ${disposal.id} not found`);
			}
			const restoredStatus =
				disposal.previousAssetStatus ??
				(asset.isFullyDepreciated
					? "FULLY_DEPRECIATED"
					: Number(asset.valueAfterDepreciation) <
							Number(asset.netPurchaseAmount)
						? "PARTIALLY_DEPRECIATED"
						: "SUBMITTED");
			await this.updateOwnedAsset(tx, organizationId, asset.id, {
				status: restoredStatus,
				isFullyDepreciated:
					disposal.previousIsFullyDepreciated ?? asset.isFullyDepreciated,
				disposalDate: null,
			});
			const updated = await tx.asset.findFirstOrThrow({
				where: assetWhereForOrganization(organizationId, { id: asset.id }),
				include: this.assetInclude,
			});

			await tx.assetActivity.create({
				data: {
					assetId: asset.id,
					userId: actorId ?? null,
					activity: `Disposal ${disposal.series} reversed; asset restored to ${restoredStatus}`,
				},
			});

			return updated;
		});

		return toAsset(updatedAsset);
	}

	/**
	 * Creates a new draft AssetMovement record.
	 *
	 * @param input CreateAssetMovementInput containing company, transactionDate, purpose, notes, and items
	 * @returns The created AssetMovement domain object
	 */
	async createAssetMovement(
		input: Asset.CreateAssetMovementInput,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetMovement> {
		this.assertOrganizationScope(organizationId);
		await this.resolveCompanyForOrganization(organizationId, input.companyId);
		const assetIds = input.items.map((item) => item.assetId);
		if (new Set(assetIds).size !== assetIds.length) {
			throw new BadRequestException(
				"An asset can appear only once in an asset movement.",
			);
		}

		const movement = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, assetIds);
			const resolvedItems: Array<{
				assetId: string;
				sourceLocationId: string | null;
				targetLocationId: string | null;
				fromEmployee: string | null;
				toEmployee: string | null;
			}> = [];

			for (const item of input.items) {
				const asset = await tx.asset.findFirst({
					where: assetWhereForOrganization(organizationId, {
						id: item.assetId,
					}),
					select: {
						id: true,
						series: true,
						companyId: true,
						company: { select: { name: true } },
						status: true,
						locationId: true,
						custodian: true,
					},
				});
				if (!asset) {
					throw new NotFoundException(
						`Asset with ID ${item.assetId} not found.`,
					);
				}
				if (asset.companyId !== input.companyId) {
					throw new BadRequestException(
						`Asset ${asset.series} does not belong to company ${input.companyId}.`,
					);
				}
				if (
					asset.status === "DRAFT" ||
					asset.status === "CANCELLED" ||
					asset.status === "SCRAPPED" ||
					asset.status === "SOLD" ||
					asset.status === "CAPITALIZED"
				) {
					throw new BadRequestException(
						`Asset ${asset.series} cannot be moved because its status is ${asset.status}.`,
					);
				}

				const previousMovement = await tx.assetMovement.findFirst({
					where: {
						companyId: input.companyId,
						company: { is: { organizationId } },
						status: "SUBMITTED",
						items: {
							some: {
								assetId: asset.id,
								asset: { is: assetWhereForOrganization(organizationId) },
							},
						},
					},
					select: { transactionDate: true },
					orderBy: [{ transactionDate: "desc" }, { submittedAt: "desc" }],
				});
				if (
					previousMovement &&
					input.transactionDate < previousMovement.transactionDate
				) {
					throw new BadRequestException(
						"Transaction date cannot be earlier than the latest submitted movement for this asset.",
					);
				}

				const sourceLocationId = asset.locationId;
				const fromEmployee = asset.custodian;
				if (
					item.sourceLocationId != null &&
					item.sourceLocationId !== sourceLocationId
				) {
					throw new BadRequestException(
						`Asset ${asset.series} is not at the supplied source location.`,
					);
				}
				if (item.fromEmployee != null && item.fromEmployee !== fromEmployee) {
					throw new BadRequestException(
						`Asset ${asset.series} is not held by the supplied custodian.`,
					);
				}

				const targetLocationId = item.targetLocationId ?? null;
				const toEmployee = item.toEmployee ?? null;
				if (
					(input.purpose === "TRANSFER" ||
						input.purpose === "RECEIPT" ||
						input.purpose === "TRANSFER_AND_ISSUE") &&
					!targetLocationId
				) {
					throw new BadRequestException(
						`Target location is required for ${input.purpose.toLowerCase().replaceAll("_", " ")}.`,
					);
				}
				if (
					(input.purpose === "TRANSFER" ||
						input.purpose === "TRANSFER_AND_ISSUE") &&
					targetLocationId === sourceLocationId
				) {
					throw new BadRequestException(
						"Source and target locations cannot be the same.",
					);
				}
				if (
					(input.purpose === "ISSUE" ||
						input.purpose === "TRANSFER_AND_ISSUE") &&
					!toEmployee
				) {
					throw new BadRequestException(
						`Target employee is required for ${input.purpose.toLowerCase().replaceAll("_", " ")}.`,
					);
				}
				if (input.purpose === "TRANSFER_AND_ISSUE" && !fromEmployee) {
					throw new BadRequestException(
						"Source employee is required for transfer and issue.",
					);
				}
				if (targetLocationId) {
					const target = await tx.location.findUnique({
						where: { id: targetLocationId },
						select: { id: true },
					});
					if (!target) {
						throw new NotFoundException(
							`Target location ${targetLocationId} not found.`,
						);
					}
				}

				resolvedItems.push({
					assetId: asset.id,
					sourceLocationId,
					targetLocationId,
					fromEmployee,
					toEmployee,
				});
			}

			const series = await this.generateAssetMovementSeries(
				input.transactionDate,
				organizationId,
				tx,
			);
			const created = await tx.assetMovement.create({
				data: {
					series,
					companyId: input.companyId,
					transactionDate: input.transactionDate,
					purpose: input.purpose,
					status: "DRAFT",
					notes: input.notes ?? null,
					items: {
						create: resolvedItems.map((item) => ({
							assetId: item.assetId,
							sourceLocationId: item.sourceLocationId,
							targetLocationId: item.targetLocationId,
							fromEmployee: item.fromEmployee,
							toEmployee: item.toEmployee,
						})),
					},
				},
				include: this.assetMovementInclude,
			});
			if (actorId) {
				for (const item of resolvedItems) {
					await tx.assetActivity.create({
						data: {
							assetId: item.assetId,
							userId: actorId,
							activity: `Asset movement draft created for ${input.purpose.toLowerCase().replaceAll("_", " ")}`,
						},
					});
				}
			}
			return created;
		});

		return toAssetMovement(movement);
	}

	/**
	 * Submits an AssetMovement, updating locations and custodians on linked assets.
	 *
	 * @param input SubmitAssetMovementInput containing movement id
	 * @returns The submitted AssetMovement domain object
	 */
	async submitAssetMovement(
		input: Asset.SubmitAssetMovementInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetMovement> {
		this.assertOrganizationScope(organizationId);
		const movement = await this.prisma.assetMovement.findFirst({
			where: {
				id: input.id,
				company: { is: { organizationId } },
				items: {
					every: { asset: { is: assetWhereForOrganization(organizationId) } },
				},
			},
			include: this.assetMovementInclude,
		});
		if (!movement) {
			throw new NotFoundException(`AssetMovement ${input.id} not found.`);
		}
		if (movement.status !== "DRAFT") {
			throw new BadRequestException(
				`AssetMovement ${movement.series} cannot be submitted because status is ${movement.status}.`,
			);
		}

		const submitted = await this.prisma.$transaction(async (tx) => {
			const currentMovement = await tx.assetMovement.findFirst({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					items: {
						every: { asset: { is: assetWhereForOrganization(organizationId) } },
					},
				},
				include: this.assetMovementInclude,
			});
			if (!currentMovement) {
				throw new NotFoundException(`AssetMovement ${input.id} not found.`);
			}
			await this.lockAssets(
				tx,
				currentMovement.items.map((item) => item.assetId),
			);
			const transition = await tx.assetMovement.updateMany({
				where: {
					id: input.id,
					status: "DRAFT",
					company: { is: { organizationId } },
					items: {
						every: { asset: { is: assetWhereForOrganization(organizationId) } },
					},
				},
				data: { status: "SUBMITTED", submittedAt: new Date() },
			});
			if (transition.count !== 1) {
				throw new ConflictException(
					`AssetMovement ${currentMovement.series} was submitted by another request.`,
				);
			}
			for (const item of currentMovement.items) {
				const asset = await tx.asset.findFirst({
					where: assetWhereForOrganization(organizationId, {
						id: item.assetId,
					}),
					select: {
						companyId: true,
						company: { select: { name: true } },
						locationId: true,
						custodian: true,
						series: true,
						status: true,
					},
				});
				if (!asset) {
					throw new NotFoundException(`Asset ${item.assetId} not found.`);
				}
				if (asset.companyId !== currentMovement.companyId) {
					throw new BadRequestException(
						`Asset ${asset.series} does not belong to company ${currentMovement.company}.`,
					);
				}
				if (
					asset.status === "DRAFT" ||
					asset.status === "CANCELLED" ||
					asset.status === "SCRAPPED" ||
					asset.status === "SOLD" ||
					asset.status === "CAPITALIZED"
				) {
					throw new BadRequestException(
						`Asset ${asset.series} cannot be moved because its status is ${asset.status}.`,
					);
				}
				const latestMovement = await tx.assetMovement.findFirst({
					where: {
						companyId: currentMovement.companyId,
						company: { is: { organizationId } },
						status: "SUBMITTED",
						items: {
							some: {
								assetId: item.assetId,
								asset: { is: assetWhereForOrganization(organizationId) },
							},
						},
					},
					select: { transactionDate: true },
					orderBy: [{ transactionDate: "desc" }, { submittedAt: "desc" }],
				});
				if (
					latestMovement &&
					currentMovement.transactionDate < latestMovement.transactionDate
				) {
					throw new BadRequestException(
						"Transaction date cannot be earlier than the latest submitted movement for this asset.",
					);
				}
				if (
					asset.locationId !== item.sourceLocationId ||
					asset.custodian !== item.fromEmployee
				) {
					throw new ConflictException(
						`Asset ${asset.series} changed after movement ${currentMovement.series} was created.`,
					);
				}
				if (
					(movement.purpose === "TRANSFER" ||
						movement.purpose === "RECEIPT" ||
						movement.purpose === "TRANSFER_AND_ISSUE") &&
					!item.targetLocationId
				) {
					throw new ConflictException(
						`Asset movement ${currentMovement.series} no longer has its required target location.`,
					);
				}
				await this.updateOwnedAsset(tx, organizationId, item.assetId, {
					...(item.targetLocationId
						? { locationId: item.targetLocationId }
						: {}),
					custodian: item.toEmployee,
				});

				await tx.assetActivity.create({
					data: {
						assetId: item.assetId,
						userId: actorId ?? null,
						activity: `Asset movement ${movement.series} submitted: transferred to ${
							item.targetLocation?.name ?? "new location"
						}`,
					},
				});
			}

			return tx.assetMovement.findFirstOrThrow({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					items: {
						every: { asset: { is: assetWhereForOrganization(organizationId) } },
					},
				},
				include: this.assetMovementInclude,
			});
		});

		return toAssetMovement(submitted);
	}

	/**
	 * Cancels an AssetMovement, reverting locations and custodians on linked assets.
	 *
	 * @param input CancelAssetMovementInput containing movement id
	 * @returns The cancelled AssetMovement domain object
	 */
	async cancelAssetMovement(
		input: Asset.CancelAssetMovementInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetMovement> {
		this.assertOrganizationScope(organizationId);
		const movement = await this.prisma.assetMovement.findFirst({
			where: {
				id: input.id,
				company: { is: { organizationId } },
				items: {
					every: { asset: { is: assetWhereForOrganization(organizationId) } },
				},
			},
			include: this.assetMovementInclude,
		});
		if (!movement) {
			throw new NotFoundException(`AssetMovement ${input.id} not found.`);
		}
		if (movement.status !== "SUBMITTED") {
			throw new BadRequestException(
				`AssetMovement ${movement.series} cannot be cancelled because status is ${movement.status}.`,
			);
		}

		const cancelled = await this.prisma.$transaction(async (tx) => {
			const currentMovement = await tx.assetMovement.findFirst({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					items: {
						every: { asset: { is: assetWhereForOrganization(organizationId) } },
					},
				},
				include: this.assetMovementInclude,
			});
			if (!currentMovement) {
				throw new NotFoundException(`AssetMovement ${input.id} not found.`);
			}
			await this.lockAssets(
				tx,
				currentMovement.items.map((item) => item.assetId),
			);
			const transition = await tx.assetMovement.updateMany({
				where: {
					id: input.id,
					status: "SUBMITTED",
					company: { is: { organizationId } },
					items: {
						every: { asset: { is: assetWhereForOrganization(organizationId) } },
					},
				},
				data: { status: "CANCELLED", cancelledAt: new Date() },
			});
			if (transition.count !== 1) {
				throw new ConflictException(
					`AssetMovement ${currentMovement.series} was cancelled by another request.`,
				);
			}
			for (const item of currentMovement.items) {
				const asset = await tx.asset.findFirst({
					where: assetWhereForOrganization(organizationId, {
						id: item.assetId,
					}),
					select: {
						companyId: true,
						company: { select: { name: true } },
						series: true,
						locationId: true,
					},
				});
				if (!asset) {
					throw new NotFoundException(`Asset ${item.assetId} not found.`);
				}
				if (asset.companyId !== currentMovement.companyId) {
					throw new BadRequestException(
						`Asset ${asset.series} does not belong to company ${currentMovement.company}.`,
					);
				}
				const latest = await tx.assetMovement.findFirst({
					where: {
						companyId: currentMovement.companyId,
						company: { is: { organizationId } },
						status: "SUBMITTED",
						items: {
							some: {
								assetId: item.assetId,
								asset: { is: assetWhereForOrganization(organizationId) },
							},
						},
					},
					include: {
						items: {
							where: { assetId: item.assetId },
							select: { targetLocationId: true, toEmployee: true },
						},
					},
					orderBy: [{ transactionDate: "desc" }, { submittedAt: "desc" }],
				});
				const latestItem = latest?.items[0];
				await this.updateOwnedAsset(tx, organizationId, item.assetId, {
					locationId: latestItem
						? (latestItem.targetLocationId ?? asset.locationId)
						: item.sourceLocationId,
					custodian: latestItem ? latestItem.toEmployee : item.fromEmployee,
				});

				await tx.assetActivity.create({
					data: {
						assetId: item.assetId,
						userId: actorId ?? null,
						activity: `Asset movement ${movement.series} cancelled: location/custodian reverted`,
					},
				});
			}

			return tx.assetMovement.findFirstOrThrow({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					items: {
						every: { asset: { is: assetWhereForOrganization(organizationId) } },
					},
				},
				include: this.assetMovementInclude,
			});
		});

		return toAssetMovement(cancelled);
	}

	/**
	 * Finds an AssetMovement by ID.
	 *
	 * @param id Unique CUID of the movement
	 * @returns The AssetMovement domain object
	 */
	async findMovementById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetMovement> {
		this.assertOrganizationScope(organizationId);
		const movement = await this.prisma.assetMovement.findFirst({
			where: {
				id,
				company: { is: { organizationId } },
				items: {
					every: { asset: { is: assetWhereForOrganization(organizationId) } },
				},
			},
			include: this.assetMovementInclude,
		});
		if (!movement) {
			throw new NotFoundException(`AssetMovement ${id} not found.`);
		}
		return toAssetMovement(movement);
	}

	/**
	 * Lists AssetMovement records with pagination and filtering.
	 *
	 * @param input List parameters
	 * @returns List result wrapper
	 */
	async listMovements(
		input: Asset.ListAssetMovementsInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetMovementListResult> {
		this.assertOrganizationScope(organizationId);
		const where: Prisma.AssetMovementWhereInput = {
			company: {
				is: {
					organizationId,
					...(input.company ? { name: input.company } : {}),
				},
			},
			items: {
				every: { asset: { is: assetWhereForOrganization(organizationId) } },
			},
		};
		if (input.status) where.status = input.status;
		if (input.purpose) where.purpose = input.purpose;
		if (input.search) {
			where.OR = [
				{ series: { contains: input.search, mode: "insensitive" } },
				{ notes: { contains: input.search, mode: "insensitive" } },
			];
		}

		const take = Math.min(input.take ?? 50, LIST_TAKE_MAX);
		const skip = input.skip ?? 0;

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMovement.findMany({
				where,
				include: this.assetMovementInclude,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.assetMovement.count({ where }),
		]);

		return {
			items: items.map(toAssetMovement),
			totalCount,
		};
	}

	/**
	 * Creates a new draft AssetRepair document.
	 *
	 * @param input CreateAssetRepairInput
	 * @returns The created AssetRepair domain object
	 */
	async createAssetRepair(
		input: Asset.CreateAssetRepairInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetRepair> {
		this.assertOrganizationScope(organizationId);
		await this.resolveCompanyForOrganization(organizationId, input.companyId);
		this.assertValidOperationalDate(input.failureDate, "Failure date");
		if (input.completionDate) {
			this.assertValidOperationalDate(input.completionDate, "Completion date");
			if (dateOnlyUtc(input.completionDate) < dateOnlyUtc(input.failureDate)) {
				throw new BadRequestException(
					"Completion date cannot be before the failure date.",
				);
			}
		}
		if (!input.capitalizeRepairCost && input.increaseInAssetLife > 0) {
			throw new BadRequestException(
				"Useful life can be extended only when the repair cost is capitalized.",
			);
		}
		const invoiceKeys = (input.purchaseInvoices ?? []).map(
			(item) =>
				`${item.purchaseInvoice.trim()}\u0000${item.expenseAccount?.trim() ?? ""}`,
		);
		if (new Set(invoiceKeys).size !== invoiceKeys.length) {
			throw new BadRequestException(
				"Purchase invoice allocations must be unique by invoice and expense account.",
			);
		}
		const consumedItemKeys = (input.consumedItems ?? []).map(
			(item) => `${item.itemCode.trim()}\u0000${item.warehouse.trim()}`,
		);
		if (new Set(consumedItemKeys).size !== consumedItemKeys.length) {
			throw new BadRequestException(
				"Consumed stock items must be unique by item and warehouse.",
			);
		}

		let consumedTotal = 0;
		const consumedItemsData = (input.consumedItems ?? []).map((ci) => {
			const itemValuation = ci.valuationRate ?? 0;
			const totalAmt = this.roundCurrency(ci.quantity * itemValuation);
			consumedTotal += totalAmt;
			return {
				assetId: ci.assetId ?? null,
				itemCode: ci.itemCode,
				warehouse: ci.warehouse ?? null,
				expenseAccount: ci.expenseAccount ?? null,
				quantity: ci.quantity,
				valuationRate: itemValuation,
				totalAmount: totalAmt,
			};
		});

		let piTotal = 0;
		const piData = (input.purchaseInvoices ?? []).map((pi) => {
			piTotal += pi.amount;
			return {
				purchaseInvoice: pi.purchaseInvoice,
				expenseAccount: pi.expenseAccount ?? null,
				amount: pi.amount,
			};
		});

		const totalRepairCost = this.roundCurrency(consumedTotal + piTotal);

		const repair = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [input.assetId]);
			const asset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					id: input.assetId,
				}),
				select: {
					id: true,
					series: true,
					companyId: true,
					company: { select: { name: true } },
					status: true,
					purchaseDate: true,
				},
			});
			if (!asset) {
				throw new NotFoundException(
					`Asset with ID ${input.assetId} not found.`,
				);
			}
			if (asset.companyId !== input.companyId) {
				throw new BadRequestException(
					`Asset ${asset.series} does not belong to company ${input.companyId}.`,
				);
			}
			if (dateOnlyUtc(input.failureDate) < dateOnlyUtc(asset.purchaseDate)) {
				throw new BadRequestException(
					"Failure date cannot be before the asset purchase date.",
				);
			}
			if (
				asset.status === "DRAFT" ||
				asset.status === "CANCELLED" ||
				asset.status === "SCRAPPED" ||
				asset.status === "SOLD" ||
				asset.status === "CAPITALIZED" ||
				asset.status === "FULLY_DEPRECIATED"
			) {
				throw new BadRequestException(
					`Cannot create repair for asset ${asset.series} in ${asset.status} state.`,
				);
			}
			const openRepair = await tx.assetRepair.findFirst({
				where: {
					assetId: asset.id,
					asset: { is: assetWhereForOrganization(organizationId) },
					repairStatus: { in: ["DRAFT", "PENDING"] },
				},
				select: { series: true },
			});
			if (openRepair) {
				throw new ConflictException(
					`Asset ${asset.series} already has open repair ${openRepair.series}.`,
				);
			}
			const consumedAssetIds = (input.consumedItems ?? [])
				.map((item) => item.assetId)
				.filter((assetId): assetId is string => Boolean(assetId));
			if (consumedAssetIds.includes(asset.id)) {
				throw new BadRequestException(
					"The repaired asset cannot also be a consumed repair item.",
				);
			}
			if (consumedAssetIds.length > 0) {
				const consumedAssets = await tx.asset.findMany({
					where: assetWhereForOrganization(organizationId, {
						id: { in: consumedAssetIds },
						companyId: input.companyId,
					}),
					select: { id: true },
				});
				if (consumedAssets.length !== new Set(consumedAssetIds).size) {
					throw new BadRequestException(
						"Every consumed asset must exist and belong to the repair company.",
					);
				}
			}
			const series = await this.generateAssetRepairSeries(
				input.failureDate,
				organizationId,
				tx,
			);
			const created = await tx.assetRepair.create({
				data: {
					series,
					assetId: input.assetId,
					companyId: input.companyId,
					failureDate: input.failureDate,
					completionDate: input.completionDate ?? null,
					repairStatus: "PENDING",
					repairCost: totalRepairCost,
					capitalizeRepairCost: input.capitalizeRepairCost ?? false,
					increaseInAssetLife: input.increaseInAssetLife ?? 0,
					description: input.description ?? null,
					previousAssetStatus: asset.status,
					consumedItems: { create: consumedItemsData },
					purchaseInvoices: { create: piData },
				},
				include: this.assetRepairInclude,
			});
			await this.updateOwnedAsset(tx, organizationId, asset.id, {
				status: "OUT_OF_ORDER",
			});
			await tx.assetActivity.create({
				data: {
					assetId: asset.id,
					userId: actorId ?? null,
					activity: `Asset marked out of order for repair ${series}`,
				},
			});
			return created;
		});

		return toAssetRepairItem(repair);
	}

	/**
	 * Submits an AssetRepair document, completing the repair and optionally capitalizing repair cost into asset value.
	 *
	 * @param input SubmitAssetRepairInput
	 * @returns The submitted AssetRepair domain object
	 */
	async submitAssetRepair(
		input: Asset.SubmitAssetRepairInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetRepair> {
		this.assertOrganizationScope(organizationId);
		const repair = await this.prisma.assetRepair.findFirst({
			where: {
				id: input.id,
				company: { is: { organizationId } },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: {
				id: true,
				assetId: true,
				completionDate: true,
				failureDate: true,
				capitalizeRepairCost: true,
			},
		});
		if (!repair) {
			throw new NotFoundException(`AssetRepair ${input.id} not found.`);
		}
		const completionDate =
			repair.completionDate ??
			dateOnlyUtc(businessDate(depreciationTimeZone()));
		if (dateOnlyUtc(completionDate) < dateOnlyUtc(repair.failureDate)) {
			throw new BadRequestException(
				"Completion date cannot be before the failure date.",
			);
		}
		if (repair.capitalizeRepairCost) {
			await this.depreciationBarrier?.ensureDepreciationPosted({
				kind: "organization",
				organizationId,
				throughDate: completionDate,
				assetIds: [repair.assetId],
			});
		}

		const submitted = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [repair.assetId]);
			const currentRepair = await tx.assetRepair.findFirst({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.assetRepairInclude,
			});
			if (!currentRepair) {
				throw new NotFoundException(`AssetRepair ${input.id} not found.`);
			}
			if (currentRepair.repairStatus !== "PENDING") {
				throw new BadRequestException(
					`AssetRepair ${currentRepair.series} cannot be completed because status is ${currentRepair.repairStatus}.`,
				);
			}
			const asset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					id: currentRepair.assetId,
				}),
				select: {
					id: true,
					series: true,
					companyId: true,
					company: { select: { name: true } },
					assetCategoryId: true,
					status: true,
					netPurchaseAmount: true,
					valueAfterDepreciation: true,
					totalNumberOfDepreciations: true,
					calculateDepreciation: true,
				},
			});
			if (!asset) {
				throw new NotFoundException(
					`Asset ${currentRepair.assetId} not found.`,
				);
			}
			if (asset.status !== "OUT_OF_ORDER") {
				throw new ConflictException(
					`Asset ${asset.series} changed state while repair ${currentRepair.series} was pending.`,
				);
			}
			let stockEntryId: string | null = null;
			if (currentRepair.consumedItems.length > 0) {
				const stockEntry = await this.stockPosting.createMaterialIssue(
					tx,
					organizationId,
					{
						companyId: currentRepair.companyId,
						postingDate: completionDate,
						sourceType: "ASSET_REPAIR",
						sourceId: currentRepair.id,
						lines: currentRepair.consumedItems.map((item) => ({
							itemCode: item.itemCode,
							warehouse: item.warehouse ?? "",
							quantity: item.quantity,
							valuationRate: Number(item.valuationRate),
						})),
					},
				);
				stockEntryId = stockEntry.id;
			}

			const repairCost = this.roundCurrency(Number(currentRepair.repairCost));
			let accountingEntryId: string | null = null;
			if (currentRepair.capitalizeRepairCost && repairCost > 0) {
				const context = await this.getAssetAccountingContext(
					tx,
					organizationId,
					asset,
				);
				const creditLines = [
					...currentRepair.consumedItems.map((item) => ({
						account: item.expenseAccount?.trim() ?? "",
						amount: Number(item.totalAmount),
					})),
					...currentRepair.purchaseInvoices.map((item) => ({
						account: item.expenseAccount?.trim() ?? "",
						amount: Number(item.amount),
					})),
				].filter((line) => line.amount > 0);
				if (creditLines.some((line) => !line.account)) {
					throw new BadRequestException(
						"Every capitalized repair cost requires an expense account.",
					);
				}
				const entry = await this.accounting.createPostedEntry(
					tx,
					organizationId,
					{
						companyId: currentRepair.companyId,
						assetId: asset.id,
						sourceType: "REPAIR",
						sourceId: currentRepair.id,
						postingDate: completionDate,
						remarks: `Capitalized repair ${currentRepair.series} for ${asset.series}`,
						lines: [
							{
								account: context.fixedAssetAccount,
								debitAmount: repairCost,
								creditAmount: 0,
								costCenter: context.costCenter,
							},
							...creditLines.map((line) => ({
								account: line.account,
								debitAmount: 0,
								creditAmount: this.roundCurrency(line.amount),
								costCenter: context.costCenter,
							})),
						],
					},
				);
				accountingEntryId = entry.id;
			}

			const previousNet = Number(asset.netPurchaseAmount);
			const previousValue = Number(asset.valueAfterDepreciation);
			const previousTotal = asset.totalNumberOfDepreciations;
			const lifeDelta = currentRepair.capitalizeRepairCost
				? currentRepair.increaseInAssetLife
				: 0;
			if (
				currentRepair.capitalizeRepairCost &&
				asset.calculateDepreciation &&
				(repairCost !== 0 || lifeDelta !== 0)
			) {
				await this.depreciationRevision.revise(tx, organizationId, {
					assetId: asset.id,
					effectiveDate: completionDate,
					valueDelta: repairCost,
					usefulLifeDeltaMonths: lifeDelta,
					notes: `Schedule revised for repair ${currentRepair.series}`,
				});
			}
			const newValue = this.roundCurrency(
				previousValue + (currentRepair.capitalizeRepairCost ? repairCost : 0),
			);
			const restoredStatus: RestorableAssetStatus =
				currentRepair.previousAssetStatus === "FULLY_DEPRECIATED"
					? "FULLY_DEPRECIATED"
					: currentRepair.previousAssetStatus === "PARTIALLY_DEPRECIATED"
						? "PARTIALLY_DEPRECIATED"
						: "SUBMITTED";
			const baseRestoredStatus =
				restoredStatus === "FULLY_DEPRECIATED" && newValue > 0
					? "PARTIALLY_DEPRECIATED"
					: restoredStatus;
			await this.updateOwnedAsset(tx, organizationId, asset.id, {
				status: baseRestoredStatus,
				netPurchaseAmount: this.roundCurrency(
					previousNet + (currentRepair.capitalizeRepairCost ? repairCost : 0),
				),
				valueAfterDepreciation: newValue,
				totalNumberOfDepreciations: previousTotal,
				isFullyDepreciated: newValue <= 0,
			});

			const transition = await tx.assetRepair.updateMany({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: {
					repairStatus: "COMPLETED",
					submittedAt: new Date(),
					completionDate,
					stockEntryId,
					accountingEntryId,
					previousNetPurchaseAmount: previousNet,
					previousValueAfterDepreciation: previousValue,
					previousTotalDepreciations: previousTotal,
				},
			});
			if (transition.count !== 1) {
				throw new NotFoundException(`AssetRepair ${input.id} not found.`);
			}
			const updated = await tx.assetRepair.findFirstOrThrow({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.assetRepairInclude,
			});
			await this.syncMaintenanceAssetStatus(
				tx,
				asset.id,
				organizationId,
				baseRestoredStatus,
			);

			await tx.assetActivity.create({
				data: {
					assetId: currentRepair.assetId,
					userId: actorId ?? null,
					activity: `Asset repair ${currentRepair.series} completed (cost: ${repairCost})`,
				},
			});

			return updated;
		});

		return toAssetRepairItem(submitted);
	}

	/**
	 * Cancels an AssetRepair document, reverting any capitalized repair cost from the asset value.
	 *
	 * @param input CancelAssetRepairInput
	 * @returns The cancelled AssetRepair domain object
	 */
	async cancelAssetRepair(
		input: Asset.CancelAssetRepairInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetRepair> {
		this.assertOrganizationScope(organizationId);
		const repair = await this.prisma.assetRepair.findFirst({
			where: {
				id: input.id,
				company: { is: { organizationId } },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			select: { id: true, assetId: true },
		});
		if (!repair) {
			throw new NotFoundException(`AssetRepair ${input.id} not found.`);
		}

		const cancelled = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [repair.assetId]);
			const currentRepair = await tx.assetRepair.findFirst({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.assetRepairInclude,
			});
			if (!currentRepair) {
				throw new NotFoundException(`AssetRepair ${input.id} not found.`);
			}
			if (currentRepair.repairStatus === "CANCELLED") {
				throw new BadRequestException(
					`AssetRepair ${currentRepair.series} is already cancelled.`,
				);
			}
			const asset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					id: currentRepair.assetId,
				}),
				select: {
					id: true,
					series: true,
					status: true,
					netPurchaseAmount: true,
					valueAfterDepreciation: true,
					totalNumberOfDepreciations: true,
					calculateDepreciation: true,
				},
			});
			if (!asset) {
				throw new NotFoundException(
					`Asset ${currentRepair.assetId} not found.`,
				);
			}
			const baseRestoredStatus: RestorableAssetStatus =
				currentRepair.previousAssetStatus === "FULLY_DEPRECIATED"
					? "FULLY_DEPRECIATED"
					: currentRepair.previousAssetStatus === "PARTIALLY_DEPRECIATED"
						? "PARTIALLY_DEPRECIATED"
						: "SUBMITTED";

			if (currentRepair.repairStatus === "COMPLETED") {
				if (
					currentRepair.previousNetPurchaseAmount == null ||
					currentRepair.previousValueAfterDepreciation == null ||
					!currentRepair.submittedAt
				) {
					throw new ConflictException(
						`Repair ${currentRepair.series} is missing its reversal snapshot.`,
					);
				}
				const repairCost = currentRepair.capitalizeRepairCost
					? Number(currentRepair.repairCost)
					: 0;
				const expectedNet = this.roundCurrency(
					Number(currentRepair.previousNetPurchaseAmount) + repairCost,
				);
				const expectedValue = this.roundCurrency(
					Number(currentRepair.previousValueAfterDepreciation) + repairCost,
				);
				const expectedTotal = currentRepair.previousTotalDepreciations;
				if (
					this.roundCurrency(Number(asset.netPurchaseAmount)) !== expectedNet ||
					this.roundCurrency(Number(asset.valueAfterDepreciation)) !==
						expectedValue ||
					asset.totalNumberOfDepreciations !== expectedTotal
				) {
					throw new ConflictException(
						`Asset ${asset.series} changed after repair ${currentRepair.series}; cancellation would overwrite later values.`,
					);
				}
				const [laterDepreciation, laterAdjustments, laterAccounting] =
					await Promise.all([
						tx.assetDepreciationJournalEntry.count({
							where: {
								assetId: asset.id,
								status: "POSTED",
								createdAt: { gt: currentRepair.submittedAt },
								asset: { is: assetWhereForOrganization(organizationId) },
							},
						}),
						tx.assetValueAdjustment.count({
							where: {
								assetId: asset.id,
								status: "SUBMITTED",
								submittedAt: { gt: currentRepair.submittedAt },
								asset: { is: assetWhereForOrganization(organizationId) },
							},
						}),
						tx.assetAccountingEntry.count({
							where: {
								assetId: asset.id,
								status: "POSTED",
								createdAt: { gt: currentRepair.submittedAt },
								company: { is: { organizationId } },
								asset: { is: assetWhereForOrganization(organizationId) },
								...(currentRepair.accountingEntryId
									? { id: { not: currentRepair.accountingEntryId } }
									: {}),
							},
						}),
					]);
				if (
					laterDepreciation > 0 ||
					laterAdjustments > 0 ||
					laterAccounting > 0
				) {
					throw new ConflictException(
						"Repair cancellation is blocked by later depreciation or asset accounting.",
					);
				}
				if (currentRepair.accountingEntryId) {
					await this.accounting.reversePostedEntry(
						tx,
						organizationId,
						currentRepair.accountingEntryId,
					);
				}
				if (currentRepair.stockEntryId) {
					await this.stockPosting.cancelMaterialIssue(
						tx,
						organizationId,
						currentRepair.companyId,
						currentRepair.stockEntryId,
						"ASSET_REPAIR",
						currentRepair.id,
					);
				}
				if (
					currentRepair.capitalizeRepairCost &&
					asset.calculateDepreciation &&
					(repairCost !== 0 || currentRepair.increaseInAssetLife !== 0)
				) {
					await this.depreciationRevision.revise(tx, organizationId, {
						assetId: asset.id,
						effectiveDate: dateOnlyUtc(businessDate(depreciationTimeZone())),
						valueDelta: -repairCost,
						usefulLifeDeltaMonths: -currentRepair.increaseInAssetLife,
						notes: `Schedule revised after cancellation of repair ${currentRepair.series}`,
					});
				}
				await this.updateOwnedAsset(tx, organizationId, asset.id, {
					status: baseRestoredStatus,
					netPurchaseAmount: currentRepair.previousNetPurchaseAmount,
					valueAfterDepreciation: currentRepair.previousValueAfterDepreciation,
					totalNumberOfDepreciations: currentRepair.previousTotalDepreciations,
					isFullyDepreciated:
						currentRepair.previousAssetStatus === "FULLY_DEPRECIATED",
				});
			} else {
				if (asset.status !== "OUT_OF_ORDER") {
					throw new ConflictException(
						`Asset ${asset.series} changed state while repair ${currentRepair.series} was pending.`,
					);
				}
				await this.updateOwnedAsset(tx, organizationId, asset.id, {
					status: baseRestoredStatus,
				});
			}

			const transition = await tx.assetRepair.updateMany({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: {
					repairStatus: "CANCELLED",
					cancelledAt: new Date(),
				},
			});
			if (transition.count !== 1) {
				throw new NotFoundException(`AssetRepair ${input.id} not found.`);
			}
			const updated = await tx.assetRepair.findFirstOrThrow({
				where: {
					id: input.id,
					company: { is: { organizationId } },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: this.assetRepairInclude,
			});
			await this.syncMaintenanceAssetStatus(
				tx,
				asset.id,
				organizationId,
				baseRestoredStatus,
			);

			await tx.assetActivity.create({
				data: {
					assetId: currentRepair.assetId,
					userId: actorId ?? null,
					activity: `Asset repair ${currentRepair.series} cancelled`,
				},
			});

			return updated;
		});

		return toAssetRepairItem(cancelled);
	}

	/**
	 * Finds an AssetRepair by ID.
	 *
	 * @param id Unique CUID of the repair
	 * @returns The AssetRepair domain object
	 */
	async findRepairById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetRepair> {
		this.assertOrganizationScope(organizationId);
		const repair = await this.prisma.assetRepair.findFirst({
			where: {
				id,
				company: { is: { organizationId } },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			include: this.assetRepairInclude,
		});
		if (!repair) {
			throw new NotFoundException(`AssetRepair ${id} not found.`);
		}
		return toAssetRepairItem(repair);
	}

	/**
	 * Lists AssetRepair records with pagination and filtering.
	 *
	 * @param input List parameters
	 * @returns List result wrapper
	 */
	async listRepairs(
		input: Asset.ListAssetRepairsInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetRepairListResult> {
		this.assertOrganizationScope(organizationId);
		const where: Prisma.AssetRepairWhereInput = {
			company: {
				is: {
					organizationId,
					...(input.company ? { name: input.company } : {}),
				},
			},
			asset: { is: assetWhereForOrganization(organizationId) },
		};
		if (input.assetId) {
			where.asset = {
				is: assetWhereForOrganization(organizationId, { id: input.assetId }),
			};
		}
		if (input.status) where.repairStatus = input.status;
		if (input.search) {
			where.OR = [
				{ series: { contains: input.search, mode: "insensitive" } },
				{ description: { contains: input.search, mode: "insensitive" } },
			];
		}

		const take = Math.min(input.take ?? 50, LIST_TAKE_MAX);
		const skip = input.skip ?? 0;

		const [items, totalCount] = await Promise.all([
			this.prisma.assetRepair.findMany({
				where,
				include: this.assetRepairInclude,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.assetRepair.count({ where }),
		]);

		return {
			items: items.map(toAssetRepairItem),
			totalCount,
		};
	}

	/**
	 * Creates a new draft AssetCapitalization document.
	 *
	 * @param input CreateAssetCapitalizationInput
	 * @returns The created AssetCapitalization domain object
	 */
	async createAssetCapitalization(
		input: Asset.CreateAssetCapitalizationInput,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<Asset.AssetCapitalization> {
		this.assertOrganizationScope(organizationId);
		await this.resolveCompanyForOrganization(organizationId, input.companyId);
		this.assertValidOperationalDate(input.postingDate, "Posting date");
		if (
			(input.stockItems?.length ?? 0) === 0 &&
			(input.assetItems?.length ?? 0) === 0 &&
			(input.serviceItems?.length ?? 0) === 0
		) {
			throw new BadRequestException(
				"At least one stock, asset, or service source is required for capitalization.",
			);
		}
		const sourceAssetIds = (input.assetItems ?? []).map((item) => item.assetId);
		if (new Set(sourceAssetIds).size !== sourceAssetIds.length) {
			throw new BadRequestException(
				"An asset can appear only once in a capitalization document.",
			);
		}
		if (input.targetType === "EXISTING_ASSET" && !input.targetAssetId) {
			throw new BadRequestException(
				"Target asset is required when capitalizing into an existing asset.",
			);
		}
		if (input.targetAssetId && sourceAssetIds.includes(input.targetAssetId)) {
			throw new BadRequestException(
				"The target asset cannot also be a consumed asset.",
			);
		}
		const stockKeys = (input.stockItems ?? []).map(
			(item) => `${item.itemCode.trim()}\u0000${item.warehouse?.trim() ?? ""}`,
		);
		if (new Set(stockKeys).size !== stockKeys.length) {
			throw new BadRequestException(
				"Consumed stock items must be unique by item and warehouse.",
			);
		}
		let totalStockVal = 0;
		const stockItemsData = (input.stockItems ?? []).map((si) => {
			const amt = this.roundCurrency(si.stockQty * si.valuationRate);
			totalStockVal += amt;
			return {
				itemCode: si.itemCode,
				warehouse: si.warehouse ?? null,
				expenseAccount: si.expenseAccount ?? null,
				stockQty: si.stockQty,
				valuationRate: si.valuationRate,
				amount: amt,
			};
		});

		let totalAssetVal = 0;
		const assetItemsData = (input.assetItems ?? []).map((ai) => {
			totalAssetVal += ai.assetValue;
			return {
				assetId: ai.assetId,
				assetValue: ai.assetValue,
			};
		});

		let totalServiceVal = 0;
		const serviceItemsData = (input.serviceItems ?? []).map((si) => {
			totalServiceVal += si.amount;
			return {
				itemCode: si.itemCode ?? null,
				expenseAccount: si.expenseAccount,
				amount: si.amount,
			};
		});

		const capitalization = await this.prisma.$transaction(async (tx) => {
			await this.lockAssets(tx, [
				...sourceAssetIds,
				...(input.targetAssetId ? [input.targetAssetId] : []),
			]);
			const company = await tx.company.findFirst({
				where: companyWhereForOrganization(organizationId, {
					id: input.companyId,
				}),
				select: { id: true, name: true, disabled: true },
			});
			if (!company || company.disabled) {
				throw new BadRequestException(
					`Company ${input.companyId} is missing or disabled.`,
				);
			}
			let resolvedTargetName = input.targetAssetName ?? null;
			let resolvedTargetCategory = input.targetAssetCategory ?? null;
			let resolvedTargetItemCode = input.targetItemCode ?? null;
			if (input.targetAssetId) {
				const target = await tx.asset.findFirst({
					where: assetWhereForOrganization(organizationId, {
						id: input.targetAssetId,
					}),
					select: {
						companyId: true,
						company: { select: { name: true } },
						series: true,
						assetName: true,
						itemCode: true,
						status: true,
						assetType: true,
						assetCategory: { select: { name: true } },
					},
				});
				if (!target) {
					throw new NotFoundException(
						`Asset ${input.targetAssetId} not found.`,
					);
				}
				if (target.companyId !== input.companyId) {
					throw new BadRequestException(
						`Target asset ${target.series} does not belong to company ${input.companyId}.`,
					);
				}
				if (
					target.status !== "DRAFT" ||
					target.assetType !== "COMPOSITE_ASSET"
				) {
					throw new BadRequestException(
						`Target asset ${target.series} must be a draft composite asset.`,
					);
				}
				resolvedTargetName = target.assetName;
				resolvedTargetCategory = target.assetCategory?.name ?? null;
				resolvedTargetItemCode = target.itemCode;
			} else {
				const [category, item] = await Promise.all([
					tx.assetCategory.findUnique({
						where: { name: input.targetAssetCategory ?? "" },
						select: { id: true },
					}),
					tx.inventoryItem.findUnique({
						where: { code: input.targetItemCode ?? "" },
						select: {
							isFixedAsset: true,
							disabled: true,
							endOfLife: true,
						},
					}),
				]);
				if (!category) {
					throw new NotFoundException(
						`Asset category ${input.targetAssetCategory} not found.`,
					);
				}
				if (
					!item ||
					!item.isFixedAsset ||
					item.disabled ||
					(item.endOfLife && item.endOfLife < input.postingDate)
				) {
					throw new BadRequestException(
						`Target item ${input.targetItemCode} must be an active fixed-asset item.`,
					);
				}
			}
			const sources = await tx.asset.findMany({
				where: assetWhereForOrganization(organizationId, {
					id: { in: sourceAssetIds },
				}),
				select: {
					id: true,
					series: true,
					companyId: true,
					company: { select: { name: true } },
					status: true,
					purchaseDate: true,
					availableForUseDate: true,
					valueAfterDepreciation: true,
				},
			});
			if (sources.length !== sourceAssetIds.length) {
				throw new NotFoundException(
					"One or more source assets were not found.",
				);
			}
			const sourceById = new Map(sources.map((source) => [source.id, source]));
			for (const item of assetItemsData) {
				const source = sourceById.get(item.assetId);
				if (!source || source.companyId !== input.companyId) {
					throw new BadRequestException(
						`Every source asset must belong to company ${input.companyId}.`,
					);
				}
				if (
					source.status !== "SUBMITTED" &&
					source.status !== "PARTIALLY_DEPRECIATED" &&
					source.status !== "FULLY_DEPRECIATED"
				) {
					throw new BadRequestException(
						`Source asset ${source.series} cannot be capitalized from ${source.status}.`,
					);
				}
				const operationalDate =
					source.availableForUseDate ?? source.purchaseDate;
				if (dateOnlyUtc(input.postingDate) < dateOnlyUtc(operationalDate)) {
					throw new BadRequestException(
						`Posting date cannot be before source asset ${source.series} became available.`,
					);
				}
				item.assetValue = this.roundCurrency(
					Number(source.valueAfterDepreciation),
				);
			}
			totalAssetVal = this.roundCurrency(
				assetItemsData.reduce((total, item) => total + item.assetValue, 0),
			);
			const grandTotalValue = this.roundCurrency(
				totalStockVal + totalAssetVal + totalServiceVal,
			);
			if (grandTotalValue <= 0) {
				throw new BadRequestException(
					"Capitalization total must be greater than zero.",
				);
			}
			const series = await this.generateAssetCapitalizationSeries(
				input.postingDate,
				organizationId,
				tx,
			);
			const created = await tx.assetCapitalization.create({
				data: {
					series,
					companyId: input.companyId,
					postingDate: input.postingDate,
					targetType: input.targetType,
					targetAssetId: input.targetAssetId ?? null,
					targetAssetName: resolvedTargetName,
					targetAssetCategory: resolvedTargetCategory,
					targetItemCode: resolvedTargetItemCode,
					status: "DRAFT",
					totalStockValue: totalStockVal,
					totalAssetValue: totalAssetVal,
					totalServiceValue: totalServiceVal,
					totalValue: grandTotalValue,
					notes: input.notes ?? null,
					stockItems: { create: stockItemsData },
					assetItems: { create: assetItemsData },
					serviceItems: { create: serviceItemsData },
				},
				include: this.assetCapitalizationInclude,
			});
			if (actorId) {
				for (const assetId of sourceAssetIds) {
					await tx.assetActivity.create({
						data: {
							assetId,
							userId: actorId,
							activity: `Asset capitalization draft created for ${company.name}`,
						},
					});
				}
				if (input.targetAssetId) {
					await tx.assetActivity.create({
						data: {
							assetId: input.targetAssetId,
							userId: actorId,
							activity: `Asset capitalization draft targets ${company.name}`,
						},
					});
				}
			}
			return created;
		});

		return toAssetCapitalizationItem(capitalization);
	}

	/**
	 * Submits an AssetCapitalization document, capitalizing values into the target asset and marking consumed assets as capitalized.
	 *
	 * @param input SubmitAssetCapitalizationInput
	 * @returns The submitted AssetCapitalization domain object
	 */
	async submitAssetCapitalization(
		input: Asset.SubmitAssetCapitalizationInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetCapitalization> {
		this.assertOrganizationScope(organizationId);
		const cap = await this.prisma.assetCapitalization.findFirst({
			where: this.assetCapitalizationWhereForOrganization(organizationId, {
				id: input.id,
			}),
			select: {
				postingDate: true,
				targetAssetId: true,
				assetItems: { select: { assetId: true } },
			},
		});
		if (!cap) {
			throw new NotFoundException(`AssetCapitalization ${input.id} not found.`);
		}
		const sourceAssetIds = cap.assetItems.map((item) => item.assetId);
		if (sourceAssetIds.length > 0) {
			await this.depreciationBarrier?.ensureDepreciationPosted({
				kind: "organization",
				organizationId,
				throughDate: cap.postingDate,
				assetIds: sourceAssetIds,
			});
		}

		const submitted = await this.prisma.$transaction(async (tx) => {
			await tx.$queryRaw(Prisma.sql`
				SELECT pg_advisory_xact_lock(hashtext(${`asset-capitalization:${input.id}`})) IS NULL AS "locked"
			`);
			await this.lockAssets(tx, [
				...sourceAssetIds,
				...(cap.targetAssetId ? [cap.targetAssetId] : []),
			]);
			const currentCap = await tx.assetCapitalization.findFirst({
				where: this.assetCapitalizationWhereForOrganization(organizationId, {
					id: input.id,
				}),
				include: this.assetCapitalizationInclude,
			});
			if (!currentCap) {
				throw new NotFoundException(
					`AssetCapitalization ${input.id} not found.`,
				);
			}
			if (currentCap.status !== "DRAFT") {
				throw new BadRequestException(
					`AssetCapitalization ${currentCap.series} cannot be submitted because status is ${currentCap.status}.`,
				);
			}
			return this.postAssetCapitalization(
				tx,
				currentCap,
				sourceAssetIds,
				organizationId,
				actorId,
			);
		});

		return toAssetCapitalizationItem(submitted);
	}

	private async postAssetCapitalization(
		tx: Prisma.TransactionClient,
		cap: PrismaAssetCapitalization,
		sourceAssetIds: readonly string[],
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<PrismaAssetCapitalization> {
		const company = await tx.company.findFirst({
			where: companyWhereForOrganization(organizationId, { id: cap.companyId }),
			select: { id: true, name: true, disabled: true },
		});
		if (!company || company.disabled) {
			throw new BadRequestException(
				`Company ${cap.companyId} is missing or disabled.`,
			);
		}
		const sources = await tx.asset.findMany({
			where: assetWhereForOrganization(organizationId, {
				id: { in: [...sourceAssetIds] },
			}),
			select: {
				id: true,
				series: true,
				companyId: true,
				company: { select: { name: true } },
				assetCategoryId: true,
				status: true,
				disposalDate: true,
				netPurchaseAmount: true,
				valueAfterDepreciation: true,
			},
		});
		if (sources.length !== sourceAssetIds.length) {
			throw new NotFoundException("One or more source assets were not found.");
		}
		const laterDepreciation = await tx.assetDepreciationJournalEntry.count({
			where: {
				assetId: { in: [...sourceAssetIds] },
				asset: { is: assetWhereForOrganization(organizationId) },
				status: "POSTED",
				postingDate: { gt: cap.postingDate },
			},
		});
		if (laterDepreciation > 0) {
			throw new BadRequestException(
				"Capitalization cannot precede a source asset's latest posted depreciation.",
			);
		}

		type TargetAsset = {
			id: string;
			series: string;
			companyId: string;
			assetCategoryId: string | null;
			status: Asset.AssetStatus;
			assetType: Asset.AssetType;
			netPurchaseAmount: Prisma.Decimal;
			valueAfterDepreciation: Prisma.Decimal;
		};
		let target: TargetAsset;
		let createdTargetAsset = false;
		if (cap.targetType === "EXISTING_ASSET") {
			if (!cap.targetAssetId) {
				throw new BadRequestException(
					"An existing target asset is required for capitalization.",
				);
			}
			const existingTarget = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					id: cap.targetAssetId,
				}),
				select: {
					id: true,
					series: true,
					companyId: true,
					company: { select: { name: true } },
					assetCategoryId: true,
					status: true,
					assetType: true,
					netPurchaseAmount: true,
					valueAfterDepreciation: true,
				},
			});
			if (!existingTarget) {
				throw new NotFoundException(
					`Target asset ${cap.targetAssetId} not found.`,
				);
			}
			if (
				existingTarget.companyId !== cap.companyId ||
				existingTarget.status !== "DRAFT" ||
				existingTarget.assetType !== "COMPOSITE_ASSET"
			) {
				throw new ConflictException(
					`Target asset ${existingTarget.series} must remain a draft composite asset in ${company.name}.`,
				);
			}
			target = {
				...existingTarget,
				status: existingTarget.status as Asset.AssetStatus,
			};
		} else {
			const [category, item] = await Promise.all([
				tx.assetCategory.findUnique({
					where: { name: cap.targetAssetCategory ?? "" },
					select: { id: true },
				}),
				tx.inventoryItem.findUnique({
					where: { code: cap.targetItemCode ?? "" },
					select: { isFixedAsset: true, disabled: true, endOfLife: true },
				}),
			]);
			if (!category) {
				throw new NotFoundException(
					`Asset category ${cap.targetAssetCategory} not found.`,
				);
			}
			if (
				!item ||
				!item.isFixedAsset ||
				item.disabled ||
				(item.endOfLife && item.endOfLife < cap.postingDate)
			) {
				throw new BadRequestException(
					`Target item ${cap.targetItemCode} must remain an active fixed-asset item.`,
				);
			}
			const targetSeries = await this.generateAssetSeries(
				cap.postingDate,
				organizationId,
				tx,
			);
			const created = await tx.asset.create({
				data: {
					series: targetSeries,
					assetName: cap.targetAssetName ?? targetSeries,
					itemCode: cap.targetItemCode ?? "",
					assetCategoryId: category.id,
					companyId: company.id,
					purchaseDate: cap.postingDate,
					availableForUseDate: cap.postingDate,
					netPurchaseAmount: 0,
					valueAfterDepreciation: 0,
					calculateDepreciation: false,
					assetType: "COMPOSITE_ASSET",
					status: "DRAFT",
				},
				select: {
					id: true,
					series: true,
					companyId: true,
					assetCategoryId: true,
					status: true,
					assetType: true,
					netPurchaseAmount: true,
					valueAfterDepreciation: true,
				},
			});
			target = { ...created, status: created.status as Asset.AssetStatus };
			createdTargetAsset = true;
			await tx.assetActivity.create({
				data: {
					assetId: target.id,
					userId: actorId ?? null,
					activity: `Draft composite asset created for capitalization ${cap.series}`,
				},
			});
		}
		if (sourceAssetIds.includes(target.id)) {
			throw new BadRequestException(
				"The target asset cannot also be a consumed source asset.",
			);
		}

		let stockEntryId: string | null = null;
		if (cap.stockItems.length > 0) {
			const stockEntry = await this.stockPosting.createMaterialIssue(
				tx,
				organizationId,
				{
					companyId: cap.companyId,
					postingDate: cap.postingDate,
					sourceType: "ASSET_CAPITALIZATION",
					sourceId: cap.id,
					lines: cap.stockItems.map((item) => ({
						itemCode: item.itemCode,
						warehouse: item.warehouse ?? "",
						quantity: item.stockQty,
						valuationRate: Number(item.valuationRate),
					})),
				},
			);
			stockEntryId = stockEntry.id;
		}

		const targetContext = await this.getAssetAccountingContext(
			tx,
			organizationId,
			target,
		);
		const accountingLines: Array<{
			account: string;
			debitAmount: number;
			creditAmount: number;
			costCenter: string | null;
		}> = [];
		let totalStockValue = 0;
		for (const item of cap.stockItems) {
			const amount = this.roundCurrency(Number(item.amount));
			if (amount <= 0) continue;
			if (!item.expenseAccount?.trim()) {
				throw new BadRequestException(
					`Stock item ${item.itemCode} requires an expense account for capitalization.`,
				);
			}
			totalStockValue = this.roundCurrency(totalStockValue + amount);
			accountingLines.push({
				account: item.expenseAccount.trim(),
				debitAmount: 0,
				creditAmount: amount,
				costCenter: targetContext.costCenter,
			});
		}
		let totalServiceValue = 0;
		for (const item of cap.serviceItems) {
			const amount = this.roundCurrency(Number(item.amount));
			if (amount <= 0) continue;
			totalServiceValue = this.roundCurrency(totalServiceValue + amount);
			accountingLines.push({
				account: item.expenseAccount.trim(),
				debitAmount: 0,
				creditAmount: amount,
				costCenter: targetContext.costCenter,
			});
		}

		let totalAssetValue = 0;
		const sourceById = new Map(sources.map((source) => [source.id, source]));
		for (const item of cap.assetItems) {
			const source = sourceById.get(item.assetId);
			if (!source || source.companyId !== cap.companyId) {
				throw new BadRequestException(
					`Every source asset must belong to ${company.name}.`,
				);
			}
			if (
				source.status !== "SUBMITTED" &&
				source.status !== "PARTIALLY_DEPRECIATED" &&
				source.status !== "FULLY_DEPRECIATED"
			) {
				throw new ConflictException(
					`Source asset ${source.series} changed to ${source.status} before capitalization.`,
				);
			}
			const carryingValue = this.roundCurrency(
				Number(source.valueAfterDepreciation),
			);
			const fixedAssetBalance = await this.getFixedAssetBalance(
				tx,
				organizationId,
				source.id,
				Number(source.netPurchaseAmount),
			);
			const accumulatedDepreciation = this.roundCurrency(
				fixedAssetBalance - carryingValue,
			);
			if (carryingValue < 0 || accumulatedDepreciation < 0) {
				throw new BadRequestException(
					`Source asset ${source.series} has inconsistent book values.`,
				);
			}
			const sourceContext = await this.getAssetAccountingContext(
				tx,
				organizationId,
				source,
			);
			if (
				accumulatedDepreciation > 0 &&
				!sourceContext.accumulatedDepreciationAccount
			) {
				throw new BadRequestException(
					`Source asset ${source.series} requires an accumulated depreciation account.`,
				);
			}
			if (fixedAssetBalance > 0) {
				accountingLines.push({
					account: sourceContext.fixedAssetAccount,
					debitAmount: 0,
					creditAmount: fixedAssetBalance,
					costCenter: sourceContext.costCenter,
				});
			}
			if (accumulatedDepreciation > 0) {
				accountingLines.push({
					account: sourceContext.accumulatedDepreciationAccount as string,
					debitAmount: accumulatedDepreciation,
					creditAmount: 0,
					costCenter: sourceContext.costCenter,
				});
			}
			totalAssetValue = this.roundCurrency(totalAssetValue + carryingValue);
			const itemTransition = await tx.assetCapitalizationAssetItem.updateMany({
				where: {
					id: item.id,
					capitalization: {
						is: this.assetCapitalizationWhereForOrganization(organizationId),
					},
				},
				data: {
					assetValue: carryingValue,
					previousStatus: source.status,
					previousDisposalDate: source.disposalDate,
				},
			});
			if (itemTransition.count !== 1) {
				throw new NotFoundException(
					`Capitalization asset item ${item.id} not found.`,
				);
			}
		}
		const totalValue = this.roundCurrency(
			totalStockValue + totalServiceValue + totalAssetValue,
		);
		if (totalValue <= 0) {
			throw new BadRequestException(
				"Capitalization total must be greater than zero.",
			);
		}
		accountingLines.unshift({
			account: targetContext.fixedAssetAccount,
			debitAmount: totalValue,
			creditAmount: 0,
			costCenter: targetContext.costCenter,
		});
		const entry = await this.accounting.createPostedEntry(tx, organizationId, {
			companyId: cap.companyId,
			assetId: target.id,
			sourceType: "CAPITALIZATION",
			sourceId: cap.id,
			postingDate: cap.postingDate,
			remarks: `Capitalization ${cap.series} into ${target.series}`,
			lines: accountingLines,
		});

		const targetPreviousNet = Number(target.netPurchaseAmount);
		const targetPreviousValue = Number(target.valueAfterDepreciation);
		await this.updateOwnedAsset(tx, organizationId, target.id, {
			netPurchaseAmount: this.roundCurrency(targetPreviousNet + totalValue),
			valueAfterDepreciation: this.roundCurrency(
				targetPreviousValue + totalValue,
			),
			isFullyDepreciated: false,
		});
		await tx.assetActivity.create({
			data: {
				assetId: target.id,
				userId: actorId ?? null,
				activity: `Capitalized value ${totalValue} via ${cap.series} and accounting entry ${entry.series}`,
			},
		});
		for (const source of sources) {
			await this.depreciationRevision.closeOpenSchedules(
				tx,
				organizationId,
				source.id,
			);
			await this.updateOwnedAsset(tx, organizationId, source.id, {
				status: "CAPITALIZED",
				disposalDate: cap.postingDate,
			});
			await tx.assetActivity.create({
				data: {
					assetId: source.id,
					userId: actorId ?? null,
					activity: `Asset consumed in capitalization ${cap.series}`,
				},
			});
		}

		const capitalizationTransition = await tx.assetCapitalization.updateMany({
			where: this.assetCapitalizationWhereForOrganization(organizationId, {
				id: cap.id,
			}),
			data: {
				status: "SUBMITTED",
				submittedAt: new Date(),
				targetAssetId: target.id,
				createdTargetAsset,
				stockEntryId,
				accountingEntryId: entry.id,
				targetPreviousNetPurchaseAmount: targetPreviousNet,
				targetPreviousValueAfterDepreciation: targetPreviousValue,
				targetPreviousStatus: target.status,
				totalStockValue,
				totalAssetValue,
				totalServiceValue,
				totalValue,
			},
		});
		if (capitalizationTransition.count !== 1) {
			throw new NotFoundException(`AssetCapitalization ${cap.id} not found.`);
		}
		return tx.assetCapitalization.findFirstOrThrow({
			where: this.assetCapitalizationWhereForOrganization(organizationId, {
				id: cap.id,
			}),
			include: this.assetCapitalizationInclude,
		});
	}

	/**
	 * Cancels an AssetCapitalization document, reverting target asset values and restoring consumed assets.
	 *
	 * @param input CancelAssetCapitalizationInput
	 * @returns The cancelled AssetCapitalization domain object
	 */
	async cancelAssetCapitalization(
		input: Asset.CancelAssetCapitalizationInput,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<Asset.AssetCapitalization> {
		this.assertOrganizationScope(organizationId);
		const cap = await this.prisma.assetCapitalization.findFirst({
			where: this.assetCapitalizationWhereForOrganization(organizationId, {
				id: input.id,
			}),
			select: {
				targetAssetId: true,
				assetItems: { select: { assetId: true } },
			},
		});
		if (!cap) {
			throw new NotFoundException(`AssetCapitalization ${input.id} not found.`);
		}

		const cancelled = await this.prisma.$transaction(async (tx) => {
			await tx.$queryRaw(Prisma.sql`
				SELECT pg_advisory_xact_lock(hashtext(${`asset-capitalization:${input.id}`})) IS NULL AS "locked"
			`);
			const assetIds = [
				...cap.assetItems.map((item) => item.assetId),
				...(cap.targetAssetId ? [cap.targetAssetId] : []),
			];
			await this.lockAssets(tx, assetIds);
			const currentCap = await tx.assetCapitalization.findFirst({
				where: this.assetCapitalizationWhereForOrganization(organizationId, {
					id: input.id,
				}),
				include: this.assetCapitalizationInclude,
			});
			if (!currentCap) {
				throw new NotFoundException(
					`AssetCapitalization ${input.id} not found.`,
				);
			}
			if (currentCap.status !== "SUBMITTED") {
				throw new BadRequestException(
					`AssetCapitalization ${currentCap.series} cannot be cancelled because status is ${currentCap.status}.`,
				);
			}
			return this.reverseAssetCapitalization(
				tx,
				currentCap,
				organizationId,
				actorId,
			);
		});

		return toAssetCapitalizationItem(cancelled);
	}

	private async reverseAssetCapitalization(
		tx: Prisma.TransactionClient,
		cap: PrismaAssetCapitalization,
		organizationId: AssetOrganizationId,
		actorId?: string,
	): Promise<PrismaAssetCapitalization> {
		if (
			!cap.targetAssetId ||
			!cap.submittedAt ||
			cap.targetPreviousNetPurchaseAmount == null ||
			cap.targetPreviousValueAfterDepreciation == null ||
			!cap.targetPreviousStatus
		) {
			throw new ConflictException(
				`Capitalization ${cap.series} is missing its reversal snapshot.`,
			);
		}
		const target = await tx.asset.findFirst({
			where: assetWhereForOrganization(organizationId, {
				id: cap.targetAssetId,
			}),
			select: {
				id: true,
				series: true,
				status: true,
				netPurchaseAmount: true,
				valueAfterDepreciation: true,
			},
		});
		if (!target) {
			throw new NotFoundException(
				`Target asset ${cap.targetAssetId} not found.`,
			);
		}
		const previousNet = Number(cap.targetPreviousNetPurchaseAmount);
		const previousValue = Number(cap.targetPreviousValueAfterDepreciation);
		const expectedNet = this.roundCurrency(
			previousNet + Number(cap.totalValue),
		);
		const expectedValue = this.roundCurrency(
			previousValue + Number(cap.totalValue),
		);
		if (
			target.status !== cap.targetPreviousStatus ||
			this.roundCurrency(Number(target.netPurchaseAmount)) !== expectedNet ||
			this.roundCurrency(Number(target.valueAfterDepreciation)) !==
				expectedValue
		) {
			throw new ConflictException(
				`Target asset ${target.series} changed after capitalization ${cap.series}.`,
			);
		}

		const sourceIds = cap.assetItems.map((item) => item.assetId);
		const sources = await tx.asset.findMany({
			where: assetWhereForOrganization(organizationId, {
				id: { in: sourceIds },
			}),
			select: { id: true, series: true, status: true, disposalDate: true },
		});
		if (sources.length !== sourceIds.length) {
			throw new ConflictException(
				"A source asset needed to reverse this capitalization is missing.",
			);
		}
		const itemByAssetId = new Map(
			cap.assetItems.map((item) => [item.assetId, item]),
		);
		for (const source of sources) {
			const snapshot = itemByAssetId.get(source.id);
			if (
				!snapshot?.previousStatus ||
				source.status !== "CAPITALIZED" ||
				!source.disposalDate ||
				dateOnlyUtc(source.disposalDate).getTime() !==
					dateOnlyUtc(cap.postingDate).getTime()
			) {
				throw new ConflictException(
					`Source asset ${source.series} changed after capitalization ${cap.series}.`,
				);
			}
		}

		const allAssetIds = [target.id, ...sourceIds];
		const [laterDepreciation, laterAdjustments, laterAccounting] =
			await Promise.all([
				tx.assetDepreciationJournalEntry.count({
					where: {
						assetId: { in: allAssetIds },
						asset: { is: assetWhereForOrganization(organizationId) },
						status: "POSTED",
						createdAt: { gt: cap.submittedAt },
					},
				}),
				tx.assetValueAdjustment.count({
					where: {
						assetId: { in: allAssetIds },
						asset: { is: assetWhereForOrganization(organizationId) },
						status: "SUBMITTED",
						submittedAt: { gt: cap.submittedAt },
					},
				}),
				tx.assetAccountingEntry.count({
					where: {
						assetId: { in: allAssetIds },
						asset: { is: assetWhereForOrganization(organizationId) },
						status: "POSTED",
						createdAt: { gt: cap.submittedAt },
						...(cap.accountingEntryId
							? { id: { not: cap.accountingEntryId } }
							: {}),
					},
				}),
			]);
		if (laterDepreciation > 0 || laterAdjustments > 0 || laterAccounting > 0) {
			throw new ConflictException(
				"Capitalization cancellation is blocked by later depreciation or asset accounting.",
			);
		}
		if (!cap.accountingEntryId) {
			throw new ConflictException(
				`Capitalization ${cap.series} has no accounting entry to reverse.`,
			);
		}
		await this.accounting.reversePostedEntry(
			tx,
			organizationId,
			cap.accountingEntryId,
		);
		if (cap.stockEntryId) {
			await this.stockPosting.cancelMaterialIssue(
				tx,
				organizationId,
				cap.companyId,
				cap.stockEntryId,
				"ASSET_CAPITALIZATION",
				cap.id,
			);
		}
		await this.updateOwnedAsset(tx, organizationId, target.id, {
			status: cap.createdTargetAsset ? "CANCELLED" : cap.targetPreviousStatus,
			netPurchaseAmount: cap.targetPreviousNetPurchaseAmount,
			valueAfterDepreciation: cap.targetPreviousValueAfterDepreciation,
			isFullyDepreciated: false,
		});
		await tx.assetActivity.create({
			data: {
				assetId: target.id,
				userId: actorId ?? null,
				activity: `Capitalization ${cap.series} cancelled and accounting reversed`,
			},
		});
		for (const source of sources) {
			const snapshot = itemByAssetId.get(source.id);
			if (!snapshot?.previousStatus) continue;
			await this.depreciationRevision.reactivateLatestClosedSchedules(
				tx,
				organizationId,
				source.id,
			);
			await this.updateOwnedAsset(tx, organizationId, source.id, {
				status: snapshot.previousStatus,
				disposalDate: snapshot.previousDisposalDate,
			});
			await tx.assetActivity.create({
				data: {
					assetId: source.id,
					userId: actorId ?? null,
					activity: `Asset restored from cancelled capitalization ${cap.series}`,
				},
			});
		}

		const capitalizationTransition = await tx.assetCapitalization.updateMany({
			where: this.assetCapitalizationWhereForOrganization(organizationId, {
				id: cap.id,
			}),
			data: { status: "CANCELLED", cancelledAt: new Date() },
		});
		if (capitalizationTransition.count !== 1) {
			throw new NotFoundException(`AssetCapitalization ${cap.id} not found.`);
		}
		return tx.assetCapitalization.findFirstOrThrow({
			where: this.assetCapitalizationWhereForOrganization(organizationId, {
				id: cap.id,
			}),
			include: this.assetCapitalizationInclude,
		});
	}

	/**
	 * Finds an AssetCapitalization by ID.
	 *
	 * @param id Unique CUID of the capitalization
	 * @returns The AssetCapitalization domain object
	 */
	async findCapitalizationById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetCapitalization> {
		this.assertOrganizationScope(organizationId);
		const cap = await this.prisma.assetCapitalization.findFirst({
			where: this.assetCapitalizationWhereForOrganization(organizationId, {
				id,
			}),
			include: this.assetCapitalizationInclude,
		});
		if (!cap) {
			throw new NotFoundException(`AssetCapitalization ${id} not found.`);
		}
		return toAssetCapitalizationItem(cap);
	}

	/**
	 * Lists AssetCapitalization records with pagination and filtering.
	 *
	 * @param input List parameters
	 * @returns List result wrapper
	 */
	async listCapitalizations(
		input: Asset.ListAssetCapitalizationsInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetCapitalizationListResult> {
		this.assertOrganizationScope(organizationId);
		const where: Prisma.AssetCapitalizationWhereInput = {
			company: {
				is: {
					organizationId,
					...(input.company ? { name: input.company } : {}),
				},
			},
			assetItems: {
				every: { asset: { is: assetWhereForOrganization(organizationId) } },
			},
		};
		if (input.status) where.status = input.status;
		if (input.search) {
			where.OR = [
				{ series: { contains: input.search, mode: "insensitive" } },
				{ notes: { contains: input.search, mode: "insensitive" } },
				{ targetAssetName: { contains: input.search, mode: "insensitive" } },
			];
		}

		const take = Math.min(input.take ?? 50, LIST_TAKE_MAX);
		const skip = input.skip ?? 0;

		const scopedWhere = this.assetCapitalizationWhereForOrganization(
			organizationId,
			where,
		);
		const [items, totalCount] = await Promise.all([
			this.prisma.assetCapitalization.findMany({
				where: scopedWhere,
				include: this.assetCapitalizationInclude,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.assetCapitalization.count({ where: scopedWhere }),
		]);

		return {
			items: items.map(toAssetCapitalizationItem),
			totalCount,
		};
	}

	/**
	 * Finds an AssetDisposal by ID.
	 *
	 * @param id Unique CUID of the disposal
	 * @returns The AssetDisposal domain object
	 */
	async findDisposalById(
		id: string,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDisposal> {
		this.assertOrganizationScope(organizationId);
		const disposal = await this.prisma.assetDisposal.findFirst({
			where: {
				id,
				company: { is: { organizationId } },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			include: this.assetDisposalInclude,
		});
		if (!disposal) {
			throw new NotFoundException(`AssetDisposal ${id} not found.`);
		}
		return toAssetDisposalItem(disposal);
	}

	/**
	 * Lists AssetDisposal records with pagination and filtering.
	 *
	 * @param input List parameters
	 * @returns List result wrapper
	 */
	async listDisposals(
		input: Asset.ListAssetDisposalsInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDisposalListResult> {
		this.assertOrganizationScope(organizationId);
		const where: Prisma.AssetDisposalWhereInput = {
			company: {
				is: {
					organizationId,
					...(input.company ? { name: input.company } : {}),
				},
			},
			asset: { is: assetWhereForOrganization(organizationId) },
		};
		if (input.assetId) {
			where.asset = {
				is: assetWhereForOrganization(organizationId, { id: input.assetId }),
			};
		}
		if (input.disposalType) where.disposalType = input.disposalType;
		if (input.search) {
			where.OR = [
				{ series: { contains: input.search, mode: "insensitive" } },
				{ notes: { contains: input.search, mode: "insensitive" } },
			];
		}

		const take = Math.min(input.take ?? 50, LIST_TAKE_MAX);
		const skip = input.skip ?? 0;

		const [items, totalCount] = await Promise.all([
			this.prisma.assetDisposal.findMany({
				where,
				include: this.assetDisposalInclude,
				orderBy: { createdAt: "desc" },
				take,
				skip,
			}),
			this.prisma.assetDisposal.count({ where }),
		]);

		return {
			items: items.map(toAssetDisposalItem),
			totalCount,
		};
	}
}
