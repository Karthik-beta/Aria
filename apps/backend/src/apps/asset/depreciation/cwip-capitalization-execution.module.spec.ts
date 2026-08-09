import { describe, expect, it } from "bun:test";
import { CwipCapitalizationProcessor } from "./cwip-capitalization.processor";
import { CwipCapitalizationDiscoveryService } from "./cwip-capitalization-discovery.service";
import { CwipCapitalizationExecutionModule } from "./cwip-capitalization-execution.module";
import { CwipCapitalizationPersistenceService } from "./cwip-capitalization-persistence.service";
import { CwipCapitalizationQueueClient } from "./cwip-capitalization-queue.client";

describe("CwipCapitalizationExecutionModule", () => {
	it("registers and exports the producer, discovery, persistence, and worker graph", () => {
		const providers = Reflect.getMetadata(
			"providers",
			CwipCapitalizationExecutionModule,
		) as Array<unknown | { provide?: unknown }>;
		const exports = Reflect.getMetadata(
			"exports",
			CwipCapitalizationExecutionModule,
		) as unknown[];
		const registered = (token: unknown) =>
			providers.some(
				(provider) =>
					provider === token ||
					(typeof provider === "object" &&
						provider !== null &&
						"provide" in provider &&
						provider.provide === token),
			);

		expect(registered(CwipCapitalizationQueueClient)).toBe(true);
		expect(registered(CwipCapitalizationDiscoveryService)).toBe(true);
		expect(registered(CwipCapitalizationPersistenceService)).toBe(true);
		expect(registered(CwipCapitalizationProcessor)).toBe(true);
		expect(exports).toContain(CwipCapitalizationQueueClient);
		expect(exports).toContain(CwipCapitalizationDiscoveryService);
		expect(exports).toContain(CwipCapitalizationPersistenceService);
		expect(exports).toContain(CwipCapitalizationProcessor);
	});
});
