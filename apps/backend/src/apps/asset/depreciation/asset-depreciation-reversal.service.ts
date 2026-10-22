/**
 * Reversal of posted asset depreciation.
 *
 * Business rules are ported from ERPNext (GPLv3, `erpnext/assets`):
 * - `doctype/asset/asset.py`: `Asset.on_cancel`, `Asset.delete_depreciation_entries`
 *   (every posted depreciation journal entry of the asset is cancelled and the
 *   carrying value goes back to `net_purchase_amount - opening_accumulated_depreciation`).
 * - `doctype/asset_depreciation_schedule/asset_depreciation_schedule.py`:
 *   `cancel_depreciation_entries`.
 * - Cancelling a journal entry is refused inside the accounts frozen period,
 *   mirrored here by `Company.accountsFrozenThrough`.
 *
 * Aria keeps depreciation journal entries as local rows (no GL yet), so a
 * reversal flips the row to `REVERSED` in place instead of inserting a mirror
 * entry; this is the same approach used when cancelling a revaluation.
 *
 * @module AssetDepreciationReversalService
 */
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { getOpeningAssetValue } from "../asset-service.shared";
import { normalizeDateOnly } from "./depreciation.config";

/** Client able to read posted depreciation (a transaction or the Prisma service). */
export type DepreciationReversalReader = Pick<
	Prisma.TransactionClient,
	"asset" | "assetDepreciationJournalEntry" | "company"
>;

export interface PostedDepreciationEntry {
	id: string;
	series: string;
	assetFinanceBookId: string;
	financeBookName: string;
	company: string;
	postingDate: Date;
	depreciationAmount: Prisma.Decimal;
}

export interface ReversePostedDepreciationOptions {
	/** Only reverse entries posted on or after this date (used by disposal). */
	onOrAfter?: Date;
}

export interface ReversePostedDepreciationResult {
	reversed: PostedDepreciationEntry[];
}

@Injectable()
export class AssetDepreciationReversalService {
	/** Loads the asset's POSTED depreciation entries, oldest first. */
	async loadPostedEntries(
		reader: DepreciationReversalReader,
		assetId: string,
		options: ReversePostedDepreciationOptions = {},
	): Promise<PostedDepreciationEntry[]> {
		return reader.assetDepreciationJournalEntry.findMany({
			where: {
				assetId,
				status: "POSTED",
				...(options.onOrAfter
					? { postingDate: { gte: options.onOrAfter } }
					: {}),
			},
			select: {
				id: true,
				series: true,
				assetFinanceBookId: true,
				financeBookName: true,
				company: true,
				postingDate: true,
				depreciationAmount: true,
			},
			orderBy: [{ postingDate: "asc" }, { series: "asc" }],
		});
	}

	/**
	 * Returns a user-facing message when any entry sits inside a company's
	 * frozen period, otherwise null. Dates are compared as date-only values.
	 */
	async findFrozenPeriodBlocker(
		reader: DepreciationReversalReader,
		assetSeries: string,
		entries: readonly PostedDepreciationEntry[],
	): Promise<string | null> {
		if (entries.length === 0) return null;
		const companyNames = [...new Set(entries.map((entry) => entry.company))];
		const companies = await reader.company.findMany({
			where: { name: { in: companyNames } },
			select: { name: true, accountsFrozenThrough: true },
		});
		const frozenThrough = new Map(
			companies.map((company) => [
				company.name,
				company.accountsFrozenThrough
					? normalizeDateOnly(company.accountsFrozenThrough)
					: null,
			]),
		);
		for (const entry of entries) {
			const frozen = frozenThrough.get(entry.company);
			if (frozen && normalizeDateOnly(entry.postingDate) <= frozen) {
				return `Accounting is frozen through ${frozen} for ${entry.company}. Depreciation posted on or before that date cannot be reversed, so asset ${assetSeries} cannot be cancelled.`;
			}
		}
		return null;
	}

