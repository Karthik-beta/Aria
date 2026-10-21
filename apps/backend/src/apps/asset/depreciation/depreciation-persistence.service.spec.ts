import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import type { DepreciationJobData } from "./depreciation.types";
import {
	DepreciationPersistenceService,
	DepreciationPostingValidationError,
} from "./depreciation-persistence.service";

const DATE = new Date("2026-07-05T00:00:00.000Z");

interface Fixture {
	entry: Record<string, unknown> | null;
	company: Record<string, unknown> | null;
	categoryAccounts: Record<string, unknown> | null;
	existingJournal: { id: string; status?: string } | null;
	earlier: { id: string } | null;
	remaining: number;
	booked: number;
	seriesRows: unknown;
}

function makeEntry(overrides: {
	asset?: Record<string, unknown>;
	schedule?: Record<string, unknown>;
	[key: string]: unknown;
}) {
	const { asset, schedule, ...rest } = overrides;
	return {
		id: "entry-1",
		scheduleId: "sched-1",
		scheduleDate: DATE,
		depreciationAmount: 100,
		bookValueAfterDepreciation: 900,
		postingId: null,
		schedule: {
			id: "sched-1",
			status: "ACTIVE",
			assetId: "asset-1",
			assetFinanceBookId: "afb-1",
			asset: {
				id: "asset-1",
				series: "AST-0001",
				assetName: "Laptop",
				assetCategoryId: "cat-1",
				company: "Acme",
				calculateDepreciation: true,
				status: "SUBMITTED",
				...asset,
			},
			assetFinanceBook: {
				id: "afb-1",
				financeBookId: "fb-1",
				financeBook: { name: "Statutory" },
			},
			...schedule,
		},
		...rest,
	};
}

function makeCompany(overrides: Record<string, unknown> = {}) {
	return {
		id: "co-1",
		name: "Acme",
		defaultFinanceBookId: "fb-1",
		depreciationEntrySeries: null,
		defaultCostCenter: "CC-Main",
		accumulatedDepreciationAccount: "Co Accum",
		depreciationExpenseAccount: "Co Expense",
		accountsFrozenThrough: null,
		...overrides,
	};
}

const job: DepreciationJobData = {
	version: 1,
	assetId: "asset-1",
	assetFinanceBookId: "afb-1",
	scheduleId: "sched-1",
	scheduleEntryId: "entry-1",
	depreciationDate: "2026-07-05",
} as DepreciationJobData;

