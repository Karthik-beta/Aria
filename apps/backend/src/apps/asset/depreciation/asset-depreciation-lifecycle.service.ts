import type { Asset } from "@aria/types";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	type AssetOrganizationId,
	assertAssetOrganizationId,
	assetWhereForOrganization,
} from "../asset-organization-scope";
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
	async submitAsset(
		assetId: string,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		await this.configureAssetBooks(assetId, undefined, organizationId);
		await this.prisma.$transaction(async (tx) => {
			const asset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, { id: assetId }),
				select: {
					status: true,
					calculateDepreciation: true,
					_count: { select: { financeBooks: true } },
				},
			});
			if (!asset) {
				throw new BadRequestException(
					"Asset is not available in the active organization",
				);
			}
			if (asset.status !== "DRAFT") {
				throw new BadRequestException("Only draft assets can be submitted");
			}
			if (asset.calculateDepreciation && asset._count.financeBooks === 0) {
				throw new BadRequestException(
					"At least one finance book is required for a depreciable asset",
				);
			}
			await tx.assetDepreciationSchedule.updateMany({
				where: {
					assetId,
					status: "DRAFT",
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "ACTIVE" },
			});
			const transitioned = await tx.asset.updateMany({
				where: assetWhereForOrganization(organizationId, {
					id: assetId,
					status: "DRAFT",
				}),
				data: { status: "SUBMITTED" },
			});
			if (transitioned.count !== 1) {
				throw new BadRequestException("Only draft assets can be submitted");
			}
			await tx.assetActivity.create({
				data: {
					assetId,
					activity: "Asset submitted for depreciation",
					userId: actorId ?? null,
				},
			});
		});
	}

	/** Cancels an unposted asset and makes every open schedule immutable. */
	async cancelAsset(
		assetId: string,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		await this.prisma.$transaction(async (tx) => {
			const posted = await tx.assetDepreciationJournalEntry.count({
				where: {
					assetId,
					status: "POSTED",
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			});
			if (posted > 0) {
				throw new BadRequestException(
					"Posted depreciation must be reversed before cancelling the asset",
				);
			}
			await tx.assetDepreciationSchedule.updateMany({
				where: {
					assetId,
					status: { in: ["DRAFT", "ACTIVE"] },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "CANCELLED" },
			});
			const transitioned = await tx.asset.updateMany({
				where: assetWhereForOrganization(organizationId, { id: assetId }),
				data: { status: "CANCELLED" },
			});
			if (transitioned.count !== 1) {
				throw new BadRequestException(
					"Asset is not available in the active organization",
				);
			}
			await tx.assetActivity.create({
				data: {
					assetId,
					activity: "Asset cancelled",
					userId: actorId ?? null,
				},
			});
		});
	}

	/** Replaces draft book configuration and generates immutable schedule rows. */
	async configureAssetBooks(
		assetId: string,
		books: readonly BookConfiguration[] | undefined,
		organizationId: AssetOrganizationId,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		const asset = await this.loadAsset(assetId, organizationId);
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
			const ownedAsset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, { id: assetId }),
				select: { id: true },
			});
			if (!ownedAsset) {
				throw new BadRequestException(
					"Asset is not available in the active organization",
				);
			}
			if (books !== undefined) {
				const postedCount = await tx.assetDepreciationJournalEntry.count({
					where: {
						assetId,
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				});
				if (postedCount > 0) {
					throw new BadRequestException(
						"Posted depreciation exists; use a supported rescheduling or value-adjustment workflow",
					);
				}
				await tx.assetDepreciationSchedule.deleteMany({
					where: {
						assetId,
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				});
				await tx.assetFinanceBook.deleteMany({
					where: {
						assetId,
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				});
			}

			for (const configuration of configurations) {
				const existing = await tx.assetFinanceBook.findFirst({
					where: {
						assetId,
						financeBookId: configuration.financeBookId,
						asset: { is: assetWhereForOrganization(organizationId) },
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
					const updatedBook = await tx.assetFinanceBook.updateMany({
						where: {
							id: existing.id,
							asset: { is: assetWhereForOrganization(organizationId) },
						},
						data: { rateOfDepreciation: new Prisma.Decimal(effectiveRate) },
					});
					if (updatedBook.count !== 1) {
						throw new BadRequestException(
							"Asset finance book is not available in the active organization",
						);
					}
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
						where: {
							id: existingSchedule.id,
							asset: { is: assetWhereForOrganization(organizationId) },
						},
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
						status: { in: ["SUBMITTED", "PARTIALLY_DEPRECIATED"] },
						calculateDepreciation: true,
					},
					schedules: {
						none: {
							status: { in: ["DRAFT", "ACTIVE"] },
							entries: { some: {} },
						},
					},
				},
				select: {
					id: true,
					assetId: true,
					asset: { select: { company: { select: { organizationId: true } } } },
				},
				orderBy: { id: "asc" },
				take: BACKFILL_PAGE_SIZE,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			});
			if (books.length === 0) break;
			for (const book of books) {
				await this.configureAssetBooks(
					book.assetId,
					undefined,
					book.asset.company.organizationId,
				);
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

		const financeBookId = asset.company.defaultFinanceBookId;
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

	private async loadAsset(
		assetId: string,
		organizationId: AssetOrganizationId,
	) {
		const asset = await this.prisma.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			include: {
				company: { select: { defaultFinanceBookId: true } },
				assetCategory: { include: { financeBookDefaults: true } },
				financeBooks: true,
			},
		});
		if (!asset) {
			throw new BadRequestException(
				"Asset is not available in the active organization",
			);
		}
		return {
			...asset,
			netPurchaseAmount: Number(asset.netPurchaseAmount),
		};
	}
}
