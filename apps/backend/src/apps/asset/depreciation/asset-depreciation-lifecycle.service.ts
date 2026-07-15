import type { Asset } from "@aria/types";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../../shared/prisma.service";
import {
	buildDepreciationSchedule,
	type DepreciationBookInput,
} from "./depreciation-schedule-engine";

const BACKFILL_PAGE_SIZE = 100;

const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

type BookConfiguration = Asset.AssetFinanceBookInput;

/**
 * Owns depreciation-book and schedule generation during the asset lifecycle.
 * Discovery invokes only the backfill entry point before looking for due rows;
 * all amounts are calculated and persisted here, never in the scheduler.
 */
@Injectable()
export class AssetDepreciationLifecycleService {
	private readonly logger = new Logger(AssetDepreciationLifecycleService.name);

	constructor(private readonly prisma: PrismaService) {}

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
			await tx.asset.update({
				where: { id: assetId },
				data: { status: "SUBMITTED" },
			});
			await tx.assetActivity.create({
				data: { assetId, activity: "Asset submitted for depreciation" },
			});
		});
	}

	/** Cancels an unposted asset and makes every open schedule immutable. */
	async cancelAsset(assetId: string): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const posted = await tx.assetDepreciationJournalEntry.count({
				where: { assetId, status: "POSTED" },
			});
			if (posted > 0) {
				throw new BadRequestException(
					"Posted depreciation must be reversed before cancelling the asset",
				);
			}
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
							select: { id: true },
							take: 1,
						},
					},
				});
				if (existing?.schedules.length) continue;

				const schedule = this.calculateSchedule(asset, configuration);
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
								configuration.rateOfDepreciation == null
									? null
									: new Prisma.Decimal(configuration.rateOfDepreciation),
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

				await tx.assetDepreciationSchedule.create({
					data: {
						assetId,
						assetFinanceBookId: book.id,
						revisionNumber: 1,
						status: asset.status === "DRAFT" ? "DRAFT" : "ACTIVE",
						startDate: configuration.depreciationStartDate,
						depreciationMethod: configuration.depreciationMethod,
						totalNumberOfDepreciations:
							configuration.totalNumberOfDepreciations,
						frequencyOfDepreciation: configuration.frequencyOfDepreciation,
						dailyProrataBased: configuration.dailyProrataBased ?? false,
						shiftBased: configuration.shiftBased ?? false,
						rateOfDepreciation: configuration.rateOfDepreciation,
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
					},
				});
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
						status: { in: ["SUBMITTED", "PARTIALLY_DEPRECIATED"] },
						calculateDepreciation: true,
					},
					schedules: { none: { status: { in: ["DRAFT", "ACTIVE"] } } },
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
