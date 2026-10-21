import {
	type APIRequestContext,
	expect,
	type PlaywrightWorkerArgs,
} from "@playwright/test";
import { ADMIN_STORAGE_STATE, E2E_BACKEND_URL } from "./auth";

/**
 * Real-backend fixtures for the asset specs.
 *
 * Prerequisite data is created straight through the tRPC HTTP endpoints, which
 * is much faster than driving the UI for it. The backend uses no tRPC
 * transformer: a mutation is `POST /trpc/<procedure>` with the raw input as
 * JSON, a query is `GET /trpc/<procedure>?input=<json>`, and a successful
 * response is `{ result: { data } }`.
 *
 * Pass the `request` fixture (or `page.request`) of a test that runs with the
 * admin storage state so the session cookies are sent along.
 */

type TrpcSuccess<T> = { result: { data: T } };

export async function trpcMutation<T>(
	request: APIRequestContext,
	procedure: string,
	input: unknown,
): Promise<T> {
	const response = await request.post(`${E2E_BACKEND_URL}/trpc/${procedure}`, {
		data: input,
	});
	expect(response.ok(), `${procedure}: ${await response.text()}`).toBe(true);
	return ((await response.json()) as TrpcSuccess<T>).result.data;
}

export async function trpcQuery<T>(
	request: APIRequestContext,
	procedure: string,
	input?: unknown,
): Promise<T> {
	const query =
		input === undefined
			? ""
			: `?input=${encodeURIComponent(JSON.stringify(input))}`;
	const response = await request.get(
		`${E2E_BACKEND_URL}/trpc/${procedure}${query}`,
	);
	expect(response.ok(), `${procedure}: ${await response.text()}`).toBe(true);
	return ((await response.json()) as TrpcSuccess<T>).result.data;
}

/** Run id shared by everything one spec file creates, so reruns never collide. */
export function runId(): string {
	return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** `prefix` followed by a unique suffix, e.g. `Rack-e2e-lq1x2y-ab12`. */
export function uniqueName(prefix: string): string {
	return `${prefix}-${runId()}`;
}

/** `YYYY-MM-DD` for a day offset from today (UTC), as date inputs expect. */
export function isoDate(offsetDays = 0): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + offsetDays);
	return date.toISOString().slice(0, 10);
}

export type CompanyFixture = { id: string; name: string };
export type CategoryFixture = { id: string; name: string };
export type LocationFixture = {
	id: string;
	name: string;
	isGroup: boolean;
	parentLocationId: string | null;
};
export type AssetFixture = { id: string; assetName: string; status: string };
export type TeamFixture = { id: string; name: string };
export type MaintenanceFixture = {
	id: string;
	assetId: string;
	tasks: { id: string; nextDueDate: string | null }[];
};

export function createCompany(
	request: APIRequestContext,
	name = uniqueName("E2E Company"),
) {
	return trpcMutation<CompanyFixture>(request, "company.createCompany", {
		name,
	});
}

export function createCategory(
	request: APIRequestContext,
	name = uniqueName("E2E Category"),
) {
	return trpcMutation<CategoryFixture>(request, "asset.createAssetCategory", {
		name,
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 12,
		frequencyOfDepreciation: 1,
	});
}

export function createLocation(
	request: APIRequestContext,
	input: { name?: string; isGroup?: boolean; parentLocationId?: string } = {},
) {
	return trpcMutation<LocationFixture>(request, "asset.createLocation", {
		name: input.name ?? uniqueName("E2E Location"),
		isGroup: input.isGroup ?? false,
		parentLocationId: input.parentLocationId ?? null,
	});
}

export function createDraftAsset(
	request: APIRequestContext,
	input: {
		assetName?: string;
		company: string;
		assetCategoryId?: string;
		locationId?: string;
	},
) {
	return trpcMutation<AssetFixture>(request, "asset.createAsset", {
		assetName: input.assetName ?? uniqueName("E2E Asset"),
		company: input.company,
		assetCategoryId: input.assetCategoryId ?? null,
		locationId: input.locationId ?? null,
		purchaseDate: isoDate(-30),
		netPurchaseAmount: 1200,
		calculateDepreciation: false,
	});
}

