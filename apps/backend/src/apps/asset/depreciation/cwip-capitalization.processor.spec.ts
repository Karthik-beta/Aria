import { describe, expect, it, mock } from "bun:test";
import { UnrecoverableError } from "bullmq";
import { CwipCapitalizationProcessor } from "./cwip-capitalization.processor";
import {
	type CwipCapitalizationPersistenceService,
	CwipCapitalizationValidationError,
} from "./cwip-capitalization-persistence.service";

function jobMock(overrides: Record<string, unknown> = {}) {
	return {
		id: "asset-cwip-capitalization-asset-1",
		name: "post-asset-cwip-capitalization",
		data: {
			version: 1,
			assetId: "asset-1",
			availableForUseDate: "2026-08-09",
		},
		...overrides,
	} as unknown as Parameters<CwipCapitalizationProcessor["process"]>[0];
}

describe("CwipCapitalizationProcessor", () => {
	it("returns idempotent persistence results", async () => {
		const persistence = {
			post: mock(async () => ({
				status: "already-posted" as const,
				accountingEntryId: "accounting-1",
			})),
		} as unknown as CwipCapitalizationPersistenceService;
		const processor = new CwipCapitalizationProcessor(persistence);

		await expect(processor.process(jobMock())).resolves.toEqual({
			status: "already-posted",
			accountingEntryId: "accounting-1",
		});
	});

	it("marks permanent posting validation failures as unrecoverable", async () => {
		const persistence = {
			post: mock(async () => {
				throw new CwipCapitalizationValidationError("CWIP account is missing");
			}),
		} as unknown as CwipCapitalizationPersistenceService;
		const processor = new CwipCapitalizationProcessor(persistence);

		await expect(processor.process(jobMock())).rejects.toBeInstanceOf(
			UnrecoverableError,
		);
	});
});
