import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import { ASSET_MAINTENANCE_ELIGIBLE_STATUSES } from "../asset-status";
import {
	AssetStatusService,
	type AssetStatusTransaction,
} from "../asset-status.service";

interface FakeBook {
	financeBookId: string;
	valueAfterDepreciation: number;
	expectedValueAfterUsefulLife: number;
}

interface FakeAsset {
	id: string;
	status: string;
	company: string;
	calculateDepreciation: boolean;
	isFullyDepreciated: boolean;
	netPurchaseAmount: number;
	valueAfterDepreciation: number;
	maintenanceRequired: boolean;
	disposalDate: Date | null;
	financeBooks: FakeBook[];
}

interface FakeTask {
	assetId: string;
	maintenanceStatus: string;
	nextDueDate: Date | null;
}

const TODAY = new Date("2026-07-10T00:00:00.000Z");
const TOMORROW = new Date("2026-07-11T00:00:00.000Z");

const makeAsset = (overrides: Partial<FakeAsset> = {}): FakeAsset => ({
	id: "asset-1",
	status: "SUBMITTED",
	company: "Acme",
	calculateDepreciation: true,
	isFullyDepreciated: false,
	netPurchaseAmount: 100_000,
	valueAfterDepreciation: 100_000,
	maintenanceRequired: true,
	disposalDate: null,
	financeBooks: [
		{
			financeBookId: "fb-1",
			valueAfterDepreciation: 100_000,
			expectedValueAfterUsefulLife: 10_000,
		},
	],
	...overrides,
});

/** An in-memory stand-in for the Prisma delegates the status engine uses. */
function createFakeDatabase(
	assets: FakeAsset[],
	tasks: FakeTask[] = [],
	company: { defaultFinanceBookId: string | null } | null = {
		defaultFinanceBookId: "fb-1",
	},
) {
	const activities: Array<{ assetId: string; activity: string }> = [];
	const assetUpdate = mock(
		async (args: { where: { id: string }; data: { status: string } }) => {
			const row = assets.find((asset) => asset.id === args.where.id);
			if (row) row.status = args.data.status;
			return row;
		},
	);
	const assetFindMany = mock(
		async (args: {
			where: { status: { in: string[] }; maintenanceRequired: boolean };
			take: number;
			cursor?: { id: string };
		}) => {
			const rows = assets
				.filter(
					(asset) =>
						asset.maintenanceRequired === args.where.maintenanceRequired &&
						asset.disposalDate === null &&
						args.where.status.in.includes(asset.status),
				)
				.sort((a, b) => a.id.localeCompare(b.id));
			const start = args.cursor
				? rows.findIndex((row) => row.id === args.cursor?.id) + 1
				: 0;
			return rows.slice(start, start + args.take).map(({ id }) => ({ id }));
		},
	);
	const taskCount = mock(
		async (args: {
			where: {
				maintenance: { assetId: string };
				maintenanceStatus: { not: string };
				nextDueDate: { gte: Date; lt: Date };
			};
		}) =>
			tasks.filter(
				(task) =>
					task.assetId === args.where.maintenance.assetId &&
					task.maintenanceStatus !== args.where.maintenanceStatus.not &&
					task.nextDueDate !== null &&
					task.nextDueDate >= args.where.nextDueDate.gte &&
					task.nextDueDate < args.where.nextDueDate.lt,
			).length,
	);
	const tx = {
		asset: {
			findUnique: mock(async (args: { where: { id: string } }) => {
				const row = assets.find((asset) => asset.id === args.where.id);
				return row ? { ...row } : null;
			}),
			findMany: assetFindMany,
			update: assetUpdate,
		},
		assetActivity: {
			create: mock(
				async (args: { data: { assetId: string; activity: string } }) => {
					activities.push(args.data);
					return args.data;
				},
			),
		},
		assetMaintenanceTask: { count: taskCount },
		company: { findUnique: mock(async () => company) },
	};
	const prisma = {
		...tx,
		$transaction: mock(async (callback: (t: typeof tx) => Promise<unknown>) =>
			callback(tx),
		),
	};
	const service = new AssetStatusService(prisma as unknown as PrismaService);
	return { service, tx, prisma, assets, activities, assetUpdate, taskCount };
}

