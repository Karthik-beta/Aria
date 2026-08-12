import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	CWIP_CAPITALIZATION_JOB_VERSION,
	cwipCapitalizationJobId,
	POST_ASSET_CWIP_CAPITALIZATION_JOB,
} from "./cwip-capitalization.constants";
import { CwipCapitalizationDiscoveryService } from "./cwip-capitalization-discovery.service";
import type { CwipCapitalizationQueueClient } from "./cwip-capitalization-queue.client";

const COMPANY_ID = "company-1";

function candidate(
	id: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		id,
		companyId: COMPANY_ID,
		availableForUseDate: new Date("2026-08-09T00:00:00.000Z"),
		assetCategory: {
			enableCwipAccounting: true,
			accounts: [
				{
					fixedAssetAccount: "Plant and Machinery - PTPL",
					capitalWorkInProgressAccount: "CWIP - PTPL",
					companyId: COMPANY_ID,
					company: { name: "Pivotr Technologies Private Limited" },
				},
			],
		},
		...overrides,
	};
}

function serviceWith(
	rows: Record<string, unknown>[],
	queueOverrides: Record<string, unknown> = {},
) {
	const findMany = mock(async () => rows);
	const addBulk = mock(async () => undefined);
	const queue = {
		getJob: mock(async () => undefined),
		addBulk,
		...queueOverrides,
	};
	const prisma = {
		client: { asset: { findMany } },
	} as unknown as PrismaService;
	return {
		service: new CwipCapitalizationDiscoveryService(
			prisma,
			queue as unknown as CwipCapitalizationQueueClient,
		),
		findMany,
		addBulk,
	};
}

describe("CwipCapitalizationDiscoveryService", () => {
	it("enqueues only due SUBMITTED assets with exact-company fixed and CWIP accounts", async () => {
		const { service, findMany, addBulk } = serviceWith([
			candidate("asset-qualified"),
			candidate("asset-wrong-company", {
				assetCategory: {
					enableCwipAccounting: true,
					accounts: [
						{
							fixedAssetAccount: "Fixed - OTHER",
							capitalWorkInProgressAccount: "CWIP - OTHER",
							companyId: "company-2",
							company: { name: "Other Company" },
						},
					],
				},
			}),
			candidate("asset-missing-cwip", {
				assetCategory: {
					enableCwipAccounting: true,
					accounts: [
						{
							fixedAssetAccount: "Plant and Machinery - PTPL",
							capitalWorkInProgressAccount: null,
							companyId: COMPANY_ID,
							company: {
								name: "Pivotr Technologies Private Limited",
							},
						},
					],
				},
			}),
		]);

		await expect(service.discover("2026-08-09")).resolves.toEqual({
			discovered: 3,
			qualified: 1,
			enqueued: 1,
			duplicateSkipped: 0,
		});
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					status: "SUBMITTED",
					cwipAccountingEntryId: null,
					assetCategory: { is: { enableCwipAccounting: true } },
				}),
			}),
		);
		expect(addBulk).toHaveBeenCalledWith([
			{
				name: POST_ASSET_CWIP_CAPITALIZATION_JOB,
				data: {
					version: CWIP_CAPITALIZATION_JOB_VERSION,
					assetId: "asset-qualified",
					availableForUseDate: "2026-08-09",
				},
				opts: { jobId: cwipCapitalizationJobId("asset-qualified") },
			},
		]);
	});

	it("skips a durable duplicate job instead of enqueueing it again", async () => {
		const existing = { getState: mock(async () => "waiting") };
		const { service, addBulk } = serviceWith([candidate("asset-1")], {
			getJob: mock(async () => existing),
		});

		await expect(service.discover("2026-08-09")).resolves.toEqual({
			discovered: 1,
			qualified: 1,
			enqueued: 0,
			duplicateSkipped: 1,
		});
		expect(addBulk).not.toHaveBeenCalled();
	});

	it("removes a completed stale job so a newly qualified retry can run", async () => {
		const remove = mock(async () => undefined);
		const existing = {
			getState: mock(async () => "completed"),
			remove,
		};
		const { service, addBulk } = serviceWith([candidate("asset-1")], {
			getJob: mock(async () => existing),
		});

		await expect(service.discover("2026-08-09")).resolves.toEqual({
			discovered: 1,
			qualified: 1,
			enqueued: 1,
			duplicateSkipped: 0,
		});
		expect(remove).toHaveBeenCalledTimes(1);
		expect(addBulk).toHaveBeenCalledTimes(1);
	});

	it("removes an exhausted failed job so reconciliation can retry it", async () => {
		const remove = mock(async () => undefined);
		const existing = {
			getState: mock(async () => "failed"),
			remove,
		};
		const { service, addBulk } = serviceWith([candidate("asset-1")], {
			getJob: mock(async () => existing),
		});

		await expect(service.discover("2026-08-09")).resolves.toEqual({
			discovered: 1,
			qualified: 1,
			enqueued: 1,
			duplicateSkipped: 0,
		});
		expect(remove).toHaveBeenCalledTimes(1);
		expect(addBulk).toHaveBeenCalledTimes(1);
	});
});
