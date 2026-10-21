import { expect, test } from "@playwright/test";
import { adminApi, cleanupRun, runId } from "./asset-fixtures";
import {
	clickRowAction,
	confirmDelete,
	idFromUrl,
	rowWithLink,
	submitAndWait,
	toast,
} from "./asset-ui";

/**
 * Creates an asset category with depreciation defaults, opens its detail
 * route, edits it and deletes it through the UI against the real backend.
 */
const RUN = runId();
const CATEGORY_NAME = `Laptops ${RUN}`;

const LIST_PATH = "/asset/asset-sub-module/asset-category";
const FORM_PATH = `${LIST_PATH}/form`;

let categoryId = "";

test.describe.configure({ mode: "serial" });

test.describe("asset categories (real backend)", () => {
	test.afterAll(async ({ playwright }) => {
		const api = await adminApi(playwright);
		await cleanupRun(api, RUN);
		await api.dispose();
	});

	test("creates a category with depreciation defaults", async ({ page }) => {
		await page.goto(FORM_PATH);
		await expect(
			page.getByRole("heading", { name: "New Asset Category" }),
		).toBeVisible();

		await page.getByLabel(/Category Name/).fill(CATEGORY_NAME);
		await page.getByRole("combobox", { name: /Depreciation Method/ }).click();
		await page.getByRole("option", { name: /^Straight Line/ }).click();
		await page.getByLabel(/Total Number of Depreciations/).fill("12");
		await page.getByLabel(/Frequency of Depreciation/).fill("3");

		await submitAndWait(page, "asset.createAssetCategory", () =>
			page.getByRole("button", { name: "Save" }).click(),
		);
		await expect(
			toast(page, "Asset category created successfully"),
		).toBeVisible();
		await expect(page).toHaveURL(/asset-category\/form\/?\?id=/);
		categoryId = idFromUrl(page);
	});

	test("shows the category in the list with its method", async ({ page }) => {
		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search categories…").fill(RUN);

		const row = rowWithLink(page, CATEGORY_NAME);
		await expect(row).toBeVisible();
		await expect(row).toContainText("Straight Line");
	});

	test("opens the detail page with the saved defaults", async ({ page }) => {
		// The detail route redirects to the edit form for the same category.
		await page.goto(`${LIST_PATH}/${categoryId}`);
		await expect(page).toHaveURL(
			new RegExp(`asset-category/form/?\\?id=${categoryId}`),
		);

		await expect(
			page.getByRole("heading", { name: CATEGORY_NAME }),
		).toBeVisible();
		await expect(page.getByLabel(/Category Name/)).toHaveValue(CATEGORY_NAME);
		await expect(page.getByLabel(/Total Number of Depreciations/)).toHaveValue(
			"12",
		);
		await expect(page.getByLabel(/Frequency of Depreciation/)).toHaveValue("3");
		await expect(
			page.getByRole("combobox", { name: /Depreciation Method/ }),
		).toContainText("Straight Line");
	});

	test("edits the category and the changes show everywhere", async ({
		page,
	}) => {
		await page.goto(`${FORM_PATH}?id=${categoryId}`);
		const total = page.getByLabel(/Total Number of Depreciations/);
		await expect(total).toHaveValue("12");

		await total.fill("24");
		await page.getByRole("combobox", { name: /Depreciation Method/ }).click();
		await page
			.getByRole("option", { name: /^Double Declining Balance/ })
			.click();

		await submitAndWait(page, "asset.updateAssetCategory", () =>
			page.getByRole("button", { name: "Save" }).click(),
		);
		await expect(
			toast(page, "Asset category updated successfully"),
		).toBeVisible();

		// Detail route after a reload reflects the edit ...
		await page.goto(`${LIST_PATH}/${categoryId}`);
		await expect(page.getByLabel(/Total Number of Depreciations/)).toHaveValue(
			"24",
		);

		// ... and so does the list.
		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search categories…").fill(RUN);
		await expect(rowWithLink(page, CATEGORY_NAME)).toContainText(
			"Double Declining Balance",
		);
	});

	test("deletes the category", async ({ page }) => {
		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search categories…").fill(RUN);
		await expect(rowWithLink(page, CATEGORY_NAME)).toBeVisible();

		await clickRowAction(page, CATEGORY_NAME, "Delete Category");
		await submitAndWait(page, "asset.deleteAssetCategory", () =>
			confirmDelete(page),
		);
		await expect(rowWithLink(page, CATEGORY_NAME)).toHaveCount(0);

		// The detail route no longer finds it after a fresh load.
		await page.goto(`${LIST_PATH}/${categoryId}`);
		await expect(page.getByText("Asset category not found")).toBeVisible();
	});
});