const asTx = (tx: unknown) => tx as AssetStatusTransaction;

describe("AssetStatusService.refreshStatus", () => {
	it("writes nothing when the derived status is unchanged", async () => {
		const db = createFakeDatabase([makeAsset({ maintenanceRequired: false })]);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1");
		expect(result).toEqual({ status: "SUBMITTED", changed: false });
		expect(db.assetUpdate).not.toHaveBeenCalled();
		expect(db.activities).toHaveLength(0);
	});

	it("derives Partially Depreciated from the default finance book and logs the change", async () => {
		const db = createFakeDatabase([
			makeAsset({
				maintenanceRequired: false,
				financeBooks: [
					{
						financeBookId: "fb-1",
						valueAfterDepreciation: 75_000,
						expectedValueAfterUsefulLife: 10_000,
					},
				],
			}),
		]);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1");
		expect(result).toEqual({ status: "PARTIALLY_DEPRECIATED", changed: true });
		expect(db.assetUpdate).toHaveBeenCalledTimes(1);
		expect(db.assets[0].status).toBe("PARTIALLY_DEPRECIATED");
		expect(db.activities).toEqual([
			{
				assetId: "asset-1",
				activity: "Status changed from Submitted to Partially Depreciated",
			},
		]);
	});

	it("uses the company default finance book rather than the first one", async () => {
		const db = createFakeDatabase(
			[
				makeAsset({
					maintenanceRequired: false,
					financeBooks: [
						{
							financeBookId: "fb-tax",
							valueAfterDepreciation: 10_000,
							expectedValueAfterUsefulLife: 10_000,
						},
						{
							financeBookId: "fb-1",
							valueAfterDepreciation: 100_000,
							expectedValueAfterUsefulLife: 10_000,
						},
					],
				}),
			],
			[],
			{ defaultFinanceBookId: "fb-1" },
		);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1");
		expect(result.status).toBe("SUBMITTED");
	});

	it("falls back to the first finance book when the company has no default", async () => {
		const db = createFakeDatabase(
			[
				makeAsset({
					maintenanceRequired: false,
					financeBooks: [
						{
							financeBookId: "fb-tax",
							valueAfterDepreciation: 10_000,
							expectedValueAfterUsefulLife: 10_000,
						},
					],
				}),
			],
			[],
			{ defaultFinanceBookId: null },
		);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1");
		expect(result.status).toBe("FULLY_DEPRECIATED");
	});

	it("moves a maintenance-required asset with a task due today to In Maintenance", async () => {
		const db = createFakeDatabase(
			[makeAsset()],
			[
				{
					assetId: "asset-1",
					maintenanceStatus: "PLANNED",
					nextDueDate: TODAY,
				},
			],
		);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1", {
			asOf: TODAY,
		});
		expect(result).toEqual({ status: "IN_MAINTENANCE", changed: true });
		expect(db.activities[0]?.activity).toBe(
			"Status changed from Submitted to In Maintenance",
		);
	});

	it("matches a due date that carries a time of day", async () => {
		const db = createFakeDatabase(
			[makeAsset()],
			[
				{
					assetId: "asset-1",
					maintenanceStatus: "OVERDUE",
					nextDueDate: new Date("2026-07-10T18:30:00.000Z"),
				},
			],
		);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1", {
			asOf: TODAY,
		});
		expect(result.status).toBe("IN_MAINTENANCE");
	});

	it("ignores cancelled tasks", async () => {
		const db = createFakeDatabase(
			[makeAsset()],
			[
				{
					assetId: "asset-1",
					maintenanceStatus: "CANCELLED",
					nextDueDate: TODAY,
				},
			],
		);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1", {
			asOf: TODAY,
		});
		expect(result.status).toBe("SUBMITTED");
	});

	it("restores the derived status of an In Maintenance asset once nothing is due", async () => {
		const db = createFakeDatabase(
			[
				makeAsset({
					status: "IN_MAINTENANCE",
					financeBooks: [
						{
							financeBookId: "fb-1",
							valueAfterDepreciation: 60_000,
							expectedValueAfterUsefulLife: 10_000,
						},
					],
				}),
			],
			[
				{
					assetId: "asset-1",
					maintenanceStatus: "PLANNED",
					nextDueDate: TOMORROW,
				},
			],
		);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1", {
			asOf: TODAY,
		});
		expect(result).toEqual({ status: "PARTIALLY_DEPRECIATED", changed: true });
		expect(db.activities[0]?.activity).toBe(
			"Status changed from In Maintenance to Partially Depreciated",
		);
	});

	it("restores an In Maintenance asset that no longer requires maintenance", async () => {
		const db = createFakeDatabase([
			makeAsset({ status: "IN_MAINTENANCE", maintenanceRequired: false }),
		]);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1");
		expect(result.status).toBe("SUBMITTED");
		expect(db.taskCount).not.toHaveBeenCalled();
	});

	it("lets a pending repair win over a task due today", async () => {
		const db = createFakeDatabase(
			[makeAsset()],
			[
				{
					assetId: "asset-1",
					maintenanceStatus: "PLANNED",
					nextDueDate: TODAY,
				},
			],
		);
		db.service.hasPendingRepair = mock(async () => true);
		const result = await db.service.refreshStatus(asTx(db.tx), "asset-1", {
			asOf: TODAY,
		});
		expect(result.status).toBe("OUT_OF_ORDER");
	});

	it("reports no pending repair until Asset Repair exists", async () => {
		const db = createFakeDatabase([makeAsset()]);
		expect(await db.service.hasPendingRepair("asset-1")).toBe(false);
	});

	for (const status of ["DRAFT", "CANCELLED", "SOLD", "SCRAPPED"] as const) {
		it(`never changes a ${status} asset`, async () => {
			const db = createFakeDatabase(
				[makeAsset({ status })],
				[
					{
						assetId: "asset-1",
						maintenanceStatus: "PLANNED",
						nextDueDate: TODAY,
					},
				],
			);
			const result = await db.service.refreshStatus(asTx(db.tx), "asset-1", {
				asOf: TODAY,
			});
			expect(result).toEqual({ status, changed: false });
			expect(db.assetUpdate).not.toHaveBeenCalled();
		});
	}

	it("does nothing for an unknown asset", async () => {
		const db = createFakeDatabase([]);
		const result = await db.service.refreshStatus(asTx(db.tx), "missing");
		expect(result.changed).toBe(false);
		expect(db.assetUpdate).not.toHaveBeenCalled();
	});
});

