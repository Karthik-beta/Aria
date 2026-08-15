import type { DateOnlyInput } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import {
	allocateDocumentSeries,
	getSeriesSeedValue,
} from "../../shared/document-series";
import {
	type AssetOrganizationId,
	assertAssetOrganizationId,
	assetWhereForOrganization,
	companyWhereForOrganization,
} from "./asset-organization-scope";
import {
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	normalizeDateOnly,
} from "./depreciation/depreciation.config";

const AMOUNT_SCALE = 6;

export type AssetAccountingSourceType =
	| "CAPITALIZATION"
	| "CWIP_CAPITALIZATION"
	| "DISPOSAL"
	| "REPAIR";

export interface AssetAccountingLineInput {
	account: string;
	debitAmount: number;
	creditAmount: number;
	costCenter?: string | null;
}

export interface CreateAssetAccountingEntryInput {
	companyId: string;
	assetId?: string | null;
	/** The finance book whose asset state this entry consumes, when applicable. */
	financeBookId?: string | null;
	/** Currency precision captured from the selected depreciation book. */
	precision?: number;
	sourceType: AssetAccountingSourceType;
	sourceId: string;
	postingDate: DateOnlyInput;
	remarks: string;
	lines: readonly AssetAccountingLineInput[];
}

export interface AssetAccountingEntryResult {
	id: string;
	series: string;
	status: "POSTED" | "REVERSED";
}

const roundAmount = (amount: number, scale: number): number =>
	Number(amount.toFixed(scale));

/**
 * Posts balanced, reversible entries to Aria's Asset-domain subledger.
 *
 * This service deliberately does not call these rows general-ledger entries:
 * Aria has no shared chart-of-accounts or statutory GL subsystem. Account names
 * are the configured Asset-domain labels already used by depreciation.
 */
