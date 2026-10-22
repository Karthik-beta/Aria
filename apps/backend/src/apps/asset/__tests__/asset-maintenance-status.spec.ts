import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetMaintenanceService } from "../asset-maintenance.service";
import {
	businessDate,
	dateOnlyUtc,
	depreciationTimeZone,
} from "../depreciation/depreciation.config";
import {
	createFakeDatabase,
	type FakeAsset,
	type FakeTask,
	makeAsset,
} from "./asset-status-fixture";

// The maintenance flows refresh against the current business date.
const businessTimeZone = (): string => {
	try {
		return depreciationTimeZone();
	} catch {
		return "UTC";
	}
};
const TODAY = dateOnlyUtc(businessDate(businessTimeZone()));

/**
 * Maintenance flows against the real status engine: the asset and task rows
 * live in memory, so these tests show the status an asset ends up with.
 */

const partiallyDepreciated = (overrides: Partial<FakeAsset> = {}) =>
	makeAsset({
		financeBooks: [
			{
				financeBookId: "fb-1",
				valueAfterDepreciation: 60_000,
				expectedValueAfterUsefulLife: 10_000,
			},
		],
		...overrides,
	});

function setup(assets: FakeAsset[], tasks: FakeTask[]) {
	const schedules = [{ id: "maint-1", assetId: "asset-1" }];
	const logs = [
		{
			id: "log-1",
			maintenanceId: "maint-1",
			taskId: "task-1",
			maintenanceStatus: "PLANNED",
			maintenance: { assetId: "asset-1" },
		},
	];
	const logUpdate = mock(async (args: { data: Record<string, unknown> }) => ({
		id: "log-1",
		maintenanceId: "maint-1",
		taskId: "task-1",
		...args.data,
	}));
	const db = createFakeDatabase(assets, tasks, undefined, {
		asset: {
			// Lookup used after a schedule is deleted: assets by id and status.
			findMany: mock(
				async (args: { where: { id: { in: string[] }; status: string } }) =>
					assets
						.filter(
							(asset) =>
								args.where.id.in.includes(asset.id) &&
								asset.status === args.where.status,
						)
						.map(({ id }) => ({ id })),
			),
		},
		assetMaintenance: {
			findUnique: mock(async (args: { where: { id: string } }) =>
				schedules.find((row) => row.id === args.where.id),
			),
			findMany: mock(async (args: { where: { id: { in: string[] } } }) =>
				schedules.filter((row) => args.where.id.in.includes(row.id)),
			),
			delete: mock(async (args: { where: { id: string } }) => {
				const index = schedules.findIndex((row) => row.id === args.where.id);
				const [removed] = schedules.splice(index, 1);
				// Deleting the schedule cascades to its tasks.
				for (let i = tasks.length - 1; i >= 0; i -= 1) {
					if (tasks[i].assetId === removed.assetId) tasks.splice(i, 1);
				}
				return removed;
			}),
			deleteMany: mock(async (args: { where: { id: { in: string[] } } }) => {
				let count = 0;
				for (const id of args.where.id.in) {
					const index = schedules.findIndex((row) => row.id === id);
					if (index === -1) continue;
					const [removed] = schedules.splice(index, 1);
					count += 1;
					for (let i = tasks.length - 1; i >= 0; i -= 1) {
						if (tasks[i].assetId === removed.assetId) tasks.splice(i, 1);
					}
				}
				return { count };
			}),
		},
		assetMaintenanceLog: {
			findUnique: mock(async () => logs[0]),
			update: logUpdate,
			create: mock(async () => ({})),
		},
		assetMaintenanceTask: {
			findUniqueOrThrow: mock(async () => ({
				id: "task-1",
				periodicity: "MONTHLY",
				startDate: new Date("2026-01-10T00:00:00.000Z"),
				endDate: null,
			})),
			update: mock(
				async (args: {
					data: { nextDueDate?: Date | null; maintenanceStatus?: string };
				}) => {
					const task = tasks[0];
					if (!task) return {};
					if (args.data.nextDueDate !== undefined) {
						task.nextDueDate = args.data.nextDueDate;
					}
					if (args.data.maintenanceStatus !== undefined) {
						task.maintenanceStatus = args.data.maintenanceStatus;
					}
					return task;
				},
			),
		},
	});
	const service = new AssetMaintenanceService(
		db.prisma as unknown as PrismaService,
		db.service,
	);
	return { service, db, schedules };
}

const dueToday = (): FakeTask => ({
	assetId: "asset-1",
	maintenanceStatus: "PLANNED",
	nextDueDate: TODAY,
});

describe("maintenance flows refresh the asset status", () => {
	it("deleting the schedule of an In Maintenance asset restores its derived status", async () => {
		const { service, db } = setup(
			[partiallyDepreciated({ status: "IN_MAINTENANCE" })],
			[dueToday()],
		);

		await service.deleteAssetMaintenance("maint-1");

		expect(db.assets[0].status).toBe("PARTIALLY_DEPRECIATED");
		expect(db.activities.at(-1)?.activity).toBe(
			"Status changed from In Maintenance to Partially Depreciated",
		);
	});

	it("deleting a schedule leaves an asset that is not In Maintenance alone", async () => {
		const { service, db } = setup(
			[partiallyDepreciated({ status: "SUBMITTED" })],
			[dueToday()],
		);

		await service.deleteAssetMaintenance("maint-1");

		expect(db.assets[0].status).toBe("SUBMITTED");
		expect(db.assetUpdate).not.toHaveBeenCalled();
	});

	it("deleting many schedules restores every In Maintenance asset", async () => {
		const { service, db } = setup(
			[partiallyDepreciated({ status: "IN_MAINTENANCE" })],
			[dueToday()],
		);

		const result = await service.deleteManyAssetMaintenances([
			"maint-1",
			"maint-1",
		]);

		expect(result.count).toBe(1);
		expect(db.assets[0].status).toBe("PARTIALLY_DEPRECIATED");
	});

	it("completing the log of the due task restores an In Maintenance asset", async () => {
		const { service, db } = setup(
			[partiallyDepreciated({ status: "IN_MAINTENANCE" })],
			[dueToday()],
		);

		await service.completeAssetMaintenanceLog({
			logId: "log-1",
			completionDate: TODAY,
			hasCertificate: false,
		});

		// Monthly task: the next due date moved a month ahead, nothing is due today.
		expect(db.assets[0].status).toBe("PARTIALLY_DEPRECIATED");
	});

	it("cancelling the log of the due task restores an In Maintenance asset", async () => {
		const { service, db } = setup(
			[partiallyDepreciated({ status: "IN_MAINTENANCE" })],
			[dueToday()],
		);

		await service.cancelAssetMaintenanceLog({ logId: "log-1" });

		expect(db.assets[0].status).toBe("PARTIALLY_DEPRECIATED");
	});

	it("never touches a sold asset when its log is completed", async () => {
		const { service, db } = setup(
			[partiallyDepreciated({ status: "SOLD" })],
			[dueToday()],
		);

		await service.completeAssetMaintenanceLog({
			logId: "log-1",
			completionDate: TODAY,
			hasCertificate: false,
		});

		expect(db.assets[0].status).toBe("SOLD");
		expect(db.assetUpdate).not.toHaveBeenCalled();
	});
});