/** Creates a draft asset and submits it (no depreciation schedule needed). */
export async function createSubmittedAsset(
	request: APIRequestContext,
	input: Parameters<typeof createDraftAsset>[1],
) {
	const draft = await createDraftAsset(request, input);
	return trpcMutation<AssetFixture>(request, "asset.submitAsset", {
		id: draft.id,
	});
}

export function createMaintenanceTeam(
	request: APIRequestContext,
	input: { company: string; name?: string },
) {
	return trpcMutation<TeamFixture>(request, "asset.createMaintenanceTeam", {
		name: input.name ?? uniqueName("E2E Team"),
		company: input.company,
		members: [
			{
				teamMember: "e2e.tech@aria.test",
				fullName: "E2E Technician",
				maintenanceRole: "Technician",
			},
		],
	});
}

export function createAssetMaintenance(
	request: APIRequestContext,
	input: {
		assetId: string;
		company: string;
		maintenanceTeamId: string;
		taskName?: string;
		startDate?: string;
	},
) {
	return trpcMutation<MaintenanceFixture>(
		request,
		"asset.createAssetMaintenance",
		{
			assetId: input.assetId,
			company: input.company,
			maintenanceTeamId: input.maintenanceTeamId,
			tasks: [
				{
					maintenanceTask: input.taskName ?? uniqueName("E2E Task"),
					periodicity: "MONTHLY",
					startDate: input.startDate ?? isoDate(-10),
				},
			],
		},
	);
}

/**
 * Admin API context for `beforeAll`/`afterAll` hooks, where the per-test
 * `request` fixture is not available. Dispose it when done.
 */
export function adminApi(playwright: PlaywrightWorkerArgs["playwright"]) {
	return playwright.request.newContext({ storageState: ADMIN_STORAGE_STATE });
}

type Listed<T> = { items: T[] };

async function listItems<T>(
	request: APIRequestContext,
	procedure: string,
	search: string,
): Promise<T[]> {
	try {
		return (
			await trpcQuery<Listed<T>>(request, procedure, { search, take: 250 })
		).items;
	} catch {
		return [];
	}
}

async function bestEffortMutation(
	request: APIRequestContext,
	procedure: string,
	input: unknown,
) {
	try {
		await request.post(`${E2E_BACKEND_URL}/trpc/${procedure}`, { data: input });
	} catch {
		// Already removed, or still referenced; cleanup must never fail a run.
	}
}

/**
 * Best-effort removal of everything whose name contains `id` (the run id the
 * spec put into its data), in dependency order: maintenance, assets,
 * categories, locations (children before groups), teams, companies. Submitted
 * assets are cancelled first because the backend refuses to delete them.
 * Failures are swallowed: an entity the test already deleted through the UI is
 * simply gone.
 */
export async function cleanupRun(request: APIRequestContext, id: string) {
	for (const item of await listItems<{ id: string }>(
		request,
		"asset.listAssetMaintenances",
		id,
	)) {
		await bestEffortMutation(request, "asset.deleteAssetMaintenance", {
			id: item.id,
		});
	}
	for (const item of await listItems<{ id: string }>(
		request,
		"asset.listAssets",
		id,
	)) {
		await bestEffortMutation(request, "asset.cancelAsset", { id: item.id });
		await bestEffortMutation(request, "asset.deleteAsset", { id: item.id });
	}
	for (const item of await listItems<{ id: string }>(
		request,
		"asset.listAssetCategories",
		id,
	)) {
		await bestEffortMutation(request, "asset.deleteAssetCategory", {
			id: item.id,
		});
	}
	const locations = await listItems<LocationFixture>(
		request,
		"asset.listLocations",
		id,
	);
	for (const item of locations.sort(
		(a, b) =>
			Number(Boolean(b.parentLocationId)) - Number(Boolean(a.parentLocationId)),
	)) {
		await bestEffortMutation(request, "asset.deleteLocation", { id: item.id });
	}
	for (const item of await listItems<{ id: string }>(
		request,
		"asset.listMaintenanceTeams",
		id,
	)) {
		await bestEffortMutation(request, "asset.deleteMaintenanceTeam", {
			id: item.id,
		});
	}
	for (const item of await listItems<{ id: string }>(
		request,
		"company.listCompanies",
		id,
	)) {
		await bestEffortMutation(request, "company.deleteCompany", { id: item.id });
	}
}
