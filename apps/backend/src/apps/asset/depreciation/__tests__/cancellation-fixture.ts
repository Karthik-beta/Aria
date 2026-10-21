import { Prisma } from "../../../../generated/prisma/client";
import type { PrismaService } from "../../../../shared/prisma.service";

const D = (value: number | string) => new Prisma.Decimal(value);
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

interface Book {
	id: string;
	assetId: string;
	openingAccumulatedDepreciation: Prisma.Decimal;
	openingNumberOfBookedDepreciations: number;
	valueAfterDepreciation: Prisma.Decimal;
	totalNumberOfBookedDepreciations: number;
	postingStatus: string;
	lastPostedDepreciationDate: Date | null;
}

interface JournalEntry {
	id: string;
	series: string;
	assetId: string;
	assetFinanceBookId: string;
	financeBookName: string;
	company: string;
	postingDate: Date;
	depreciationAmount: Prisma.Decimal;
	status: "POSTED" | "REVERSED";
	reversedAt: Date | null;
	bookValueAfterDepreciation: Prisma.Decimal;
}

export interface CancellationState {
	asset: {
		id: string;
		series: string;
		status: string;
		netPurchaseAmount: Prisma.Decimal;
		openingAccumulatedDepreciation: Prisma.Decimal;
		valueAfterDepreciation: Prisma.Decimal;
		isFullyDepreciated: boolean;
	};
	books: Book[];
	entries: JournalEntry[];
	schedules: Array<{ id: string; assetId: string; status: string }>;
	activities: Array<{ assetId: string; activity: string }>;
	adjustments: Array<{ assetId: string; status: string }>;
	companies: Array<{ name: string; accountsFrozenThrough: Date | null }>;
	locks: string[];
}

/**
 * Asset `AST-2026-00001` depreciating 100,000 over two finance books:
 * book-1 has two postings (2026-01-31, 2026-02-28), book-2 has one (2026-01-31).
 */
export function createPostedDepreciationState(
	overrides: Partial<CancellationState["asset"]> = {},
): CancellationState {
	const book = (id: string, value: number, booked: number): Book => ({
		id,
		assetId: "asset-1",
		openingAccumulatedDepreciation: D(0),
		openingNumberOfBookedDepreciations: 0,
		valueAfterDepreciation: D(value),
		totalNumberOfBookedDepreciations: booked,
		postingStatus: "PARTIALLY_DEPRECIATED",
		lastPostedDepreciationDate: day("2026-02-28"),
	});
	const entry = (
		n: number,
		bookId: string,
		bookName: string,
		date: string,
		bookValue: number,
	): JournalEntry => ({
		id: `je-${n}`,
		series: `DEP-2026-0000${n}`,
		assetId: "asset-1",
		assetFinanceBookId: bookId,
		financeBookName: bookName,
		company: "ACME",
		postingDate: day(date),
		depreciationAmount: D(10_000),
		status: "POSTED",
		reversedAt: null,
		bookValueAfterDepreciation: D(bookValue),
	});
	return {
		asset: {
			id: "asset-1",
			series: "AST-2026-00001",
			status: "PARTIALLY_DEPRECIATED",
			netPurchaseAmount: D(100_000),
			openingAccumulatedDepreciation: D(0),
			valueAfterDepreciation: D(80_000),
			isFullyDepreciated: false,
			...overrides,
		},
		books: [book("book-1", 80_000, 2), book("book-2", 90_000, 1)],
		entries: [
			entry(1, "book-1", "Statutory", "2026-01-31", 90_000),
			entry(2, "book-1", "Statutory", "2026-02-28", 80_000),
			entry(3, "book-2", "Tax", "2026-01-31", 90_000),
		],
		schedules: [
			{ id: "schedule-1", assetId: "asset-1", status: "ACTIVE" },
			{ id: "schedule-2", assetId: "asset-1", status: "ACTIVE" },
		],
		activities: [],
		adjustments: [],
		companies: [{ name: "ACME", accountsFrozenThrough: null }],
		locks: [],
	};
}

type Where = Record<string, unknown>;

