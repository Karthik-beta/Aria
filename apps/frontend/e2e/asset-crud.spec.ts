import { expect, test } from "@playwright/test";
import {
	adminApi,
	cleanupRun,
	createCategory,
	createCompany,
	createDraftAsset,
	createLocation,
	isoDate,
	runId,
} from "./asset-fixtures";
import {
	confirmDelete,
	rowWithLink,
	submitAndWait,
	toast,
	trpcData,
} from "./asset-ui";
import { E2E_BACKEND_URL } from "./auth";

/**
 * Asset lifecycle through the UI against the real backend: create a draft,
 * edit it, submit, cancel, and delete a second draft. The company, category
 * and locations are prerequisites created through the API by the fixtures.
 */
const RUN = runId();
const ASSET_NAME = `Dell Laptop ${RUN}`;
const EDITED_ASSET_NAME = `Dell Laptop Pro ${RUN}`;
const DELETE_ASSET_NAME = `Disposable Monitor ${RUN}`;

const ASSET_LIST = "/asset/asset-sub-module/asset";

let companyName = "";
let categoryName = "";
let locationAName = "";
let locationBName = "";
let assetId = "";
let deletableAssetId = "";

test.describe.configure({ mode: "serial" });

test.describe("assets (real backend)", () => {
	test.beforeAll(async ({ playwright }) => {
		const api = await adminApi(playwright);
		const company = await createCompany(api, `E2E Company ${RUN}`);
		const category = await createCategory(api, `E2E Category ${RUN}`);
		const locationA = await createLocation(api, { name: `Store A ${RUN}` });
		const locationB = await createLocation(api, { name: `Store B ${RUN}` });
		companyName = company.name;
		categoryName = category.name;
		locationAName = locationA.name;
		locationBName = locationB.name;

		const deletable = await createDraftAsset(api, {
			assetName: DELETE_ASSET_NAME,
			company: company.name,
			assetCategoryId: category.id,
		});
		deletableAssetId = deletable.id;
		await api.dispose();
	});

	test.afterAll(async ({ playwright }) => {
		const api = await adminApi(playwright);
		await cleanupRun(api, RUN);
		await api.dispose();
	});

	test("creates a draft asset through the form", async ({ page }) => {
		await page.goto(`${ASSET_LIST}/form`);
		await expect(
			page.getByRole("heading", { name: "New Asset" }),
		).toBeVisible();

		await page.getByLabel(/Asset Name/).fill(ASSET_NAME);

		await page.locator("#company").click();
		await page.getByPlaceholder("Search companies…").fill(companyName);
		await page.getByRole("option", { name: companyName, exact: true }).click();

		await page.getByRole("button", { name: "Select category…" }).click();
		await page.getByPlaceholder("Search categories…").fill(categoryName);
		await page.getByRole("option", { name: categoryName, exact: true }).click();

		await page.getByRole("button", { name: "Select location…" }).click();
		await page.getByPlaceholder("Search locations…").fill(locationAName);
		await page
			.getByRole("option", { name: locationAName, exact: true })
			.click();

		await page.getByLabel("Purchase Date").fill(isoDate(-30));
		await page.getByLabel("Net Purchase Amount").fill("1200");

		const response = await submitAndWait(page, "asset.createAsset", () =>
			page.getByRole("button", { name: "Create Asset" }).click(),
		);
		assetId = (await trpcData<{ id: string }>(response)).id;
		await expect(toast(page, `Asset "${ASSET_NAME}" created`)).toBeVisible();

		// The form sends the user to the new asset's detail page.
		await expect(page).toHaveURL(new RegExp(`${ASSET_LIST}/${assetId}/?$`));
		await expect(page.getByRole("heading", { name: ASSET_NAME })).toBeVisible();
		await expect(page.getByText(/^Draft$/i)).toBeVisible();
	});

	test("lists the new asset as Draft", async ({ page }) => {
		await page.goto(ASSET_LIST);
		await page.getByPlaceholder("Search across all columns...").fill(RUN);

		const row = rowWithLink(page, ASSET_NAME);
		await expect(row).toBeVisible();
		await expect(row).toContainText(/Draft/i);
		await expect(row).toContainText(categoryName);
		await expect(row).toContainText(locationAName);
	});

	test("edits the draft asset name and location", async ({ page }) => {
		await page.goto(`${ASSET_LIST}/${assetId}`);
		await page.getByRole("link", { name: "Edit", exact: true }).click();
		await expect(page).toHaveURL(/asset\/form\/?\?id=/);

		const nameInput = page.getByLabel(/Asset Name/);
		await expect(nameInput).toHaveValue(ASSET_NAME);
		await nameInput.fill(EDITED_ASSET_NAME);

		await page.getByRole("button", { name: locationAName }).click();
		await page.getByPlaceholder("Search locations…").fill(locationBName);
		await page
			.getByRole("option", { name: locationBName, exact: true })
			.click();

		await submitAndWait(page, "asset.updateAsset", () =>
			page.getByRole("button", { name: "Update Asset" }).click(),
		);
		await expect(toast(page, "Asset updated")).toBeVisible();

		await expect(page).toHaveURL(new RegExp(`${ASSET_LIST}/${assetId}/?$`));

		// Reload: the detail page keeps its cached copy of the asset for a minute
		// after an edit, so only a fresh load proves what was saved.
		await page.reload();
		await expect(
			page.getByRole("heading", { name: EDITED_ASSET_NAME }),
		).toBeVisible();
		await expect(page.getByText(locationBName)).toBeVisible();
	});

	test("submits the asset from the detail page", async ({ page }) => {
		await page.goto(`${ASSET_LIST}/${assetId}`);
		await expect(page.getByText(/^Draft$/i)).toBeVisible();

		await submitAndWait(page, "asset.submitAsset", () =>
			page.getByRole("button", { name: "Submit", exact: true }).click(),
		);
		await expect(
			toast(page, "Asset submitted and depreciation schedules activated"),
		).toBeVisible();

		await expect(page.getByText(/^Submitted$/i)).toBeVisible();
		await expect(
			page.getByText("Asset submitted for depreciation"),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Submit", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Cancel Asset" }),
		).toBeVisible();
	});

	test("allows non-critical edits but the backend rejects depreciation-critical ones after submit", async ({
		page,
	}) => {
		// The edit form only sends non-critical fields for a submitted asset, so
		// the rejection is asserted against the API the form would hit.
		const response = await page.request.post(
			`${E2E_BACKEND_URL}/trpc/asset.updateAsset`,
			{ data: { id: assetId, netPurchaseAmount: 1 } },
		);
		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.error.message).toContain(
			"Depreciation-critical fields cannot be edited after submission",
		);
		expect(body.error.data.code).toBe("BAD_REQUEST");

		// A non-critical edit still works through the UI.
		await page.goto(`${ASSET_LIST}/form?id=${assetId}`);
		const department = page.getByLabel("Department");
		await expect(page.getByLabel(/Asset Name/)).toHaveValue(EDITED_ASSET_NAME);
		await department.fill("Engineering");
		await submitAndWait(page, "asset.updateAsset", () =>
			page.getByRole("button", { name: "Update Asset" }).click(),
		);
		await expect(toast(page, "Asset updated")).toBeVisible();
		await expect(page).toHaveURL(new RegExp(`${ASSET_LIST}/${assetId}/?$`));
		await page.reload();
		await expect(page.getByText("Engineering")).toBeVisible();
		await expect(page.getByText(/^Submitted$/i)).toBeVisible();
	});

	test("cancels the submitted asset", async ({ page }) => {
		await page.goto(`${ASSET_LIST}/${assetId}`);
		await expect(page.getByText(/^Submitted$/i)).toBeVisible();

		// Cancel Asset opens a confirmation that loads the cancellation preview.
		await page.getByRole("button", { name: "Cancel Asset" }).click();
		const dialog = page.getByRole("alertdialog", {
			name: "Cancel this asset?",
		});
		await expect(dialog).toBeVisible();
		// No depreciation has been posted yet, so cancelling is allowed.
		await expect(
			dialog.getByText("No depreciation has been posted for this asset."),
		).toBeVisible();
		const confirm = dialog.getByRole("button", { name: "Cancel Asset" });
		await expect(confirm).toBeEnabled();
		await submitAndWait(page, "asset.cancelAsset", () => confirm.click());
		await expect(toast(page, "Asset cancelled")).toBeVisible();
		await expect(page.getByText(/^Cancelled$/i)).toBeVisible();

		// The activity log (not the toast) records the cancellation.
		await page.reload();
		await expect(
			page.getByText("Asset cancelled", { exact: true }),
		).toBeVisible();

		await page.goto(ASSET_LIST);
		await page.getByPlaceholder("Search across all columns...").fill(RUN);
		await expect(rowWithLink(page, EDITED_ASSET_NAME)).toContainText(
			/Cancelled/i,
		);
	});

	test("deletes a draft asset from the detail page", async ({ page }) => {
		await page.goto(`${ASSET_LIST}/${deletableAssetId}`);
		await expect(
			page.getByRole("heading", { name: DELETE_ASSET_NAME }),
		).toBeVisible();

		await page.getByRole("button", { name: "Delete" }).click();
		await submitAndWait(page, "asset.deleteAsset", () => confirmDelete(page));
		await expect(toast(page, "Asset deleted successfully")).toBeVisible();
		await expect(page).toHaveURL(new RegExp(`${ASSET_LIST}/?$`));

		await page.getByPlaceholder("Search across all columns...").fill(RUN);
		await expect(rowWithLink(page, EDITED_ASSET_NAME)).toBeVisible();
		await expect(rowWithLink(page, DELETE_ASSET_NAME)).toHaveCount(0);

		// A fresh load of the detail page confirms it is gone.
		await page.goto(`${ASSET_LIST}/${deletableAssetId}`);
		await expect(page.getByText("Asset Not Found")).toBeVisible();
	});
});
