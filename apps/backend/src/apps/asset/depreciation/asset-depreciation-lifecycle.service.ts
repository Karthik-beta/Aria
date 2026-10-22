import type { Asset } from "@aria/types";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	ASSET_DEPRECIATING_STATUSES,
	ASSET_OPERATIONAL_STATUSES,
	assetStatusLabel,
	deriveAssetStatus,
} from "../asset-status";
import { loadAssetStatusInputs } from "../asset-status.service";
import { AssetDepreciationReversalService } from "./asset-depreciation-reversal.service";
import {
	buildDepreciationSchedule,
	type DepreciationBookInput,
} from "./depreciation-schedule-engine";

const BACKFILL_PAGE_SIZE = 100;

const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

/** Statuses an asset can be cancelled from (ERPNext `validate_cancellation`). */
const CANCELLABLE_STATUSES = [
	"SUBMITTED",
	"PARTIALLY_DEPRECIATED",
	"FULLY_DEPRECIATED",
];
const CANCELLATION_PREVIEW_ENTRY_LIMIT = 200;
const ACTIVE_MAINTENANCE_STATUSES: readonly string[] =
	ASSET_OPERATIONAL_STATUSES;
const SUBMITTED_ADJUSTMENT_BLOCKER =
	"Cancel the submitted asset value adjustments first";

type BookConfiguration = Asset.AssetFinanceBookInput;

/**
 * Owns depreciation-book and schedule generation during the asset lifecycle.
 * Discovery invokes only the backfill entry point before looking for due rows;
 * all amounts are calculated and persisted here, never in the scheduler.
 */
@Injectable()
export class AssetDepreciationLifecycleService {
	private readonly logger = new Logger(AssetDepreciationLifecycleService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly reversal: AssetDepreciationReversalService = new AssetDepreciationReversalService(),
	) {}

	/** Activates draft schedules as part of explicit asset submission. */
	async submitAsset(assetId: string): Promise<void> {
		await this.configureAssetBooks(assetId);
		await this.prisma.$transaction(async (tx) => {
			const asset = await tx.asset.findUniqueOrThrow({
				where: { id: assetId },
				select: {
					status: true,
					calculateDepreciation: true,
					_count: { select: { financeBooks: true } },
				},
			});
			if (asset.status !== "DRAFT") {
				throw new BadRequestException("Only draft assets can be submitted");
			}
			if (asset.calculateDepreciation && asset._count.financeBooks === 0) {
				throw new BadRequestException(
					"At least one finance book is required for a depreciable asset",
				);
			}
			await tx.assetDepreciationSchedule.updateMany({
				where: { assetId, status: "DRAFT" },
				data: { status: "ACTIVE" },
			});
			const inputs = await loadAssetStatusInputs(tx, assetId);
			await tx.asset.update({
				where: { id: assetId },
				data: {
					status: inputs
						? deriveAssetStatus({
								...inputs.derive,
								currentStatus: "SUBMITTED",
							})
						: "SUBMITTED",
				},
			});
			await tx.assetActivity.create({
				data: { assetId, activity: "Asset submitted for depreciation" },
			});
		});
	}

	/**
	 * Cancels a submitted asset (ERPNext `Asset.on_cancel`): reverses posted
	 * depreciation, cancels open schedules and marks the asset cancelled, all in
	 * one transaction.
	 */
	async cancelAsset(assetId: string): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const asset = await tx.asset.findUnique({
				where: { id: assetId },
				select: { id: true, status: true },
			});
			if (!asset) throw new NotFoundException(`Asset ${assetId} not found`);
			await this.assertCancellable(tx, asset);

			// TODO: cancel submitted asset movements here (ERPNext
			// `cancel_movement_entries`) once asset movements exist.
			await this.reversal.reversePostedDepreciation(tx, assetId);