	/**
	 * Reverses the asset's posted depreciation inside the caller's transaction.
	 *
	 * All-or-nothing: a frozen-period entry aborts before anything is written.
	 * The advisory lock per finance book is the one the posting worker takes, so
	 * a reversal can not interleave with a posting for the same book. Schedule
	 * entries keep `postingId`/`postedAt` as an audit trail; the caller is
	 * expected to cancel the schedule in the same transaction.
	 */
	async reversePostedDepreciation(
		tx: Prisma.TransactionClient,
		assetId: string,
		options: ReversePostedDepreciationOptions = {},
	): Promise<ReversePostedDepreciationResult> {
		const asset = await tx.asset.findUnique({
			where: { id: assetId },
			select: {
				series: true,
				netPurchaseAmount: true,
				openingAccumulatedDepreciation: true,
			},
		});
		if (!asset) throw new NotFoundException(`Asset ${assetId} not found`);

		const books = await tx.assetFinanceBook.findMany({
			where: { assetId },
			select: {
				id: true,
				openingAccumulatedDepreciation: true,
				openingNumberOfBookedDepreciations: true,
			},
			orderBy: { id: "asc" },
		});
		// Sorted ids give every caller the same lock order.
		for (const book of books) {
			await tx.$queryRaw(Prisma.sql`
				SELECT pg_advisory_xact_lock(hashtext(${book.id})) IS NULL AS "locked"
			`);
		}

		const entries = await this.loadPostedEntries(tx, assetId, options);
		if (entries.length === 0) return { reversed: [] };

		const blocker = await this.findFrozenPeriodBlocker(
			tx,
			asset.series,
			entries,
		);
		if (blocker) throw new BadRequestException(blocker);

		const now = new Date();
		const updated = await tx.assetDepreciationJournalEntry.updateMany({
			where: { id: { in: entries.map((entry) => entry.id) }, status: "POSTED" },
			data: { status: "REVERSED", reversedAt: now },
		});
		if (updated.count !== entries.length) {
			throw new BadRequestException(
				`Depreciation for asset ${asset.series} changed while it was being reversed. Please try again.`,
			);
		}

		const affectedBookIds = new Set(entries.map((e) => e.assetFinanceBookId));
		for (const book of books) {
			if (!affectedBookIds.has(book.id)) continue;
			await this.resetFinanceBook(tx, book, asset.netPurchaseAmount);
		}

		const remaining = await tx.assetDepreciationJournalEntry.count({
			where: { assetId, status: "POSTED" },
		});
		if (remaining === 0) {
			const openingValue = getOpeningAssetValue(
				Number(asset.netPurchaseAmount),
				Number(asset.openingAccumulatedDepreciation),
			);
			await tx.asset.update({
				where: { id: assetId },
				data: {
					valueAfterDepreciation: new Prisma.Decimal(openingValue),
					// The pre-depreciation flag is not stored; it is derived the same way
					// `createAsset` does when no explicit value is given.
					isFullyDepreciated: openingValue <= 0,
				},
			});
		}

		await tx.assetActivity.createMany({
			data: entries.map((entry) => ({
				assetId,
				activity: `Depreciation ${entry.series} reversed for ${normalizeDateOnly(entry.postingDate)} in ${entry.financeBookName}.`,
			})),
		});
		return { reversed: entries };
	}

	/**
	 * Puts a finance book cursor back to its state before the reversed entries.
	 * With no POSTED entry left the book returns to its opening position
	 * (`net purchase - opening accumulated depreciation`, as in `configureAssetBooks`);
	 * otherwise it is recomputed from the latest remaining posting.
	 */
	private async resetFinanceBook(
		tx: Prisma.TransactionClient,
		book: {
			id: string;
			openingAccumulatedDepreciation: Prisma.Decimal;
			openingNumberOfBookedDepreciations: number;
		},
		netPurchaseAmount: Prisma.Decimal,
	): Promise<void> {
		const latest = await tx.assetDepreciationJournalEntry.findFirst({
			where: { assetFinanceBookId: book.id, status: "POSTED" },
			orderBy: { postingDate: "desc" },
			select: {
				postingDate: true,
				scheduleEntry: { select: { bookValueAfterDepreciation: true } },
			},
		});
		if (!latest) {
			await tx.assetFinanceBook.update({
				where: { id: book.id },
				data: {
					valueAfterDepreciation: new Prisma.Decimal(netPurchaseAmount).minus(
						book.openingAccumulatedDepreciation,
					),
					totalNumberOfBookedDepreciations:
						book.openingNumberOfBookedDepreciations,
					postingStatus: "PENDING",
					lastPostedDepreciationDate: null,
				},
			});
			return;
		}
		const booked = await tx.assetDepreciationJournalEntry.count({
			where: { assetFinanceBookId: book.id, status: "POSTED" },
		});
		await tx.assetFinanceBook.update({
			where: { id: book.id },
			data: {
				...(latest.scheduleEntry
					? {
							valueAfterDepreciation:
								latest.scheduleEntry.bookValueAfterDepreciation,
						}
					: {}),
				totalNumberOfBookedDepreciations: booked,
				postingStatus: "PARTIALLY_DEPRECIATED",
				lastPostedDepreciationDate: latest.postingDate,
			},
		});
	}
}
