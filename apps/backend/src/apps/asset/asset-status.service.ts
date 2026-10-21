/**
 * Asset status service: the database side of the status engine in
 * `asset-status.ts`. It loads what the pure functions need, writes
 * `Asset.status` only when it changed and records the change in the asset
 * activity log.
 *
 * Ported from ERPNext (GPLv3), https://github.com/frappe/erpnext:
 * `erpnext/assets/doctype/asset/asset.py` (`set_status`, `get_status`,
 * `update_maintenance_status`) and
 * `erpnext/assets/doctype/asset_maintenance/asset_maintenance.py` (`after_delete`).
 *
 * @module AssetStatusService
 */
import type { Asset } from "@aria/types";
import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import {
	ASSET_MAINTENANCE_ELIGIBLE_STATUSES,
	assetStatusLabel,
	type DeriveAssetStatusInput,
	deriveAssetStatus,
	deriveOperationalStatus,
} from "./asset-status";
import {
	businessDate,
	dateOnlyUtc,
	depreciationTimeZone,
} from "./depreciation/depreciation.config";

const MAINTENANCE_PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The configured business timezone; UTC when `APP_TIME_ZONE` is not set. */
const businessTimeZone = (): string => {
	try {
		return depreciationTimeZone();
	} catch {
		return "UTC";
	}
};

/** Delegates the status engine reads and writes; satisfied by a transaction or the client. */
export type AssetStatusTransaction = Pick<
	Prisma.TransactionClient,
	"asset" | "assetActivity" | "assetMaintenanceTask" | "company"
>;

type AssetStatusReader = Pick<Prisma.TransactionClient, "asset" | "company">;

export interface AssetStatusInputs {
	status: Asset.AssetStatus;
	maintenanceRequired: boolean;
	/** Everything `deriveAssetStatus` needs except the status it starts from. */
	derive: Omit<DeriveAssetStatusInput, "currentStatus">;
}

/**
 * Loads the asset and its default finance book (the company's
 * `defaultFinanceBookId`, falling back to the first book, like ERPNext
 * `get_default_finance_book_idx`). Returns null for an unknown asset.
 */
export async function loadAssetStatusInputs(
	reader: AssetStatusReader,
	assetId: string,
): Promise<AssetStatusInputs | null> {
	const asset = await reader.asset.findUnique({
		where: { id: assetId },
		select: {
			status: true,
			company: true,
			calculateDepreciation: true,
			isFullyDepreciated: true,
			netPurchaseAmount: true,
			valueAfterDepreciation: true,
			maintenanceRequired: true,
			financeBooks: {
				select: {
					financeBookId: true,
					valueAfterDepreciation: true,
					expectedValueAfterUsefulLife: true,
				},
				orderBy: { createdAt: "asc" },
			},
		},
	});
	if (!asset) return null;

	let defaultBook: AssetStatusInputs["derive"]["defaultBook"] = null;
	if (asset.calculateDepreciation && asset.financeBooks.length > 0) {
		const company = await reader.company.findUnique({
			where: { name: asset.company },
			select: { defaultFinanceBookId: true },
		});
		const row =
			asset.financeBooks.find(
				(book) => book.financeBookId === company?.defaultFinanceBookId,
			) ?? asset.financeBooks[0];
		defaultBook = {
			valueAfterDepreciation: Number(row.valueAfterDepreciation),
			expectedValueAfterUsefulLife: Number(row.expectedValueAfterUsefulLife),
		};
	}

	return {
		status: asset.status,
		maintenanceRequired: asset.maintenanceRequired,
		derive: {
			calculateDepreciation: asset.calculateDepreciation,
			isFullyDepreciated: asset.isFullyDepreciated,
			netPurchaseAmount: Number(asset.netPurchaseAmount),
			valueAfterDepreciation: Number(asset.valueAfterDepreciation),
			defaultBook,
		},
	};
}