			await tx.assetDepreciationSchedule.updateMany({
				where: { assetId, status: { in: ["DRAFT", "ACTIVE"] } },
				data: { status: "CANCELLED" },
			});
			await tx.asset.update({
				where: { id: assetId },
				data: { status: "CANCELLED" },
			});
			await tx.assetActivity.create({
				data: { assetId, activity: "Asset cancelled" },
			});
		});
	}

	/**
	 * Read-only preview of `cancelAsset`: applies the same guards (including the
	 * frozen-period check) and lists the depreciation that would be reversed.
	 */
	async getCancellationPreview(
		assetId: string,
	): Promise<Asset.AssetCancellationPreview> {
		const asset = await this.prisma.asset.findUnique({
			where: { id: assetId },
			select: { id: true, series: true, status: true },
		});
		if (!asset) throw new NotFoundException(`Asset ${assetId} not found`);

		const blockers = await this.collectCancellationBlockers(this.prisma, asset);
		const entries = await this.reversal.loadPostedEntries(this.prisma, assetId);
		const frozenBlocker = await this.reversal.findFrozenPeriodBlocker(
			this.prisma,
			asset.series,
			entries,
		);
		if (frozenBlocker) blockers.push(frozenBlocker);

		const total = entries.reduce(
			(sum, entry) => sum.plus(entry.depreciationAmount),
			new Prisma.Decimal(0),
		);
		const latest = entries.at(-1);
		return {
			canCancel: blockers.length === 0,
			blockers,
			postedEntryCount: entries.length,
			postedDepreciationTotal: total.toNumber(),
			latestPostingDate: latest ? dateOnly(latest.postingDate) : null,
			entries: entries
				.slice(0, CANCELLATION_PREVIEW_ENTRY_LIMIT)
				.map((entry) => ({
					series: entry.series,
					postingDate: dateOnly(entry.postingDate),
					depreciationAmount: entry.depreciationAmount.toNumber(),
					financeBookName: entry.financeBookName,
				})),
		};
	}

	/** Throws the first cancellation blocker that does not need posted entries. */
	private async assertCancellable(
		reader: Pick<Prisma.TransactionClient, "assetValueAdjustment">,
		asset: { id: string; status: string },
	): Promise<void> {
		const [blocker] = await this.collectCancellationBlockers(reader, asset);
		if (blocker) throw new BadRequestException(blocker);
	}

	/**
	 * Status and linked-document guards shared by `cancelAsset` and the
	 * cancellation preview, so both always agree.
	 */
	async collectCancellationBlockers(
		reader: Pick<Prisma.TransactionClient, "assetValueAdjustment">,
		asset: { id: string; status: string },
	): Promise<string[]> {
		const blockers: string[] = [];
		if (ACTIVE_MAINTENANCE_STATUSES.includes(asset.status)) {
			blockers.push(
				"There are active maintenance or repairs against the asset. You must complete all of them before cancelling the asset.",
			);
		} else if (!CANCELLABLE_STATUSES.includes(asset.status)) {
			blockers.push(
				`Asset cannot be cancelled, as it is already ${assetStatusLabel(asset.status as Asset.AssetStatus)}`,
			);
		}
		const submittedAdjustments = await reader.assetValueAdjustment.count({
			where: { assetId: asset.id, status: "SUBMITTED" },
		});
		if (submittedAdjustments > 0) {
			blockers.push(SUBMITTED_ADJUSTMENT_BLOCKER);
		}
		return blockers;
	}

	/** Replaces draft book configuration and generates immutable schedule rows. */
	async configureAssetBooks(
		assetId: string,
		books?: readonly BookConfiguration[],
	): Promise<void> {
		const asset = await this.loadAsset(assetId);
		const configurations = books?.length
			? [...books]
			: this.resolveDefaultBooks(asset);

		if (!asset.calculateDepreciation) return;
		if (configurations.length === 0) {
			if (asset.status !== "DRAFT") {
				throw new BadRequestException(
					"A default finance book and depreciation configuration are required before submitting this asset",
				);
			}
			return;
		}

		const duplicateBook = configurations.find(
			(book, index) =>
				configurations.findIndex(
					(candidate) => candidate.financeBookId === book.financeBookId,
				) !== index,
		);
		if (duplicateBook) {
			throw new BadRequestException(
				`Finance book ${duplicateBook.financeBookId} is configured more than once`,
			);
		}

		await this.prisma.$transaction(async (tx) => {
			if (books !== undefined) {
				const postedCount = await tx.assetDepreciationJournalEntry.count({
					where: { assetId },
				});
				if (postedCount > 0) {
					throw new BadRequestException(
						"Posted depreciation exists; use a supported rescheduling or value-adjustment workflow",
					);
				}
				await tx.assetDepreciationSchedule.deleteMany({ where: { assetId } });
				await tx.assetFinanceBook.deleteMany({ where: { assetId } });
			}

			for (const configuration of configurations) {
				const existing = await tx.assetFinanceBook.findUnique({
					where: {
						assetId_financeBookId: {
							assetId,
							financeBookId: configuration.financeBookId,
						},
					},
					include: {
						schedules: {
							where: { status: { in: ["DRAFT", "ACTIVE"] } },
							select: {
								id: true,
								revisionNumber: true,
								_count: { select: { entries: true } },
							},
							take: 1,
						},
					},
				});
				const existingSchedule = existing?.schedules[0];
				if ((existingSchedule?._count.entries ?? 0) > 0) continue;

				const schedule = this.calculateSchedule(asset, configuration);
				const effectiveRate = schedule.ratePercent;
				const carryingValue =
					asset.netPurchaseAmount -
					(configuration.openingAccumulatedDepreciation ?? 0);
				const book =
					existing ??
					(await tx.assetFinanceBook.create({
						data: {
							assetId,
							financeBookId: configuration.financeBookId,
							depreciationMethod: configuration.depreciationMethod,
							totalNumberOfDepreciations:
								configuration.totalNumberOfDepreciations,
							frequencyOfDepreciation: configuration.frequencyOfDepreciation,
							dailyProrataBased: configuration.dailyProrataBased ?? false,
							shiftBased: configuration.shiftBased ?? false,
							rateOfDepreciation:
								effectiveRate == null
									? null
									: new Prisma.Decimal(effectiveRate),
							expectedValueAfterUsefulLife: new Prisma.Decimal(
								configuration.expectedValueAfterUsefulLife ?? 0,
							),
							depreciationStartDate: configuration.depreciationStartDate,
							openingAccumulatedDepreciation: new Prisma.Decimal(
								configuration.openingAccumulatedDepreciation ?? 0,
							),
							openingNumberOfBookedDepreciations:
								configuration.openingNumberOfBookedDepreciations ?? 0,
							valueAfterDepreciation: new Prisma.Decimal(carryingValue),
							totalNumberOfBookedDepreciations:
								configuration.openingNumberOfBookedDepreciations ?? 0,
							postingStatus:
								(configuration.openingNumberOfBookedDepreciations ?? 0) > 0
									? "PARTIALLY_DEPRECIATED"
									: "PENDING",
						},
					}));

				if (
					existing &&
					effectiveRate != null &&
					(existing.rateOfDepreciation == null ||
						Number(existing.rateOfDepreciation) !== effectiveRate)
				) {
					await tx.assetFinanceBook.update({
						where: { id: existing.id },
						data: { rateOfDepreciation: new Prisma.Decimal(effectiveRate) },
					});
				}

				const scheduleData: Prisma.AssetDepreciationScheduleUncheckedCreateInput =
					{
						assetId,
						assetFinanceBookId: book.id,
						revisionNumber: existingSchedule?.revisionNumber ?? 1,
						status: asset.status === "DRAFT" ? "DRAFT" : "ACTIVE",
						startDate: configuration.depreciationStartDate,
						depreciationMethod: configuration.depreciationMethod,
						totalNumberOfDepreciations:
							configuration.totalNumberOfDepreciations,
						frequencyOfDepreciation: configuration.frequencyOfDepreciation,
						dailyProrataBased: configuration.dailyProrataBased ?? false,
						shiftBased: configuration.shiftBased ?? false,
						rateOfDepreciation: effectiveRate,
						expectedValueAfterUsefulLife:
							configuration.expectedValueAfterUsefulLife ?? 0,
						bookedDepreciations:
							configuration.openingNumberOfBookedDepreciations ?? 0,
						remainingDepreciations: schedule.entries.length,
						openingAccumulatedDepreciation:
							configuration.openingAccumulatedDepreciation ?? 0,
						baseAssetValue: asset.netPurchaseAmount,
						notes: "ERPNext-aligned base depreciation schedule",
						entries: {
							create: schedule.entries.map((entry) => ({
								sequence: entry.periodNumber,
								scheduleDate: new Date(`${entry.date}T00:00:00.000Z`),
								depreciationAmount: entry.depreciationAmount,
								accumulatedDepreciationAmount: entry.accumulatedDepreciation,
								bookValueAfterDepreciation: entry.bookValueAfterDepreciation,
							})),
						},
					};
				if (existingSchedule) {
					await tx.assetDepreciationSchedule.update({
						where: { id: existingSchedule.id },
						data: scheduleData,
					});
				} else {
					await tx.assetDepreciationSchedule.create({ data: scheduleData });
				}
			}
		});
	}

	/** Generates missing base schedules for migrated submitted assets in pages. */
	async ensureSubmittedSchedules(): Promise<number> {
		let cursor: string | undefined;
		let generated = 0;
		for (;;) {
			const books = await this.prisma.assetFinanceBook.findMany({
				where: {
					asset: {
						status: { in: [...ASSET_DEPRECIATING_STATUSES] },
						calculateDepreciation: true,
					},
					schedules: {
						none: {
							status: { in: ["DRAFT", "ACTIVE"] },
							entries: { some: {} },
						},
					},
				},
				select: { id: true, assetId: true },
				orderBy: { id: "asc" },
				take: BACKFILL_PAGE_SIZE,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			});
			if (books.length === 0) break;
			for (const book of books) {
				await this.configureAssetBooks(book.assetId);
				generated += 1;
			}
			cursor = books.at(-1)?.id;
		}
		if (generated > 0) {
			this.logger.log(`Generated ${generated} missing depreciation schedules`);
		}
		return generated;
	}

	private calculateSchedule(
		asset: Awaited<ReturnType<AssetDepreciationLifecycleService["loadAsset"]>>,
		book: BookConfiguration,
	) {
		const input: DepreciationBookInput = {
			financeBookId: book.financeBookId,
			method: book.depreciationMethod,
			grossBookValue: asset.netPurchaseAmount,
			availableForUseDate: dateOnly(
				asset.availableForUseDate ?? asset.purchaseDate,
			),
			depreciationStartDate: dateOnly(book.depreciationStartDate),
			totalPeriods: book.totalNumberOfDepreciations,
			frequencyMonths: book.frequencyOfDepreciation,
			salvageValue: book.expectedValueAfterUsefulLife ?? 0,
			openingBookedPeriods: book.openingNumberOfBookedDepreciations ?? 0,
			openingAccumulatedDepreciation: book.openingAccumulatedDepreciation ?? 0,
			ratePercent: book.rateOfDepreciation ?? undefined,
			dailyProrata: book.dailyProrataBased ?? false,
			manualEntries: book.manualEntries?.map((entry) => ({
				date: dateOnly(entry.date),
				amount: entry.amount,
				shift: entry.shift,
			})),
		};
		return buildDepreciationSchedule(input);
	}

	private resolveDefaultBooks(
		asset: Awaited<ReturnType<AssetDepreciationLifecycleService["loadAsset"]>>,
	): BookConfiguration[] {
		if (asset.financeBooks.length) {
			return asset.financeBooks.map((book) => ({
				financeBookId: book.financeBookId,
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
			}));
		}

		if (asset.assetCategory?.financeBookDefaults.length) {
			return asset.assetCategory.financeBookDefaults.map((book) => ({
				financeBookId: book.financeBookId,
				depreciationMethod: book.depreciationMethod as Asset.DepreciationMethod,
				totalNumberOfDepreciations: book.totalNumberOfDepreciations,
				frequencyOfDepreciation: book.frequencyOfDepreciation,
				depreciationStartDate:
					asset.depreciationStartDate ??
					asset.availableForUseDate ??
					asset.purchaseDate,
				dailyProrataBased: book.dailyProrataBased,
				shiftBased: book.shiftBased,
				rateOfDepreciation:
					book.rateOfDepreciation == null
						? null
						: Number(book.rateOfDepreciation),
				expectedValueAfterUsefulLife:
					book.expectedValueAfterUsefulLife == null
						? null
						: Number(book.expectedValueAfterUsefulLife),
				openingAccumulatedDepreciation: Number(
					asset.openingAccumulatedDepreciation,
				),
				openingNumberOfBookedDepreciations:
					asset.openingNumberOfBookedDepreciations,
			}));
		}

		const financeBookId = asset.companyRecord?.defaultFinanceBookId;
		const method =
			asset.depreciationMethod ?? asset.assetCategory?.depreciationMethod;
		const total =
			asset.totalNumberOfDepreciations ??
			asset.assetCategory?.totalNumberOfDepreciations;
		const frequency =
			asset.frequencyOfDepreciation ??
			asset.assetCategory?.frequencyOfDepreciation;
		if (!financeBookId || !method || !total || !frequency) return [];
		return [
			{
				financeBookId,
				depreciationMethod: method as Asset.DepreciationMethod,
				totalNumberOfDepreciations: total,
				frequencyOfDepreciation: frequency,
				depreciationStartDate:
					asset.depreciationStartDate ??
					asset.availableForUseDate ??
					asset.purchaseDate,
				dailyProrataBased: asset.assetCategory?.dailyProrataBased ?? false,
				shiftBased: asset.assetCategory?.shiftBased ?? false,
				rateOfDepreciation: asset.assetCategory?.rateOfDepreciation ?? null,
				expectedValueAfterUsefulLife:
					asset.expectedValueAfterUsefulLife == null
						? 0
						: Number(asset.expectedValueAfterUsefulLife),
				openingAccumulatedDepreciation: Number(
					asset.openingAccumulatedDepreciation,
				),
				openingNumberOfBookedDepreciations:
					asset.openingNumberOfBookedDepreciations,
			},
		];
	}

	private async loadAsset(assetId: string) {
		const asset = await this.prisma.asset.findUniqueOrThrow({
			where: { id: assetId },
			include: {
				assetCategory: { include: { financeBookDefaults: true } },
				financeBooks: true,
			},
		});
		const companyRecord = await this.prisma.company.findUnique({
			where: { name: asset.company },
			select: { defaultFinanceBookId: true },
		});
		return {
			...asset,
			netPurchaseAmount: Number(asset.netPurchaseAmount),
			companyRecord,
		};
	}
}