const matchesEntry = (entry: JournalEntry, where: Where): boolean => {
	if (where.assetId !== undefined && entry.assetId !== where.assetId) {
		return false;
	}
	if (
		where.assetFinanceBookId !== undefined &&
		entry.assetFinanceBookId !== where.assetFinanceBookId
	) {
		return false;
	}
	if (where.status !== undefined && entry.status !== where.status) return false;
	const ids = (where.id as { in?: string[] } | undefined)?.in;
	if (ids && !ids.includes(entry.id)) return false;
	const gte = (where.postingDate as { gte?: Date } | undefined)?.gte;
	if (gte && entry.postingDate < gte) return false;
	return true;
};

/** In-memory stand-in for the Prisma tables the cancellation flow touches. */
export function createCancellationPrisma(state: CancellationState) {
	const delegates = {
		asset: {
			findUnique: async ({ where }: { where: { id: string } }) =>
				where.id === state.asset.id ? { ...state.asset } : null,
			update: async ({
				data,
			}: {
				data: Partial<CancellationState["asset"]>;
			}) => {
				Object.assign(state.asset, data);
				return state.asset;
			},
		},
		assetFinanceBook: {
			findMany: async () =>
				[...state.books].sort((a, b) => a.id.localeCompare(b.id)),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Partial<Book>;
			}) => {
				const book = state.books.find((row) => row.id === where.id);
				if (!book) throw new Error(`book ${where.id} missing`);
				Object.assign(book, data);
				return book;
			},
		},
		assetDepreciationJournalEntry: {
			findMany: async ({ where }: { where: Where }) =>
				state.entries
					.filter((entry) => matchesEntry(entry, where))
					.sort(
						(a, b) =>
							a.postingDate.getTime() - b.postingDate.getTime() ||
							a.series.localeCompare(b.series),
					),
			findFirst: async ({ where }: { where: Where }) => {
				const found = state.entries
					.filter((entry) => matchesEntry(entry, where))
					.sort((a, b) => b.postingDate.getTime() - a.postingDate.getTime())[0];
				return found
					? {
							postingDate: found.postingDate,
							scheduleEntry: {
								bookValueAfterDepreciation: found.bookValueAfterDepreciation,
							},
						}
					: null;
			},
			count: async ({ where }: { where: Where }) =>
				state.entries.filter((entry) => matchesEntry(entry, where)).length,
			updateMany: async ({
				where,
				data,
			}: {
				where: Where;
				data: Partial<JournalEntry>;
			}) => {
				const rows = state.entries.filter((entry) =>
					matchesEntry(entry, where),
				);
				for (const row of rows) Object.assign(row, data);
				return { count: rows.length };
			},
		},
		company: {
			findMany: async ({ where }: { where: { name: { in: string[] } } }) =>
				state.companies.filter((company) =>
					where.name.in.includes(company.name),
				),
		},
		assetActivity: {
			create: async ({
				data,
			}: {
				data: { assetId: string; activity: string };
			}) => {
				state.activities.push(data);
				return data;
			},
			createMany: async ({
				data,
			}: {
				data: Array<{ assetId: string; activity: string }>;
			}) => {
				state.activities.push(...data);
				return { count: data.length };
			},
		},
		assetDepreciationSchedule: {
			updateMany: async ({
				where,
				data,
			}: {
				where: { assetId: string; status: { in: string[] } };
				data: { status: string };
			}) => {
				const rows = state.schedules.filter(
					(row) =>
						row.assetId === where.assetId &&
						where.status.in.includes(row.status),
				);
				for (const row of rows) Object.assign(row, data);
				return { count: rows.length };
			},
		},
		assetValueAdjustment: {
			count: async ({
				where,
			}: {
				where: { assetId: string; status: string };
			}) =>
				state.adjustments.filter(
					(row) => row.assetId === where.assetId && row.status === where.status,
				).length,
		},
		$queryRaw: async (query: { values?: unknown[] }) => {
			state.locks.push(String(query.values?.[0]));
			return [{ locked: true }];
		},
	};

	const prisma = {
		...delegates,
		$transaction: async <T>(callback: (tx: typeof delegates) => Promise<T>) =>
			callback(delegates),
	};
	return prisma as unknown as PrismaService & typeof prisma;
}

/** JSON snapshot of the data (not the advisory locks) used to prove a rejected cancellation changed nothing. */
export const snapshotState = (state: CancellationState): string =>
	JSON.stringify({ ...state, locks: undefined });
