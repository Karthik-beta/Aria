import { expect, test } from "@playwright/test";
import {
	adminApi,
	cleanupRun,
	createAssetMaintenance,
	createCategory,
	createCompany,
	createDraftAsset,
	createLocation,
	createMaintenanceTeam,
	createSubmittedAsset,
	runId,
} from "./asset-fixtures";
import { submitAndWait, tableRow, toast } from "./asset-ui";
import { E2E_BACKEND_URL, MEMBER_STORAGE_STATE } from "./auth";

/**
 * Organization members (role `member`) may read asset data and complete
 * maintenance logs, but every write is hidden in the UI and rejected by the
 * API. The member session comes from member.setup.ts.
 */
test.use({ storageState: MEMBER_STORAGE_STATE });

const RUN = runId();
const LOCATION_NAME = `Dock ${RUN}`;
const CATEGORY_NAME = `Forklifts ${RUN}`;
const DRAFT_ASSET_NAME = `Pallet Jack ${RUN}`;
const SUBMITTED_ASSET_NAME = `Forklift ${RUN}`;
const MAINTENANCE_ASSET_NAME = `Crane ${RUN}`;
const TEAM_NAME = `Riggers ${RUN}`;
const TASK_NAME = `Check cables ${RUN}`;

const ADMIN_ONLY_MESSAGE =
	"You need the owner or admin role in this organization to change asset records.";

let draftAssetId = "";
let submittedAssetId = "";

type ListPage = {
	name: string;
	path: string;
	searchPlaceholder: string;
	/** The create call-to-action the page shows to owners and admins. */
	createName: string;
	/** Text of a seeded row, when the page has one. */
	rowText?: string;
};

const LIST_PAGES: ListPage[] = [
	{
		name: "assets",
		path: "/asset/asset-sub-module/asset",
		searchPlaceholder: "Search across all columns...",
		createName: "Add Asset",
		rowText: DRAFT_ASSET_NAME,
	},
	{
		name: "locations",
		path: "/asset/asset-sub-module/location",
		searchPlaceholder: "Search locations…",
		createName: "Add Location",
		rowText: LOCATION_NAME,
	},
	{
		name: "asset categories",
		path: "/asset/asset-sub-module/asset-category",
		searchPlaceholder: "Search categories…",
		createName: "Add Category",
		rowText: CATEGORY_NAME,
	},
	{
		name: "maintenance",
		path: "/asset/asset-maintenance/maintenance",
		searchPlaceholder: "Search assets…",
		createName: "Add Maintenance",
		rowText: MAINTENANCE_ASSET_NAME,
	},
	{
		name: "maintenance teams",
		path: "/asset/asset-maintenance/maintenance-team",
		searchPlaceholder: "Search teams…",
		createName: "Add Team",
		rowText: TEAM_NAME,
	},
	{
		name: "value adjustments",
		path: "/asset/asset-maintenance/value-adjustment",
		searchPlaceholder: "Search adjustments…",
		createName: "New Adjustment",
	},
];

const FORM_ROUTES = [
	{
		path: "/asset/asset-sub-module/location/form",
		back: "Back to locations",
		list: "/asset/asset-sub-module/location",
	},
	{
		path: "/asset/asset-sub-module/asset-category/form",
		back: "Back to asset categories",
		list: "/asset/asset-sub-module/asset-category",
	},
	{
		path: "/asset/asset-sub-module/asset/form",
		back: "Back to assets",
		list: "/asset/asset-sub-module/asset",
	},
	{
		path: "/asset/asset-maintenance/maintenance-team/form",
		back: "Back to maintenance teams",
		list: "/asset/asset-maintenance/maintenance-team",
	},
	{
		path: "/asset/asset-maintenance/form",
		back: "Back to maintenance",
		list: "/asset/asset-maintenance/maintenance",
	},
	{
		path: "/asset/asset-maintenance/value-adjustment/form",
		back: "Back to value adjustments",
		list: "/asset/asset-maintenance/value-adjustment",
	},
];