describe("AssetStatusService.updateMaintenanceStatuses", () => {
	const dueToday = (assetId: string): FakeTask => ({
		assetId,
		maintenanceStatus: "PLANNED",
		nextDueDate: TODAY,
	});

	it("moves an asset with a task due today to In Maintenance and reverts it the next day", async () => {
		const db = createFakeDatabase([makeAsset()], [dueToday("asset-1")]);

		expect(await db.service.updateMaintenanceStatuses(TODAY)).toEqual({
			examined: 1,
			changed: 1,
		});
		expect(db.assets[0].status).toBe("IN_MAINTENANCE");

		expect(await db.service.updateMaintenanceStatuses(TOMORROW)).toEqual({
			examined: 1,
			changed: 1,
		});
		expect(db.assets[0].status).toBe("SUBMITTED");

		expect(await db.service.updateMaintenanceStatuses(TOMORROW)).toEqual({
			examined: 1,
			changed: 0,
		});
	});

	it("only examines submitted-family assets that require maintenance and are not disposed", async () => {
		const db = createFakeDatabase(
			[
				makeAsset({ id: "a-ok" }),
				makeAsset({ id: "a-sold", status: "SOLD" }),
				makeAsset({ id: "a-scrapped", status: "SCRAPPED" }),
				makeAsset({ id: "a-draft", status: "DRAFT" }),
				makeAsset({ id: "a-cancelled", status: "CANCELLED" }),
				makeAsset({ id: "a-no-maint", maintenanceRequired: false }),
				makeAsset({ id: "a-disposed", disposalDate: TODAY }),
			],
			[
				dueToday("a-ok"),
				dueToday("a-sold"),
				dueToday("a-scrapped"),
				dueToday("a-draft"),
				dueToday("a-cancelled"),
				dueToday("a-no-maint"),
				dueToday("a-disposed"),
			],
		);
		const result = await db.service.updateMaintenanceStatuses(TODAY);
		expect(result).toEqual({ examined: 1, changed: 1 });
		const statuses = Object.fromEntries(
			db.assets.map((asset) => [asset.id, asset.status]),
		);
		expect(statuses).toEqual({
			"a-ok": "IN_MAINTENANCE",
			"a-sold": "SOLD",
			"a-scrapped": "SCRAPPED",
			"a-draft": "DRAFT",
			"a-cancelled": "CANCELLED",
			"a-no-maint": "SUBMITTED",
			"a-disposed": "SUBMITTED",
		});
		const where = (
			db.tx.asset.findMany.mock.calls[0][0] as {
				where: { status: { in: string[] } };
			}
		).where;
		expect(where.status.in.sort()).toEqual(
			[...ASSET_MAINTENANCE_ELIGIBLE_STATUSES].sort(),
		);
	});

	it("covers fully depreciated assets and restores them afterwards", async () => {
		const db = createFakeDatabase(
			[
				makeAsset({
					status: "FULLY_DEPRECIATED",
					financeBooks: [
						{
							financeBookId: "fb-1",
							valueAfterDepreciation: 10_000,
							expectedValueAfterUsefulLife: 10_000,
						},
					],
				}),
			],
			[dueToday("asset-1")],
		);
		await db.service.updateMaintenanceStatuses(TODAY);
		expect(db.assets[0].status).toBe("IN_MAINTENANCE");
		await db.service.updateMaintenanceStatuses(TOMORROW);
		expect(db.assets[0].status).toBe("FULLY_DEPRECIATED");
	});

	it("pages through more assets than one page and counts each", async () => {
		const assets = Array.from({ length: 250 }, (_, index) =>
			makeAsset({ id: `asset-${String(index).padStart(3, "0")}` }),
		);
		const tasks = assets.map((asset) => dueToday(asset.id));
		const db = createFakeDatabase(assets, tasks);
		const result = await db.service.updateMaintenanceStatuses(TODAY);
		expect(result).toEqual({ examined: 250, changed: 250 });
		expect(db.tx.asset.findMany).toHaveBeenCalledTimes(3);
	});

	it("keeps going when one asset fails", async () => {
		const db = createFakeDatabase(
			[makeAsset({ id: "a-1" }), makeAsset({ id: "a-2" })],
			[dueToday("a-1"), dueToday("a-2")],
		);
		const original = db.tx.asset.update.getMockImplementation();
		db.tx.asset.update.mockImplementation(async (args) => {
			if (args.where.id === "a-1") throw new Error("boom");
			return original?.(args);
		});
		const result = await db.service.updateMaintenanceStatuses(TODAY);
		expect(result).toEqual({ examined: 2, changed: 1 });
		expect(db.assets.find((asset) => asset.id === "a-2")?.status).toBe(
			"IN_MAINTENANCE",
		);
	});
});
