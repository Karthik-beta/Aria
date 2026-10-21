import { mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetStatusService } from "../asset-status.service";

export interface FakeBook {
	financeBookId: string;
	valueAfterDepreciation: number;
	expectedValueAfterUsefulLife: number;
}

export interface FakeAsset {
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

export interface FakeTask {
	assetId: string;
	maintenanceStatus: string;
	nextDueDate: Date | null;
}

export const TODAY = new Date("2026-07-10T00:00:00.000Z");
export const TOMORROW = new Date("2026-07-11T00:00:00.000Z");

export const makeAsset = (overrides: Partial<FakeAsset> = {}): FakeAsset => ({
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
export function createFakeDatabase(
	assets: FakeAsset[],
	tasks: FakeTask[] = [],
	company: { defaultFinanceBookId: string | null } | null = {
		defaultFinanceBookId: "fb-1",
	},
	/** Extra delegate methods (merged per delegate) for flows that touch more tables. */
	extend: Record<string, Record<string, unknown>> = {},
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
	const fullTx: Record<string, Record<string, unknown>> = { ...tx };
	for (const [name, methods] of Object.entries(extend)) {
		fullTx[name] = { ...fullTx[name], ...methods };
	}
	const prisma = {
		...fullTx,
		$transaction: mock(
			async (callback: (t: typeof fullTx) => Promise<unknown>) =>
				callback(fullTx),
		),
	};
	const service = new AssetStatusService(prisma as unknown as PrismaService);
	return { service, tx, prisma, assets, activities, assetUpdate, taskCount };
}
