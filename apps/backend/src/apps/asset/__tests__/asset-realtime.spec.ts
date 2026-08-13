import { describe, expect, it } from "bun:test";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
	createAssetCategoryRealtimeObservable,
	createAssetRealtimeObservable,
	emitAssetCategoryRealtimeEvent,
	emitAssetRealtimeEvent,
	getAssetRealtimeTopic,
} from "../asset-realtime";

describe("organization-scoped Asset realtime delivery", () => {
	it("delivers create, update, and delete only to the owning organization", () => {
		const eventEmitter = new EventEmitter2();
		const organizationAEvents: unknown[] = [];
		const organizationBEvents: unknown[] = [];
		const organizationASubscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-a",
			"assets",
		).subscribe({ next: (event) => organizationAEvents.push(event) });
		const organizationBSubscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-b",
			"assets",
		).subscribe({ next: (event) => organizationBEvents.push(event) });

		emitAssetRealtimeEvent(
			eventEmitter,
			"org-a",
			"assets",
			"created",
			"asset-a",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-a",
			"assets",
			"updated",
			"asset-a",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-a",
			"assets",
			"deleted",
			"asset-a",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-b",
			"assets",
			"created",
			"asset-b",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-b",
			"assets",
			"updated",
			"asset-b",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-b",
			"assets",
			"deleted",
			"asset-b",
		);

		expect(organizationAEvents).toEqual([
			{ type: "created", data: { id: "asset-a" } },
			{ type: "updated", data: { id: "asset-a" } },
			{ type: "deleted", data: { id: "asset-a" } },
		]);
		expect(organizationBEvents).toEqual([
			{ type: "created", data: { id: "asset-b" } },
			{ type: "updated", data: { id: "asset-b" } },
			{ type: "deleted", data: { id: "asset-b" } },
		]);

		organizationASubscription.unsubscribe();
		organizationBSubscription.unsubscribe();
		expect(
			eventEmitter.listenerCount(getAssetRealtimeTopic("org-a", "assets")),
		).toBe(0);
		expect(
			eventEmitter.listenerCount(getAssetRealtimeTopic("org-b", "assets")),
		).toBe(0);
	});

	it("scopes child Asset streams and keeps payloads invalidation-safe", () => {
		const eventEmitter = new EventEmitter2();
		const adjustmentEvents: unknown[] = [];
		const organizationATeamEvents: unknown[] = [];
		const organizationBTeamEvents: unknown[] = [];
		const maintenanceEvents: unknown[] = [];
		const adjustmentSubscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-a",
			"valueAdjustments",
		).subscribe({ next: (event) => adjustmentEvents.push(event) });
		const organizationATeamSubscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-a",
			"maintenanceTeams",
		).subscribe({ next: (event) => organizationATeamEvents.push(event) });
		const organizationBTeamSubscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-b",
			"maintenanceTeams",
		).subscribe({ next: (event) => organizationBTeamEvents.push(event) });
		const maintenanceSubscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-a",
			"maintenances",
		).subscribe({ next: (event) => maintenanceEvents.push(event) });

		emitAssetRealtimeEvent(
			eventEmitter,
			"org-a",
			"valueAdjustments",
			"submitted",
			"adjustment-a",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-b",
			"valueAdjustments",
			"cancelled",
			"adjustment-b",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-a",
			"maintenanceTeams",
			"created",
			"team-a",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-b",
			"maintenanceTeams",
			"deleted",
			"team-b",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-a",
			"maintenances",
			"log_completed",
			"log-a",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-b",
			"maintenances",
			"deleted",
			"maintenance-b",
		);

		expect(adjustmentEvents).toEqual([
			{ type: "submitted", data: { id: "adjustment-a" } },
		]);
		expect(organizationATeamEvents).toEqual([
			{ type: "created", data: { id: "team-a" } },
		]);
		expect(organizationBTeamEvents).toEqual([
			{ type: "deleted", data: { id: "team-b" } },
		]);
		expect(maintenanceEvents).toEqual([
			{ type: "log_completed", data: { id: "log-a" } },
		]);

		adjustmentSubscription.unsubscribe();
		organizationATeamSubscription.unsubscribe();
		organizationBTeamSubscription.unsubscribe();
		maintenanceSubscription.unsubscribe();
	});

	it("uses stable organization IDs, not Company display names, for topics", () => {
		const organizationATopic = getAssetRealtimeTopic("org-a", "assets");
		const organizationBTopic = getAssetRealtimeTopic("org-b", "assets");

		expect(organizationATopic).not.toBe(organizationBTopic);
		expect(organizationATopic).toContain("org-a");
		expect(organizationATopic).not.toContain("Acme");
	});

	it("defensively drops an envelope whose owner does not match its topic", () => {
		const eventEmitter = new EventEmitter2();
		const received: unknown[] = [];
		const subscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-a",
			"assets",
		).subscribe({ next: (event) => received.push(event) });

		eventEmitter.emit(getAssetRealtimeTopic("org-a", "assets"), {
			organizationId: "org-b",
			event: { type: "created", data: { id: "asset-b" } },
		});

		expect(received).toEqual([]);
		subscription.unsubscribe();
	});

	it("removes the old organization listener before reconnecting", () => {
		const eventEmitter = new EventEmitter2();
		const organizationAEvents: unknown[] = [];
		const organizationBEvents: unknown[] = [];
		const organizationASubscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-a",
			"assets",
		).subscribe({ next: (event) => organizationAEvents.push(event) });

		emitAssetRealtimeEvent(
			eventEmitter,
			"org-a",
			"assets",
			"created",
			"asset-a-before-reconnect",
		);
		organizationASubscription.unsubscribe();

		const organizationBSubscription = createAssetRealtimeObservable(
			eventEmitter,
			"org-b",
			"assets",
		).subscribe({ next: (event) => organizationBEvents.push(event) });
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-a",
			"assets",
			"updated",
			"asset-a-after-reconnect",
		);
		emitAssetRealtimeEvent(
			eventEmitter,
			"org-b",
			"assets",
			"created",
			"asset-b-after-reconnect",
		);

		expect(organizationAEvents).toEqual([
			{ type: "created", data: { id: "asset-a-before-reconnect" } },
		]);
		expect(organizationBEvents).toEqual([
			{ type: "created", data: { id: "asset-b-after-reconnect" } },
		]);
		expect(
			eventEmitter.listenerCount(getAssetRealtimeTopic("org-a", "assets")),
		).toBe(0);

		organizationBSubscription.unsubscribe();
	});

	it("broadcasts only shared category invalidation metadata", () => {
		const eventEmitter = new EventEmitter2();
		const organizationAEvents: unknown[] = [];
		const organizationBEvents: unknown[] = [];
		const organizationASubscription = createAssetCategoryRealtimeObservable(
			eventEmitter,
		).subscribe({ next: (event) => organizationAEvents.push(event) });
		const organizationBSubscription = createAssetCategoryRealtimeObservable(
			eventEmitter,
		).subscribe({ next: (event) => organizationBEvents.push(event) });

		emitAssetCategoryRealtimeEvent(eventEmitter, "updated", "category-shared");
		// Defend the public observable even if an internal producer accidentally
		// includes Company-owned fields on the EventEmitter payload.
		eventEmitter.emit("assetCategoriesChanged", {
			type: "updated",
			data: {
				id: "category-shared",
				companyId: "company-a",
				companyName: "Acme",
				fixedAssetAccount: "Fixed Asset - Acme",
				accounts: [{ depreciationExpenseAccount: "Depreciation - Acme" }],
			},
		});

		const expected = [
			{ type: "updated", data: { id: "category-shared" } },
			{ type: "updated", data: { id: "category-shared" } },
		];
		expect(organizationAEvents).toEqual(expected);
		expect(organizationBEvents).toEqual(expected);
		for (const event of organizationAEvents) {
			expect(event).not.toHaveProperty("data.accounts");
			expect(event).not.toHaveProperty("data.companyId");
			expect(event).not.toHaveProperty("data.companyName");
			expect(event).not.toHaveProperty("data.fixedAssetAccount");
		}

		organizationASubscription.unsubscribe();
		organizationBSubscription.unsubscribe();
		expect(eventEmitter.listenerCount("assetCategoriesChanged")).toBe(0);
	});
});