function setup(overrides: Partial<Fixture> = {}) {
	const fixture: Fixture = {
		entry: makeEntry({}),
		company: makeCompany(),
		categoryAccounts: null,
		existingJournal: null,
		earlier: null,
		remaining: 3,
		booked: 1,
		seriesRows: [{ value: 1 }],
		...overrides,
	};
	const seriesKeys: unknown[] = [];
	const entryDelegate = {
		findUnique: mock((_args?: unknown) => Promise.resolve(fixture.entry)),
		findFirst: mock((_args?: unknown) => Promise.resolve(fixture.earlier)),
		findMany: mock((_args?: unknown) => Promise.resolve([] as unknown[])),
		count: mock((args: { where: { postingId: unknown } }) =>
			Promise.resolve(
				args.where.postingId === null ? fixture.remaining : fixture.booked,
			),
		),
		update: mock((_args?: unknown) => Promise.resolve({})),
	};
	const tx = {
		$queryRaw: mock((query: { strings: string[]; values: unknown[] }) => {
			if (query.strings.join("").includes("pg_advisory_xact_lock")) {
				return Promise.resolve([{ locked: true }]);
			}
			seriesKeys.push(query.values[0]);
			return Promise.resolve(fixture.seriesRows);
		}),
		assetDepreciationScheduleEntry: entryDelegate,
		assetDepreciationJournalEntry: {
			findUnique: mock((_args?: unknown) =>
				Promise.resolve(fixture.existingJournal),
			),
			create: mock((_args?: unknown) => Promise.resolve({ id: "journal-1" })),
		},
		company: {
			findUnique: mock((_args?: unknown) => Promise.resolve(fixture.company)),
			findMany: mock((_args?: unknown) => Promise.resolve([] as unknown[])),
		},
		assetCategoryAccount: {
			findUnique: mock((_args?: unknown) =>
				Promise.resolve(fixture.categoryAccounts),
			),
		},
		assetFinanceBook: {
			update: mock((_args?: unknown) => Promise.resolve({})),
		},
		asset: { update: mock((_args?: unknown) => Promise.resolve({})) },
		assetActivity: { create: mock((_args?: unknown) => Promise.resolve({})) },
	};
	const db = {
		...tx,
		$transaction: mock((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
	};
	const service = new DepreciationPersistenceService({
		client: db,
	} as unknown as PrismaService);
	return { service, tx, db, fixture, seriesKeys };
}

type Ctx = ReturnType<typeof setup>;

function expectNoWrites(tx: Ctx["tx"]) {
	expect(tx.assetDepreciationJournalEntry.create).not.toHaveBeenCalled();
	expect(tx.assetDepreciationScheduleEntry.update).not.toHaveBeenCalled();
	expect(tx.assetFinanceBook.update).not.toHaveBeenCalled();
	expect(tx.asset.update).not.toHaveBeenCalled();
	expect(tx.assetActivity.create).not.toHaveBeenCalled();
}

// biome-ignore lint/suspicious/noExplicitAny: test helper reads loosely typed mock call arguments
function arg<T = Record<string, any>>(
	fn: { mock: { calls: unknown[][] } },
	call = 0,
): T {
	return fn.mock.calls[call][0] as T;
}

async function postError(ctx: Ctx, data: DepreciationJobData = job) {
	return ctx.service.post(data).then(
		() => null,
		(error: unknown) => error as Error,
	);
}

describe("DepreciationPersistenceService.post", () => {
	describe("happy path", () => {
		it("creates the journal entry with debit and credit lines and links the schedule entry", async () => {
			const ctx = setup();
			const result = await ctx.service.post(job);

			expect(result).toEqual({ status: "posted", postingId: "journal-1" });
			const data = arg(ctx.tx.assetDepreciationJournalEntry.create).data;
			expect(data).toMatchObject({
				series: "DEP-2026-00001",
				assetId: "asset-1",
				assetFinanceBookId: "afb-1",
				company: "Acme",
				financeBookName: "Statutory",
				postingDate: DATE,
				depreciationAmount: 100,
				remarks: "Depreciation for AST-0001 on 2026-07-05",
				status: "POSTED",
			});
			expect(data.lines.create).toEqual([
				{
					lineType: "DEBIT",
					account: "Co Expense",
					debitAmount: 100,
					creditAmount: 0,
					costCenter: "CC-Main",
				},
				{
					lineType: "CREDIT",
					account: "Co Accum",
					debitAmount: 0,
					creditAmount: 100,
					costCenter: "CC-Main",
				},
			]);
			const link = arg(ctx.tx.assetDepreciationScheduleEntry.update);
			expect(link.where).toEqual({ id: "entry-1" });
			expect(link.data.postingId).toBe("journal-1");
			expect(link.data.postedAt).toBeInstanceOf(Date);
			expect(arg(ctx.tx.assetActivity.create).data).toEqual({
				assetId: "asset-1",
				activity:
					"Depreciation DEP-2026-00001 posted for 2026-07-05 in Statutory.",
			});
		});

		it("takes the advisory lock inside the transaction", async () => {
			const ctx = setup();
			await ctx.service.post(job);
			const first = ctx.tx.$queryRaw.mock.calls[0][0] as {
				strings: string[];
				values: unknown[];
			};
			expect(first.strings.join("")).toContain("pg_advisory_xact_lock");
			expect(first.values).toEqual(["afb-1"]);
		});

		it("allocates from a custom series pattern with .YYYY. and pads to 5 digits", async () => {
			const ctx = setup({
				company: makeCompany({ depreciationEntrySeries: "ACME-DEP-.YYYY.-" }),
				seriesRows: [{ value: 42 }],
			});
			await ctx.service.post(job);
			expect(ctx.seriesKeys).toEqual(["ACME-DEP-2026-"]);
			expect(arg(ctx.tx.assetDepreciationJournalEntry.create).data.series).toBe(
				"ACME-DEP-2026-00042",
			);
		});
	});

	describe("account resolution", () => {
		it("prefers category accounts over company accounts", async () => {
			const ctx = setup({
				categoryAccounts: {
					accumulatedDepreciationAccount: "Cat Accum",
					depreciationExpenseAccount: "Cat Expense",
				},
			});
			await ctx.service.post(job);
			const lines = arg(ctx.tx.assetDepreciationJournalEntry.create).data.lines
				.create;
			expect(lines[0].account).toBe("Cat Expense");
			expect(lines[1].account).toBe("Cat Accum");
			expect(arg(ctx.tx.assetCategoryAccount.findUnique).where).toEqual({
				assetCategoryId_companyId: {
					assetCategoryId: "cat-1",
					companyId: "co-1",
				},
			});
		});

		it("falls back to company accounts when the category has none", async () => {
			const ctx = setup({
				categoryAccounts: {
					accumulatedDepreciationAccount: null,
					depreciationExpenseAccount: null,
				},
			});
			await ctx.service.post(job);
			const lines = arg(ctx.tx.assetDepreciationJournalEntry.create).data.lines
				.create;
			expect(lines[0].account).toBe("Co Expense");
			expect(lines[1].account).toBe("Co Accum");
		});

		it("skips the category lookup when the asset has no category", async () => {
			const ctx = setup({
				entry: makeEntry({ asset: { assetCategoryId: null } }),
			});
			await ctx.service.post(job);
			expect(ctx.tx.assetCategoryAccount.findUnique).not.toHaveBeenCalled();
		});

		it("throws when no accounts are configured at either level", async () => {
			const ctx = setup({
				company: makeCompany({
					accumulatedDepreciationAccount: null,
					depreciationExpenseAccount: null,
				}),
			});
			const error = await postError(ctx);
			expect(error).toBeInstanceOf(DepreciationPostingValidationError);
			expect(error?.message).toBe(
				"Depreciation accounts are not configured for AST-0001.",
			);
			expectNoWrites(ctx.tx);
		});
	});

	describe("idempotency and ordering", () => {
		it("returns already-posted without writes when the entry has a postingId", async () => {
			const ctx = setup({ entry: makeEntry({ postingId: "journal-9" }) });
			expect(await ctx.service.post(job)).toEqual({
				status: "already-posted",
				postingId: "journal-9",
			});
			expectNoWrites(ctx.tx);
		});

		it("links an existing journal entry for the book and date and returns already-posted", async () => {
			const ctx = setup({
				existingJournal: { id: "journal-7", status: "POSTED" },
			});
			expect(await ctx.service.post(job)).toEqual({
				status: "already-posted",
				postingId: "journal-7",
			});
			expect(
				arg(ctx.tx.assetDepreciationJournalEntry.findUnique).where,
			).toEqual({
				assetFinanceBookId_postingDate: {
					assetFinanceBookId: "afb-1",
					postingDate: DATE,
				},
			});
			const link = arg(ctx.tx.assetDepreciationScheduleEntry.update);
			expect(link.data.postingId).toBe("journal-7");
			expect(
				ctx.tx.assetDepreciationJournalEntry.create,
			).not.toHaveBeenCalled();
			expect(ctx.tx.assetActivity.create).not.toHaveBeenCalled();
		});

		it("does not treat a reversed journal entry as already posted", async () => {
			const ctx = setup({
				existingJournal: { id: "reversed-posting", status: "REVERSED" },
			});
			const error = await postError(ctx);
			expect(error).toBeInstanceOf(DepreciationPostingValidationError);
			expect(error?.message).toContain("2026-07-05");
			expect(error?.message).toContain("reversed");
			expectNoWrites(ctx.tx);
		});

		it("selects the status of the existing journal entry", async () => {
			const ctx = setup({ existingJournal: { id: "j", status: "POSTED" } });
			await ctx.service.post(job);
			expect(
				arg(ctx.tx.assetDepreciationJournalEntry.findUnique).select,
			).toEqual({
				id: true,
				status: true,
			});
		});

		it("returns out-of-order when an earlier unposted entry exists", async () => {
			const ctx = setup({ earlier: { id: "entry-0" } });
			expect(await ctx.service.post(job)).toEqual({
				status: "out-of-order",
				earlierScheduleEntryId: "entry-0",
			});
			expectNoWrites(ctx.tx);
			expect(
				arg(ctx.tx.assetDepreciationScheduleEntry.findFirst).where,
			).toEqual({
				postingId: null,
				scheduleDate: { lt: DATE },
				schedule: { status: "ACTIVE", assetFinanceBookId: "afb-1" },
			});
		});
	});

	describe("frozen period", () => {
		it("rejects a schedule date equal to accountsFrozenThrough", async () => {
			const ctx = setup({
				company: makeCompany({ accountsFrozenThrough: DATE }),
			});
			const error = await postError(ctx);
			expect(error).toBeInstanceOf(DepreciationPostingValidationError);
			expect(error?.message).toContain("2026-07-05");
			expect(error?.message).toContain("Acme");
			expectNoWrites(ctx.tx);
		});

		it("rejects a schedule date before accountsFrozenThrough", async () => {
			const ctx = setup({
				company: makeCompany({
					accountsFrozenThrough: new Date("2026-07-06T00:00:00.000Z"),
				}),
			});
			expect(await postError(ctx)).toBeInstanceOf(
				DepreciationPostingValidationError,
			);
		});

		it("allows a schedule date the day after accountsFrozenThrough", async () => {
			const ctx = setup({
				company: makeCompany({
					accountsFrozenThrough: new Date("2026-07-04T00:00:00.000Z"),
				}),
			});
			expect((await ctx.service.post(job)).status).toBe("posted");
		});
	});

	describe("validation failures", () => {
		it("throws for an unknown entry", async () => {
			const ctx = setup({ entry: null });
			const error = await postError(ctx);
			expect(error).toBeInstanceOf(DepreciationPostingValidationError);
			expect(error?.message).toContain("entry-1");
			expectNoWrites(ctx.tx);
		});

		const mismatches: Array<[string, Partial<DepreciationJobData>]> = [
			["scheduleId", { scheduleId: "other" }],
			["assetId", { assetId: "other" }],
			["assetFinanceBookId", { assetFinanceBookId: "other" }],
			["date", { depreciationDate: "2026-07-06" }],
		];
		for (const [label, patch] of mismatches) {
			it(`throws on payload mismatch of ${label}`, async () => {
				const ctx = setup();
				const error = await postError(ctx, { ...job, ...patch });
				expect(error).toBeInstanceOf(DepreciationPostingValidationError);
				expect(error?.message).toContain("does not match");
				expectNoWrites(ctx.tx);
			});
		}

		it("throws for an inactive schedule", async () => {
			const ctx = setup({
				entry: makeEntry({ schedule: { status: "COMPLETED" } }),
			});
			const error = await postError(ctx);
			expect(error).toBeInstanceOf(DepreciationPostingValidationError);
			expect(error?.message).toContain("is not active");
		});

		it("throws for an asset that does not calculate depreciation", async () => {
			const ctx = setup({
				entry: makeEntry({ asset: { calculateDepreciation: false } }),
			});
			const error = await postError(ctx);
			expect(error).toBeInstanceOf(DepreciationPostingValidationError);
			expect(error?.message).toContain("not eligible");
		});

		for (const status of ["DRAFT", "CANCELLED", "SOLD"]) {
			it(`throws for an asset with status ${status}`, async () => {
				const ctx = setup({ entry: makeEntry({ asset: { status } }) });
				const error = await postError(ctx);
				expect(error).toBeInstanceOf(DepreciationPostingValidationError);
				expect(error?.message).toContain("not eligible");
				expectNoWrites(ctx.tx);
			});
		}

		it("accepts a PARTIALLY_DEPRECIATED asset", async () => {
			const ctx = setup({
				entry: makeEntry({ asset: { status: "PARTIALLY_DEPRECIATED" } }),
			});
			expect((await ctx.service.post(job)).status).toBe("posted");
		});

		it("throws for an unknown company", async () => {
			const ctx = setup({ company: null });
			const error = await postError(ctx);
			expect(error).toBeInstanceOf(DepreciationPostingValidationError);
			expect(error?.message).toBe("Company Acme does not exist.");
			expectNoWrites(ctx.tx);
		});
	});

	describe("book and asset updates", () => {
		it("marks a non-final posting PARTIALLY_DEPRECIATED on the book and default-book asset", async () => {
			const ctx = setup({ remaining: 2, booked: 4 });
			await ctx.service.post(job);
			const book = arg(ctx.tx.assetFinanceBook.update);
			expect(book.where).toEqual({ id: "afb-1" });
			expect(book.data).toEqual({
				valueAfterDepreciation: 900,
				totalNumberOfBookedDepreciations: 4,
				postingStatus: "PARTIALLY_DEPRECIATED",
				lastPostedDepreciationDate: DATE,
			});
			expect(arg(ctx.tx.asset.update)).toEqual({
				where: { id: "asset-1" },
				data: {
					valueAfterDepreciation: 900,
					isFullyDepreciated: false,
					status: "PARTIALLY_DEPRECIATED",
				},
			});
		});

		it("marks the final posting FULLY_DEPRECIATED on the book and the default-book asset", async () => {
			const ctx = setup({ remaining: 0, booked: 12 });
			await ctx.service.post(job);
			const book = arg(ctx.tx.assetFinanceBook.update);
			expect(book.data.postingStatus).toBe("FULLY_DEPRECIATED");
			expect(book.data.totalNumberOfBookedDepreciations).toBe(12);
			expect(arg(ctx.tx.asset.update).data).toMatchObject({
				isFullyDepreciated: true,
				status: "FULLY_DEPRECIATED",
			});
		});

		it("does not update the Asset row for a non-default finance book", async () => {
			const ctx = setup({
				company: makeCompany({ defaultFinanceBookId: "fb-other" }),
				remaining: 0,
			});
			await ctx.service.post(job);
			expect(ctx.tx.assetFinanceBook.update).toHaveBeenCalledTimes(1);
			expect(ctx.tx.asset.update).not.toHaveBeenCalled();
		});
	});

	describe("series allocation failure", () => {
		it("throws when no row is returned", async () => {
			const ctx = setup({ seriesRows: [] });
			const error = await postError(ctx);
			expect(error?.message).toBe(
				"Failed to allocate depreciation series DEP-2026-.",
			);
			expectNoWrites(ctx.tx);
		});

		it("throws when the counter is not an integer", async () => {
			const ctx = setup({ seriesRows: [{ value: 1.5 }] });
			expect(await postError(ctx)).toBeInstanceOf(Error);
			expectNoWrites(ctx.tx);
		});
	});
});

describe("DepreciationPersistenceService.pendingPage and pendingSnapshot", () => {
	function pendingRow(id: string, date: string, company = "Acme") {
		return {
			id,
			scheduleDate: new Date(`${date}T00:00:00.000Z`),
			scheduleId: "sched-1",
			schedule: {
				assetId: "asset-1",
				assetFinanceBookId: "afb-1",
				assetFinanceBook: { financeBookId: "fb-1" },
				asset: { company },
			},
		};
	}

	function pendingSetup(
		pages: unknown[][],
		companies: Array<{ name: string; accountsFrozenThrough: Date | null }> = [],
	) {
		const ctx = setup();
		const queue = [...pages];
		ctx.db.assetDepreciationScheduleEntry.findMany.mockImplementation(() =>
			Promise.resolve(queue.shift() ?? []),
		);
		ctx.db.company.findMany.mockImplementation(() =>
			Promise.resolve(companies),
		);
		return ctx;
	}

	it("builds the where clause from the full scope", async () => {
		const ctx = pendingSetup([[]]);
		await ctx.service.pendingPage(
			{
				throughDate: new Date("2026-07-05T13:45:00.000Z"),
				company: "Acme",
				assetIds: ["a1", "a2"],
				financeBookId: "fb-1",
			},
			undefined,
			10,
		);
		const args = arg(ctx.db.assetDepreciationScheduleEntry.findMany);
		expect(args.where).toEqual({
			postingId: null,
			scheduleDate: { lte: DATE },
			schedule: {
				status: "ACTIVE",
				asset: {
					calculateDepreciation: true,
					status: { in: ["SUBMITTED", "PARTIALLY_DEPRECIATED"] },
					company: "Acme",
					id: { in: ["a1", "a2"] },
				},
				assetFinanceBook: { financeBookId: "fb-1" },
			},
		});
		expect(args.take).toBe(10);
		expect(args.orderBy).toEqual([{ scheduleDate: "asc" }, { id: "asc" }]);
		expect(args).not.toHaveProperty("cursor");
		expect(ctx.db.company.findMany).not.toHaveBeenCalled();
	});

	it("omits optional filters when the scope is only a date", async () => {
		const ctx = pendingSetup([[]]);
		await ctx.service.pendingPage({ throughDate: "2026-07-05" }, undefined, 5);
		const { where } = arg(ctx.db.assetDepreciationScheduleEntry.findMany);
		expect(where.schedule.asset).toEqual({
			calculateDepreciation: true,
			status: { in: ["SUBMITTED", "PARTIALLY_DEPRECIATED"] },
		});
		expect(where.schedule.assetFinanceBook).toEqual({});
		expect(where.scheduleDate).toEqual({ lte: DATE });
	});

	it("applies the cursor with skip 1", async () => {
		const ctx = pendingSetup([[]]);
		await ctx.service.pendingPage({ throughDate: DATE }, "entry-5", 5);
		const args = arg(ctx.db.assetDepreciationScheduleEntry.findMany);
		expect(args.cursor).toEqual({ id: "entry-5" });
		expect(args.skip).toBe(1);
	});

	it("maps rows and marks blockedByFreeze for equal, later and unfrozen dates", async () => {
		const ctx = pendingSetup(
			[
				[
					pendingRow("e1", "2026-06-30"),
					pendingRow("e2", "2026-07-05"),
					pendingRow("e3", "2026-07-06"),
					pendingRow("e4", "2026-07-06", "NoFreeze"),
				],
			],
			[
				{ name: "Acme", accountsFrozenThrough: DATE },
				{ name: "NoFreeze", accountsFrozenThrough: null },
			],
		);
		const periods = await ctx.service.pendingPage(
			{ throughDate: "2026-07-31" },
			undefined,
			10,
		);
		expect(periods.map((p) => p.blockedByFreeze)).toEqual([
			true,
			true,
			false,
			false,
		]);
		expect(periods[0]).toEqual({
			assetId: "asset-1",
			assetFinanceBookId: "afb-1",
			financeBookId: "fb-1",
			scheduleId: "sched-1",
			scheduleEntryId: "e1",
			depreciationDate: new Date("2026-06-30T00:00:00.000Z"),
			company: "Acme",
			blockedByFreeze: true,
		});
		expect(arg(ctx.db.company.findMany).where).toEqual({
			name: { in: ["Acme", "NoFreeze"] },
		});
	});

	it("pendingSnapshot pages until a short page and counts frozen periods", async () => {
		const ctx = pendingSetup(
			[
				[pendingRow("e1", "2026-06-01"), pendingRow("e2", "2026-06-15")],
				[pendingRow("e3", "2026-07-01"), pendingRow("e4", "2026-07-10")],
				[pendingRow("e5", "2026-08-01")],
			],
			[
				{
					name: "Acme",
					accountsFrozenThrough: new Date("2026-06-15T00:00:00.000Z"),
				},
			],
		);
		const snapshot = await ctx.service.pendingSnapshot(
			{ throughDate: "2026-12-31" },
			2,
		);
		expect(
			ctx.db.assetDepreciationScheduleEntry.findMany,
		).toHaveBeenCalledTimes(3);
		expect(
			arg(ctx.db.assetDepreciationScheduleEntry.findMany, 1).cursor,
		).toEqual({ id: "e2" });
		expect(
			arg(ctx.db.assetDepreciationScheduleEntry.findMany, 2).cursor,
		).toEqual({ id: "e4" });
		expect(snapshot.periods).toHaveLength(5);
		// e1 and e2 are on or before the 2026-06-15 freeze.
		expect(snapshot.frozen).toBe(2);
		expect(snapshot.oldestUnpostedDate).toEqual(
			new Date("2026-07-01T00:00:00.000Z"),
		);
	});

	it("pendingSnapshot returns null oldest date when nothing is pending or all is frozen", async () => {
		const empty = await pendingSetup([[]]).service.pendingSnapshot(
			{ throughDate: DATE },
			2,
		);
		expect(empty).toEqual({ periods: [], frozen: 0, oldestUnpostedDate: null });

		const frozen = await pendingSetup(
			[[pendingRow("e1", "2026-06-01")]],
			[{ name: "Acme", accountsFrozenThrough: DATE }],
		).service.pendingSnapshot({ throughDate: DATE }, 5);
		expect(frozen.frozen).toBe(1);
		expect(frozen.oldestUnpostedDate).toBeNull();
	});
});