@Injectable()
export class AssetAccountingService {
	async createPostedEntry(
		tx: Prisma.TransactionClient,
		organizationId: AssetOrganizationId,
		input: CreateAssetAccountingEntryInput,
	): Promise<AssetAccountingEntryResult> {
		assertAssetOrganizationId(organizationId);
		const postingDate = dateOnlyUtc(normalizeDateOnly(input.postingDate));
		const companyId = input.companyId.trim();
		const sourceId = input.sourceId.trim();
		const remarks = input.remarks.trim();
		if (!companyId || !sourceId || !remarks) {
			throw new BadRequestException(
				"Company ID, source document, and remarks are required for asset accounting",
			);
		}
		if (input.lines.length < 2) {
			throw new BadRequestException(
				"An asset accounting entry requires at least two lines",
			);
		}
		const amountScale = input.precision ?? AMOUNT_SCALE;
		if (!Number.isInteger(amountScale) || amountScale < 0 || amountScale > 6) {
			throw new BadRequestException(
				"Asset accounting precision must be an integer between zero and 6",
			);
		}

		const lines = input.lines.map((line) => {
			const account = line.account.trim();
			const debitAmount = roundAmount(line.debitAmount, amountScale);
			const creditAmount = roundAmount(line.creditAmount, amountScale);
			if (!account) {
				throw new BadRequestException(
					"Every asset accounting line requires an account label",
				);
			}
			if (
				!Number.isFinite(debitAmount) ||
				!Number.isFinite(creditAmount) ||
				debitAmount < 0 ||
				creditAmount < 0
			) {
				throw new BadRequestException(
					`Asset accounting amounts for ${account} must be finite and non-negative`,
				);
			}
			if (debitAmount > 0 === creditAmount > 0) {
				throw new BadRequestException(
					`Asset accounting line ${account} must contain exactly one non-zero debit or credit`,
				);
			}
			return {
				lineType: debitAmount > 0 ? ("DEBIT" as const) : ("CREDIT" as const),
				account,
				debitAmount,
				creditAmount,
				costCenter: line.costCenter?.trim() || null,
			};
		});

		const totalDebit = roundAmount(
			lines.reduce((total, line) => total + line.debitAmount, 0),
			amountScale,
		);
		const totalCredit = roundAmount(
			lines.reduce((total, line) => total + line.creditAmount, 0),
			amountScale,
		);
		if (totalDebit <= 0 || totalDebit !== totalCredit) {
			throw new BadRequestException(
				`Asset accounting entry is not balanced (debit ${totalDebit}, credit ${totalCredit})`,
			);
		}

		const companyRecord = await tx.company.findFirst({
			where: companyWhereForOrganization(organizationId, { id: companyId }),
			select: {
				id: true,
				name: true,
				disabled: true,
				accountsFrozenThrough: true,
			},
		});
		if (!companyRecord || companyRecord.disabled) {
			throw new BadRequestException(
				`Company ${companyId} is missing or disabled`,
			);
		}
		if (input.assetId) {
			const asset = await tx.asset.findFirst({
				where: assetWhereForOrganization(organizationId, {
					id: input.assetId,
					companyId: companyRecord.id,
				}),
				select: { id: true },
			});
			if (!asset) {
				throw new NotFoundException(
					`Asset ${input.assetId} is not available in the active organization`,
				);
			}
		}
		const financeBookId = input.financeBookId?.trim() || null;
		if (financeBookId) {
			const financeBook = await tx.financeBook.findUnique({
				where: { id: financeBookId },
				select: { id: true },
			});
			if (!financeBook) {
				throw new BadRequestException(
					`Finance book ${financeBookId} does not exist`,
				);
			}
			if (input.assetId) {
				const assetBook = await tx.assetFinanceBook.findFirst({
					where: {
						assetId: input.assetId,
						financeBookId,
						asset: {
							is: assetWhereForOrganization(organizationId, {
								companyId: companyRecord.id,
							}),
						},
					},
					select: { id: true },
				});
				if (!assetBook) {
					throw new BadRequestException(
						`Finance book ${financeBookId} is not configured for asset ${input.assetId}`,
					);
				}
			}
		}
		if (
			companyRecord.accountsFrozenThrough &&
			dateOnlyFromPersistedDateTime(postingDate) <=
				dateOnlyFromPersistedDateTime(companyRecord.accountsFrozenThrough)
		) {
			throw new BadRequestException(
				`Asset accounting is frozen through ${dateOnlyFromPersistedDateTime(companyRecord.accountsFrozenThrough)}`,
			);
		}

		const scopedAssetRelation = input.assetId
			? {
					asset: {
						is: assetWhereForOrganization(organizationId, {
							id: input.assetId,
							companyId: companyRecord.id,
						}),
					},
				}
			: {
					OR: [
						{ assetId: null },
						{ asset: { is: assetWhereForOrganization(organizationId) } },
					],
				};
		const existing = await tx.assetAccountingEntry.findFirst({
			where: {
				AND: [
					{ sourceType: input.sourceType, sourceId },
					{ company: { is: { organizationId } } },
					scopedAssetRelation,
				],
			},
			select: { id: true, series: true, status: true },
		});
		if (existing?.status === "POSTED") return existing;
		if (existing) {
			throw new ConflictException(
				`Asset accounting for ${input.sourceType} ${sourceId} was already reversed`,
			);
		}

		const year = dateOnlyFromPersistedDateTime(postingDate).slice(0, 4);
		const prefix = `AAE-${year}-`;
		const lastEntry = await tx.assetAccountingEntry.findFirst({
			where: {
				AND: [
					{ series: { startsWith: prefix } },
					{ company: { is: { organizationId } } },
					scopedAssetRelation,
				],
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});
		const series = await allocateDocumentSeries(
			tx,
			prefix,
			5,
			getSeriesSeedValue(prefix, lastEntry?.series),
		);

		return tx.assetAccountingEntry.create({
			data: {
				series,
				companyId: companyRecord.id,
				assetId: input.assetId ?? null,
				financeBookId,
				sourceType: input.sourceType,
				sourceId,
				postingDate,
				remarks,
				status: "POSTED",
				lines: {
					create: lines.map((line) => ({
						...line,
						debitAmount: new Prisma.Decimal(line.debitAmount),
						creditAmount: new Prisma.Decimal(line.creditAmount),
					})),
				},
			},
			select: { id: true, series: true, status: true },
		});
	}

	async reversePostedEntry(
		tx: Prisma.TransactionClient,
		organizationId: AssetOrganizationId,
		entryId: string,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		const existing = await tx.assetAccountingEntry.findFirst({
			where: {
				AND: [
					{ id: entryId },
					{ company: { is: { organizationId } } },
					{
						OR: [
							{ assetId: null },
							{ asset: { is: assetWhereForOrganization(organizationId) } },
						],
					},
				],
			},
			select: {
				status: true,
				companyId: true,
				company: { select: { name: true } },
				postingDate: true,
			},
		});
		if (!existing) {
			throw new NotFoundException(
				`Asset accounting entry ${entryId} not found`,
			);
		}
		if (existing.status === "REVERSED") return;
		if (existing.status !== "POSTED") {
			throw new ConflictException(
				`Asset accounting entry ${entryId} cannot be reversed from ${existing.status}`,
			);
		}
		const company = await tx.company.findFirst({
			where: companyWhereForOrganization(organizationId, {
				id: existing.companyId,
			}),
			select: { accountsFrozenThrough: true },
		});
		if (!company) {
			throw new BadRequestException(
				`Company ${existing.company.name} is missing`,
			);
		}
		if (
			company.accountsFrozenThrough &&
			dateOnlyFromPersistedDateTime(existing.postingDate) <=
				dateOnlyFromPersistedDateTime(company.accountsFrozenThrough)
		) {
			throw new BadRequestException(
				`Asset accounting is frozen through ${dateOnlyFromPersistedDateTime(company.accountsFrozenThrough)}`,
			);
		}

		const reversedAt = new Date();
		const result = await tx.assetAccountingEntry.updateMany({
			where: {
				AND: [
					{ id: entryId, status: "POSTED" },
					{ company: { is: { organizationId } } },
					{
						OR: [
							{ assetId: null },
							{ asset: { is: assetWhereForOrganization(organizationId) } },
						],
					},
				],
			},
			data: { status: "REVERSED", reversedAt },
		});
		if (result.count === 1) return;

		const current = await tx.assetAccountingEntry.findFirst({
			where: {
				AND: [
					{ id: entryId },
					{ company: { is: { organizationId } } },
					{
						OR: [
							{ assetId: null },
							{ asset: { is: assetWhereForOrganization(organizationId) } },
						],
					},
				],
			},
			select: { status: true },
		});
		if (!current) {
			throw new NotFoundException(
				`Asset accounting entry ${entryId} not found`,
			);
		}
		if (current.status === "REVERSED") return;
		throw new ConflictException(
			`Asset accounting entry ${entryId} cannot be reversed from ${current.status}`,
		);
	}
}
