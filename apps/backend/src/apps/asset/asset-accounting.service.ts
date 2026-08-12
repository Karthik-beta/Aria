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
	sourceType: AssetAccountingSourceType;
	sourceId: string;
	postingDate: Date;
	remarks: string;
	lines: readonly AssetAccountingLineInput[];
}

export interface AssetAccountingEntryResult {
	id: string;
	series: string;
	status: "POSTED" | "REVERSED";
}

const roundAmount = (amount: number): number =>
	Number(amount.toFixed(AMOUNT_SCALE));

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
		input: CreateAssetAccountingEntryInput,
	): Promise<AssetAccountingEntryResult> {
		const companyId = input.companyId.trim();
		const sourceId = input.sourceId.trim();
		const remarks = input.remarks.trim();
		if (!companyId || !sourceId || !remarks) {
			throw new BadRequestException(
				"Company ID, source document, and remarks are required for asset accounting",
			);
		}
		if (Number.isNaN(input.postingDate.getTime())) {
			throw new BadRequestException("A valid posting date is required");
		}
		if (input.lines.length < 2) {
			throw new BadRequestException(
				"An asset accounting entry requires at least two lines",
			);
		}

		const lines = input.lines.map((line) => {
			const account = line.account.trim();
			const debitAmount = roundAmount(line.debitAmount);
			const creditAmount = roundAmount(line.creditAmount);
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
		);
		const totalCredit = roundAmount(
			lines.reduce((total, line) => total + line.creditAmount, 0),
		);
		if (totalDebit <= 0 || totalDebit !== totalCredit) {
			throw new BadRequestException(
				`Asset accounting entry is not balanced (debit ${totalDebit}, credit ${totalCredit})`,
			);
		}

		const companyRecord = await tx.company.findUnique({
			where: { id: companyId },
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
		if (
			companyRecord.accountsFrozenThrough &&
			input.postingDate <= companyRecord.accountsFrozenThrough
		) {
			throw new BadRequestException(
				`Asset accounting is frozen through ${companyRecord.accountsFrozenThrough.toISOString().slice(0, 10)}`,
			);
		}

		const existing = await tx.assetAccountingEntry.findUnique({
			where: {
				sourceType_sourceId: {
					sourceType: input.sourceType,
					sourceId,
				},
			},
			select: { id: true, series: true, status: true },
		});
		if (existing?.status === "POSTED") return existing;
		if (existing) {
			throw new ConflictException(
				`Asset accounting for ${input.sourceType} ${sourceId} was already reversed`,
			);
		}

		const year = input.postingDate.getUTCFullYear();
		const prefix = `AAE-${year}-`;
		const lastEntry = await tx.assetAccountingEntry.findFirst({
			where: { series: { startsWith: prefix } },
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
				sourceType: input.sourceType,
				sourceId,
				postingDate: input.postingDate,
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
		entryId: string,
	): Promise<void> {
		const existing = await tx.assetAccountingEntry.findUnique({
			where: { id: entryId },
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
		const company = await tx.company.findUnique({
			where: { id: existing.companyId },
			select: { accountsFrozenThrough: true },
		});
		if (!company) {
			throw new BadRequestException(
				`Company ${existing.company.name} is missing`,
			);
		}
		if (
			company.accountsFrozenThrough &&
			existing.postingDate <= company.accountsFrozenThrough
		) {
			throw new BadRequestException(
				`Asset accounting is frozen through ${company.accountsFrozenThrough.toISOString().slice(0, 10)}`,
			);
		}

		const reversedAt = new Date();
		const result = await tx.assetAccountingEntry.updateMany({
			where: { id: entryId, status: "POSTED" },
			data: { status: "REVERSED", reversedAt },
		});
		if (result.count === 1) return;

		const current = await tx.assetAccountingEntry.findUnique({
			where: { id: entryId },
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
