import { describe, expect, it } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import {
	createCancellationPrisma,
	createPostedDepreciationState,
	snapshotState,
} from "./__tests__/cancellation-fixture";
import { AssetDepreciationReversalService } from "./asset-depreciation-reversal.service";

const run = <T>(
	state: ReturnType<typeof createPostedDepreciationState>,
	work: (
		service: AssetDepreciationReversalService,
		tx: Prisma.TransactionClient,
	) => Promise<T>,
) => {
	const prisma = createCancellationPrisma(state);
	return prisma.$transaction((tx) =>
		work(
			new AssetDepreciationReversalService(),
			tx as unknown as Prisma.TransactionClient,
		),
	);
};

describe("AssetDepreciationReversalService", () => {
	it("reverses only entries on or after the given date and recomputes the book cursor", async () => {
		const state = createPostedDepreciationState();

		const result = await run(state, (service, tx) =>
			service.reversePostedDepreciation(tx, "asset-1", {
				onOrAfter: new Date("2026-02-28T00:00:00.000Z"),
			}),
		);

		expect(result.reversed.map((entry) => entry.series)).toEqual([
			"DEP-2026-00002",
		]);
		expect(state.entries.map((entry) => entry.status)).toEqual([
			"POSTED",
			"REVERSED",
			"POSTED",
		]);
		const [book1, book2] = state.books;
		expect(book1?.valueAfterDepreciation.toString()).toBe("90000");
		expect(book1?.totalNumberOfBookedDepreciations).toBe(1);
		expect(book1?.postingStatus).toBe("PARTIALLY_DEPRECIATED");
		expect(book1?.lastPostedDepreciationDate?.toISOString()).toBe(
			"2026-01-31T00:00:00.000Z",
		);
		// The untouched book and the asset-level fields stay as they were.
		expect(book2?.valueAfterDepreciation.toString()).toBe("90000");
		expect(state.asset.valueAfterDepreciation.toString()).toBe("80000");
	});

	it("is a no-op when nothing is posted", async () => {
		const state = createPostedDepreciationState();
		state.entries.length = 0;
		const before = snapshotState(state);

		const result = await run(state, (service, tx) =>
			service.reversePostedDepreciation(tx, "asset-1"),
		);

		expect(result.reversed).toEqual([]);
		expect(snapshotState(state)).toBe(before);
	});

	it("marks an asset fully depreciated again when its opening value is zero", async () => {
		const state = createPostedDepreciationState();
		state.asset.netPurchaseAmount = state.asset.openingAccumulatedDepreciation;

		await run(state, (service, tx) =>
			service.reversePostedDepreciation(tx, "asset-1"),
		);

		expect(state.asset.valueAfterDepreciation.toString()).toBe("0");
		expect(state.asset.isFullyDepreciated).toBe(true);
	});

	it("rejects when the asset does not exist", async () => {
		const state = createPostedDepreciationState();

		await expect(
			run(state, (service, tx) =>
				service.reversePostedDepreciation(tx, "missing"),
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("treats a posting dated exactly on the frozen date as frozen and a later one as open", async () => {
		const state = createPostedDepreciationState();
		state.companies[0] = {
			name: "ACME",
			accountsFrozenThrough: new Date("2026-01-30T00:00:00.000Z"),
		};
		await run(state, (service, tx) =>
			service.reversePostedDepreciation(tx, "asset-1"),
		);
		expect(state.entries.every((entry) => entry.status === "REVERSED")).toBe(
			true,
		);

		const frozen = createPostedDepreciationState();
		frozen.companies[0] = {
			name: "ACME",
			accountsFrozenThrough: new Date("2026-01-31T00:00:00.000Z"),
		};
		await expect(
			run(frozen, (service, tx) =>
				service.reversePostedDepreciation(tx, "asset-1"),
			),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
