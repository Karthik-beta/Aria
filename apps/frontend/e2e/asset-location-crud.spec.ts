import { expect, test } from "@playwright/test";
import { adminApi, cleanupRun, runId } from "./asset-fixtures";
import {
	clickRowAction,
	confirmDelete,
	idFromUrl,
	rowWithLink,
	submitAndWait,
	tableRow,
	toast,
} from "./asset-ui";

/**
 * Creates, edits and deletes locations through the UI against the real
 * backend: a group, a leaf child (parent picker), rename, and delete.
 */
const RUN = runId();
const GROUP_NAME = `Block ${RUN}`;
const CHILD_NAME = `Rack ${RUN}`;
const RENAMED_CHILD_NAME = `Shelf ${RUN}`;

const LIST_PATH = "/asset/asset-sub-module/location";
const FORM_PATH = `${LIST_PATH}/form`;

test.describe.configure({ mode: "serial" });

test.describe("asset locations (real backend)", () => {
	test.afterAll(async ({ playwright }) => {
		const api = await adminApi(playwright);
		await cleanupRun(api, RUN);
		await api.dispose();
	});

	test("creates a group location", async ({ page }) => {
		await page.goto(FORM_PATH);
		await expect(
			page.getByRole("heading", { name: "New Location" }),
		).toBeVisible();

		await page.getByLabel(/Location Name/).fill(GROUP_NAME);
		await page.getByRole("checkbox", { name: "Is Group" }).click();

		await submitAndWait(page, "asset.createLocation", () =>
			page.getByRole("button", { name: "Save" }).click(),
		);
		await expect(toast(page, "Location created successfully")).toBeVisible();
		await expect(page).toHaveURL(/location\/form\/?\?id=/);
		await expect(page.getByRole("heading", { name: GROUP_NAME })).toBeVisible();
		idFromUrl(page);
	});

	test("creates a child leaf location under the group", async ({ page }) => {
		await page.goto(FORM_PATH);

		await page.getByLabel(/Location Name/).fill(CHILD_NAME);
		await page.getByRole("combobox", { name: "Parent Location" }).click();
		await page.getByRole("option", { name: GROUP_NAME, exact: true }).click();

		await submitAndWait(page, "asset.createLocation", () =>
			page.getByRole("button", { name: "Save" }).click(),
		);
		await expect(toast(page, "Location created successfully")).toBeVisible();
		await expect(page.getByRole("heading", { name: CHILD_NAME })).toBeVisible();
	});

	test("lists both locations and filters them by search", async ({ page }) => {
		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search locations…").fill(RUN);

		const groupRow = rowWithLink(page, GROUP_NAME);
		const childRow = rowWithLink(page, CHILD_NAME);
		await expect(groupRow).toBeVisible();
		await expect(childRow).toBeVisible();
		await expect(groupRow).toContainText("Group");
		await expect(childRow).toContainText("Leaf");
		// The child row names its parent.
		await expect(childRow).toContainText(GROUP_NAME);

		// A search that matches only the child hides the group.
		await page.getByPlaceholder("Search locations…").fill(CHILD_NAME);
		await expect(childRow).toBeVisible();
		await expect(groupRow).toHaveCount(0);
	});

	test("edits the child location name", async ({ page }) => {
		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search locations…").fill(CHILD_NAME);
		await page.getByRole("link", { name: CHILD_NAME, exact: true }).click();

		await expect(page).toHaveURL(/location\/form\/?\?id=/);
		const nameInput = page.getByLabel(/Location Name/);
		await expect(nameInput).toHaveValue(CHILD_NAME);
		await nameInput.fill(RENAMED_CHILD_NAME);

		await submitAndWait(page, "asset.updateLocation", () =>
			page.getByRole("button", { name: "Save" }).click(),
		);
		await expect(toast(page, "Location updated successfully")).toBeVisible();

		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search locations…").fill(RUN);
		await expect(tableRow(page, RENAMED_CHILD_NAME)).toBeVisible();
		await expect(tableRow(page, CHILD_NAME)).toHaveCount(0);
	});

	// The backend rejects deleting a group that still has child locations
	// ("Cannot delete a location that has child locations").
	test("rejects deleting the group while it has a child (#141)", async ({
		page,
	}) => {
		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search locations…").fill(GROUP_NAME);
		await clickRowAction(
			page,
			rowWithLink(page, GROUP_NAME),
			"Delete Location",
		);
		await confirmDelete(page);

		await expect(toast(page, /child/i)).toBeVisible();
		await expect(rowWithLink(page, GROUP_NAME)).toBeVisible();
	});

	test("deletes the child location", async ({ page }) => {
		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search locations…").fill(RUN);
		await expect(tableRow(page, RENAMED_CHILD_NAME)).toBeVisible();

		await clickRowAction(page, RENAMED_CHILD_NAME, "Delete Location");
		await submitAndWait(page, "asset.deleteLocation", () =>
			confirmDelete(page),
		);
		await expect(toast(page, "Location deleted successfully")).toBeVisible();
		await expect(tableRow(page, RENAMED_CHILD_NAME)).toHaveCount(0);
	});

	// A new page load per delete: after a delete dialog opened from a row menu
	// closes, the page keeps `pointer-events: none` on <body>, which blocks the
	// next menu click.
	test("deletes the group location", async ({ page }) => {
		await page.goto(LIST_PATH);
		await page.getByPlaceholder("Search locations…").fill(RUN);
		await expect(rowWithLink(page, GROUP_NAME)).toBeVisible();
		await expect(tableRow(page, RENAMED_CHILD_NAME)).toHaveCount(0);

		await clickRowAction(
			page,
			rowWithLink(page, GROUP_NAME),
			"Delete Location",
		);
		await submitAndWait(page, "asset.deleteLocation", () =>
			confirmDelete(page),
		);
		await expect(rowWithLink(page, GROUP_NAME)).toHaveCount(0);

		// A fresh load confirms the deletes reached the database.
		await page.reload();
		await page.getByPlaceholder("Search locations…").fill(RUN);
		await expect(page.getByText("No data available")).toBeVisible();
	});
});