@Injectable()
export class AssetStatusService {
	private readonly logger = new Logger(AssetStatusService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Whether an Asset Repair with a pending status exists for the asset
	 * (ERPNext `Asset.has_pending_repair`). Asset Repair does not exist yet, so
	 * this is always false; #156 only has to supply the data here.
	 */
	// TODO(#156): query pending Asset Repair documents once they exist.
	async hasPendingRepair(
		_assetId: string,
		_tx?: Pick<AssetStatusTransaction, "asset">,
	): Promise<boolean> {
		return false;
	}

	/**
	 * Recomputes `Asset.status` (ERPNext `set_status` with the
	 * `update_maintenance_status` overlay) and persists it when it changed.
	 * Draft, cancelled, sold and scrapped assets are never touched.
	 */
	async refreshStatus(
		tx: AssetStatusTransaction,
		assetId: string,
		opts: { asOf?: Date } = {},
	): Promise<{ status: Asset.AssetStatus; changed: boolean }> {
		const inputs = await loadAssetStatusInputs(tx, assetId);
		if (!inputs) return { status: "DRAFT", changed: false };

		const base = deriveAssetStatus({
			...inputs.derive,
			currentStatus: inputs.status,
		});
		const overlayApplies =
			inputs.maintenanceRequired &&
			ASSET_MAINTENANCE_ELIGIBLE_STATUSES.includes(base);
		const next = deriveOperationalStatus({
			base,
			maintenanceRequired: inputs.maintenanceRequired,
			hasPendingRepair: overlayApplies
				? await this.hasPendingRepair(assetId, tx)
				: false,
			hasMaintenanceDueToday: overlayApplies
				? await this.hasMaintenanceDueToday(tx, assetId, opts.asOf)
				: false,
		});

		if (next === inputs.status) return { status: next, changed: false };

		await tx.asset.update({ where: { id: assetId }, data: { status: next } });
		await tx.assetActivity.create({
			data: {
				assetId,
				activity: `Status changed from ${assetStatusLabel(inputs.status)} to ${assetStatusLabel(next)}`,
			},
		});
		return { status: next, changed: true };
	}

	/**
	 * Port of ERPNext `update_maintenance_status()`: moves every submitted asset
	 * that requires maintenance to `OUT_OF_ORDER`, `IN_MAINTENANCE` or back to
	 * its derived status. Meant to run once a day; the scheduler is wired in #155.
	 */
	async updateMaintenanceStatuses(
		asOf?: Date,
	): Promise<{ examined: number; changed: number }> {
		let examined = 0;
		let changed = 0;
		let cursor: string | undefined;
		for (;;) {
			const assets = await this.prisma.asset.findMany({
				where: {
					maintenanceRequired: true,
					disposalDate: null,
					status: { in: [...ASSET_MAINTENANCE_ELIGIBLE_STATUSES] },
				},
				select: { id: true },
				orderBy: { id: "asc" },
				take: MAINTENANCE_PAGE_SIZE,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			});
			if (assets.length === 0) break;
			for (const { id } of assets) {
				examined += 1;
				try {
					const result = await this.prisma.$transaction((tx) =>
						this.refreshStatus(tx, id, { asOf }),
					);
					if (result.changed) changed += 1;
				} catch (error) {
					this.logger.error(
						`Failed to update the maintenance status of asset ${id}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
			if (assets.length < MAINTENANCE_PAGE_SIZE) break;
			cursor = assets.at(-1)?.id;
		}
		return { examined, changed };
	}

	/**
	 * True when a task that is not cancelled has its next due date on the
	 * business date (`asOf`, default today in the configured timezone).
	 */
	private async hasMaintenanceDueToday(
		tx: Pick<AssetStatusTransaction, "assetMaintenanceTask">,
		assetId: string,
		asOf?: Date,
	): Promise<boolean> {
		const dayStart = dateOnlyUtc(asOf ?? businessDate(businessTimeZone()));
		const count = await tx.assetMaintenanceTask.count({
			where: {
				maintenance: { assetId },
				maintenanceStatus: { not: "CANCELLED" },
				nextDueDate: {
					gte: dayStart,
					lt: new Date(dayStart.getTime() + DAY_MS),
				},
			},
		});
		return count > 0;
	}
}