test.describe("asset pages as an organization member (real backend)", () => {
	test.beforeAll(async ({ playwright }) => {
		const api = await adminApi(playwright);
		const company = await createCompany(api, `E2E Company ${RUN}`);
		const category = await createCategory(api, CATEGORY_NAME);
		const location = await createLocation(api, { name: LOCATION_NAME });

		const draft = await createDraftAsset(api, {
			assetName: DRAFT_ASSET_NAME,
			company: company.name,
			assetCategoryId: category.id,
			locationId: location.id,
		});
		draftAssetId = draft.id;
		const submitted = await createSubmittedAsset(api, {
			assetName: SUBMITTED_ASSET_NAME,
			company: company.name,
		});
		submittedAssetId = submitted.id;

		const maintenanceAsset = await createSubmittedAsset(api, {
			assetName: MAINTENANCE_ASSET_NAME,
			company: company.name,
		});
		const team = await createMaintenanceTeam(api, {
			company: company.name,
			name: TEAM_NAME,
		});
		await createAssetMaintenance(api, {
			assetId: maintenanceAsset.id,
			company: company.name,
			maintenanceTeamId: team.id,
			taskName: TASK_NAME,
		});
		await api.dispose();
	});

	test.afterAll(async ({ playwright }) => {
		const api = await adminApi(playwright);
		await cleanupRun(api, RUN);
		await api.dispose();
	});

	for (const listPage of LIST_PAGES) {
		test(`${listPage.name} list has no write controls`, async ({ page }) => {
			await page.goto(listPage.path);
			await page.getByPlaceholder(listPage.searchPlaceholder).fill(RUN);
			if (listPage.rowText) {
				await expect(tableRow(page, listPage.rowText)).toBeVisible();
			} else {
				await expect(page.getByRole("table").first()).toBeVisible();
			}

			await expect(
				page.getByRole("link", { name: listPage.createName }),
			).toHaveCount(0);
			await expect(
				page.getByRole("button", { name: listPage.createName }),
			).toHaveCount(0);

			// Rows have no actions menu with edit or delete (the asset list keeps a
			// menu with "View Details" only, covered by its own test below).
			await expect(
				page.getByRole("button", { name: /^Open actions for/ }),
			).toHaveCount(0);
			await expect(
				page.getByRole("menuitem", { name: /^(Edit|Delete)\b/ }),
			).toHaveCount(0);
		});
	}

	test("asset list rows only offer View Details", async ({ page }) => {
		await page.goto("/asset/asset-sub-module/asset");
		await page.getByPlaceholder("Search across all columns...").fill(RUN);
		const row = tableRow(page, DRAFT_ASSET_NAME);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open menu" }).click();
		await expect(
			page.getByRole("menuitem", { name: "View Details" }),
		).toBeVisible();
		await expect(
			page.getByRole("menuitem", { name: "Edit Asset" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("menuitem", { name: "Delete Asset" }),
		).toHaveCount(0);
	});

	test("draft asset detail has no Submit, Edit or Delete", async ({ page }) => {
		await page.goto(`/asset/asset-sub-module/asset/${draftAssetId}`);
		await expect(
			page.getByRole("heading", { name: DRAFT_ASSET_NAME }),
		).toBeVisible();
		await expect(page.getByText(/^Draft$/i)).toBeVisible();

		await expect(
			page.getByRole("button", { name: "Submit", exact: true }),
		).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
		await expect(
			page.getByRole("link", { name: "Edit", exact: true }),
		).toHaveCount(0);
	});

	test("submitted asset detail has no Cancel Asset, Edit or Delete", async ({
		page,
	}) => {
		await page.goto(`/asset/asset-sub-module/asset/${submittedAssetId}`);
		await expect(
			page.getByRole("heading", { name: SUBMITTED_ASSET_NAME }),
		).toBeVisible();
		await expect(page.getByText(/^Submitted$/i)).toBeVisible();

		await expect(
			page.getByRole("button", { name: "Cancel Asset" }),
		).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
		await expect(
			page.getByRole("link", { name: "Edit", exact: true }),
		).toHaveCount(0);
	});

	for (const route of FORM_ROUTES) {
		test(`${route.path} shows the read-only notice`, async ({ page }) => {
			await page.goto(route.path);

			// Next.js also renders an (empty) route announcer with role "alert".
			const notice = page
				.getByRole("alert")
				.filter({ hasText: "Read-only access" });
			await expect(notice).toContainText("Read-only access");
			await expect(notice).toContainText(ADMIN_ONLY_MESSAGE);
			await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);

			await page.getByRole("link", { name: route.back }).click();
			await expect(page).toHaveURL(new RegExp(`${route.list}/?$`));
		});
	}

	test("a member can complete a maintenance log but not cancel it", async ({
		page,
	}) => {
		await page.goto("/asset/asset-maintenance/log");
		await page
			.getByPlaceholder("Search assets or tasks…")
			.fill(MAINTENANCE_ASSET_NAME);
		const row = tableRow(page, TASK_NAME);
		await expect(row).toBeVisible();
		await expect(row).toContainText("Planned");

		await row.getByRole("button", { name: /actions/i }).click();
		await expect(
			page.getByRole("menuitem", { name: "Cancel Log" }),
		).toHaveCount(0);
		await page.getByRole("menuitem", { name: "Mark Complete" }).click();

		const dialog = page.getByRole("dialog", {
			name: "Complete Maintenance Log",
		});
		await expect(dialog).toBeVisible();
		await submitAndWait(page, "asset.completeAssetMaintenanceLog", () =>
			dialog.getByRole("button", { name: "Mark Complete" }).click(),
		);
		await expect(
			toast(page, "Maintenance log marked as completed"),
		).toBeVisible();
		await expect(
			tableRow(page, TASK_NAME).filter({ hasText: "Completed" }),
		).toHaveCount(1);
	});

	test("the API reads for a member but rejects writes with FORBIDDEN", async ({
		request,
	}) => {
		const read = await request.get(
			`${E2E_BACKEND_URL}/trpc/asset.listLocations`,
		);
		expect(read.status()).toBe(200);

		const writes: { procedure: string; input: unknown }[] = [
			{
				procedure: "asset.createLocation",
				input: { name: `Blocked ${RUN}`, isGroup: false },
			},
			{
				procedure: "asset.createAssetCategory",
				input: { name: `Blocked ${RUN}` },
			},
			{
				procedure: "asset.submitAsset",
				input: { id: draftAssetId },
			},
			{
				procedure: "asset.deleteAsset",
				input: { id: draftAssetId },
			},
		];
		for (const { procedure, input } of writes) {
			const response = await request.post(
				`${E2E_BACKEND_URL}/trpc/${procedure}`,
				{ data: input },
			);
			expect(response.status(), procedure).toBe(403);
			const body = await response.json();
			expect(body.error.message, procedure).toContain("Insufficient role");
			expect(body.error.data.code, procedure).toBe("FORBIDDEN");
		}

		// Nothing was written: the draft asset is still a draft.
		const asset = await request.get(
			`${E2E_BACKEND_URL}/trpc/asset.getAssetById?input=${encodeURIComponent(JSON.stringify({ id: draftAssetId }))}`,
		);
		expect((await asset.json()).result.data.status).toBe("DRAFT");
	});
});
