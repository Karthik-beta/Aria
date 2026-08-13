import type { EventEmitter2 } from "@nestjs/event-emitter";
import { type Observable, observable } from "@trpc/server/observable";
import {
	type AssetOrganizationId,
	assertAssetOrganizationId,
} from "./asset-organization-scope";

/** Organization-owned Asset streams exposed to authenticated subscribers. */
export type AssetRealtimeStream =
	| "assets"
	| "valueAdjustments"
	| "maintenanceTeams"
	| "maintenances";

type AssetRealtimeEventTypes = {
	assets: "created" | "updated" | "deleted";
	valueAdjustments:
		| "created"
		| "updated"
		| "submitted"
		| "cancelled"
		| "deleted";
	maintenanceTeams: "created" | "updated" | "deleted";
	maintenances: "created" | "updated" | "deleted" | "log_completed";
};

/**
 * Minimal invalidation event delivered to a client for an organization-owned
 * Asset stream. Consumers refetch through R-002-scoped procedures.
 */
export type AssetRealtimeEvent<Stream extends AssetRealtimeStream> = {
	type: AssetRealtimeEventTypes[Stream];
	data: { id: string };
};

/**
 * Shared Asset Category invalidation metadata.
 *
 * AssetCategory itself is global master data, but its nested account rows are
 * Company-owned. The public category stream therefore carries only the shared
 * category ID; subscribers refetch through their trusted organization scope.
 */
export type AssetCategoryRealtimeEvent = {
	type: "created" | "updated" | "deleted";
	data: { id: string };
};

const ASSET_CATEGORIES_CHANGED_EVENT = "assetCategoriesChanged" as const;

/** Publishes a category invalidation without exposing Company-owned defaults. */
export function emitAssetCategoryRealtimeEvent(
	eventEmitter: EventEmitter2,
	type: AssetCategoryRealtimeEvent["type"],
	id: string,
): void {
	const event: AssetCategoryRealtimeEvent = {
		type,
		data: { id },
	};
	eventEmitter.emit(ASSET_CATEGORIES_CHANGED_EVENT, event);
}

/**
 * Creates the global shared-category observable.
 *
 * The handler reconstructs the public object so an accidental extra field on
 * an internal event cannot cross the realtime boundary.
 */
export function createAssetCategoryRealtimeObservable(
	eventEmitter: EventEmitter2,
): Observable<AssetCategoryRealtimeEvent, unknown> {
	return observable<AssetCategoryRealtimeEvent>((emit) => {
		const handler = (event: AssetCategoryRealtimeEvent) => {
			emit.next({ type: event.type, data: { id: event.data.id } });
		};

		eventEmitter.on(ASSET_CATEGORIES_CHANGED_EVENT, handler);
		return () => eventEmitter.off(ASSET_CATEGORIES_CHANGED_EVENT, handler);
	});
}

type AssetRealtimeEnvelope<Stream extends AssetRealtimeStream> = {
	organizationId: AssetOrganizationId;
	event: AssetRealtimeEvent<Stream>;
};

const ASSET_REALTIME_TOPIC_SUFFIX: Record<AssetRealtimeStream, string> = {
	assets: "assets",
	valueAdjustments: "value-adjustments",
	maintenanceTeams: "maintenance-teams",
	maintenances: "maintenances",
};

/**
 * Builds the server-only topic for one organization-owned Asset stream.
 *
 * @param organizationId - Trusted active organization or canonical persisted owner.
 * @param stream - Organization-owned stream being published or subscribed to.
 * @returns A topic that cannot be shared by two valid organization IDs.
 */
export function getAssetRealtimeTopic(
	organizationId: AssetOrganizationId,
	stream: AssetRealtimeStream,
): string {
	assertAssetOrganizationId(organizationId);
	return `asset:${organizationId}:${ASSET_REALTIME_TOPIC_SUFFIX[stream]}`;
}

/**
 * Publishes only invalidation metadata to the organization-specific topic.
 *
 * The organization is supplied by trusted R-002 context after the service has
 * verified the canonical Organization -> Company -> Asset ownership chain.
 * Taking only an ID here prevents a full Asset or child record from entering
 * the browser event contract by accident.
 */
export function emitAssetRealtimeEvent<Stream extends AssetRealtimeStream>(
	eventEmitter: EventEmitter2,
	organizationId: AssetOrganizationId,
	stream: Stream,
	type: AssetRealtimeEventTypes[Stream],
	id: string,
): void {
	const event: AssetRealtimeEvent<Stream> = {
		type,
		data: { id },
	};
	const envelope: AssetRealtimeEnvelope<Stream> = {
		organizationId,
		event,
	};

	eventEmitter.emit(getAssetRealtimeTopic(organizationId, stream), envelope);
}

/**
 * Creates the tRPC observable for one trusted organization and stream.
 *
 * The listener is registered on the organization-specific topic before any
 * event can be delivered, defensively checks the internal owner, and removes
 * exactly that listener during unsubscribe/reconnect cleanup.
 */
export function createAssetRealtimeObservable<
	Stream extends AssetRealtimeStream,
>(
	eventEmitter: EventEmitter2,
	organizationId: AssetOrganizationId,
	stream: Stream,
): Observable<AssetRealtimeEvent<Stream>, unknown> {
	const topic = getAssetRealtimeTopic(organizationId, stream);

	return observable<AssetRealtimeEvent<Stream>>((emit) => {
		const handler = (envelope: AssetRealtimeEnvelope<Stream>) => {
			if (envelope.organizationId !== organizationId) return;
			emit.next(envelope.event);
		};

		eventEmitter.on(topic, handler);
		return () => eventEmitter.off(topic, handler);
	});
}
