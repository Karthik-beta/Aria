import { expect, test } from "@playwright/test";
import {
	adminApi,
	cleanupRun,
	createCompany,
	createSubmittedAsset,
	isoDate,
	runId,
	trpcQuery,
} from "./asset-fixtures";
import {
	clickRowAction,
	confirmDelete,
	rowWithLink,
	submitAndWait,
	tableRow,
	toast,
	trpcData,
} from "./asset-ui";

/**
 * Maintenance team and asset maintenance through the UI against the real
 * backend: create a team, schedule maintenance for a submitted asset, find the
 * generated log, complete it, then delete the maintenance and the team.
 *
 * The maintenance form currently asks for the asset and team ids as plain
 * text and has no assignee column, so the ids come from the API fixtures and
 * no assignee is set.
 */
const RUN = runId();
const TEAM_NAME = `Facilities ${RUN}`;
const ASSET_NAME = `Chiller ${RUN}`;
const TASK_NAME = `Inspect compressor ${RUN}`;

const TEAM_LIST = "/asset/asset-maintenance/maintenance-team";
const MAINTENANCE_LIST = "/asset/asset-maintenance/maintenance";
const LOG_LIST = "/asset/asset-maintenance/log";

let companyName = "";
let assetId = "";
let teamId = "";
let maintenanceId = "";
let nextDueBefore = "";

type MaintenanceRecord = {
	tasks: { nextDueDate: string | null; lastCompletionDate: string | null }[];
};

test.describe.configure({ mode: "serial" });

test.describe("asset maintenance (real backend)", () => {
	test.beforeAll(async ({ playwright }) => {
		const api = await adminApi(playwright);
		const company = await createCompany(api, `E2E Company ${RUN}`);
		companyName = company.name;
		const asset = await createSubmittedAsset(api, {
			assetName: ASSET_NAME,
			company: company.name,
		});
		assetId = asset.id;
		await api.dispose();
	});

	test.afterAll(async ({ playwright }) => {
		const api = await adminApi(playwright);
		await cleanupRun(api, RUN);
		await api.dispose();
	});

	test("creates a maintenance team with a member and a manager", async ({
		page,
	}) => {
		await page.goto(`${TEAM_LIST}/form`);
		await expect(
			page.getByRole("heading", { name: "New Maintenance Team" }),
		).toBeVisible();

		await page.getByLabel(/Team Name/).fill(TEAM_NAME);
		await page.locator("#company").click();
		await page.getByPlaceholder("Search companies…").fill(companyName);
		await page.getByRole("option", { name: companyName, exact: true }).click();

		await page.getByLabel("Maintenance Manager").fill("manager@aria.test");
		await page.getByLabel("Manager Display Name").fill("E2E Manager");

		await page.getByRole("button", { name: "Add Member" }).click();
		await page.getByPlaceholder("Member ID or email").fill("tech@aria.test");
		await page
			.getByPlaceholder("Full name", { exact: true })
			.fill("E2E Technician");
		await page.getByPlaceholder("Role name").fill("Technician");

		const response = await submitAndWait(
			page,
			"asset.createMaintenanceTeam",
			() => page.getByRole("button", { name: "Save" }).click(),
		);
		teamId = (await trpcData<{ id: string }>(response)).id;
		await expect(
			toast(page, "Maintenance team created successfully"),
		).toBeVisible();
		await expect(page).toHaveURL(
			new RegExp(`maintenance-team/form/?\\?id=${teamId}`),
		);
	});

	test("lists the team", async ({ page }) => {
		await page.goto(TEAM_LIST);
		await page.getByPlaceholder("Search teams…").fill(RUN);
		await expect(rowWithLink(page, TEAM_NAME)).toBeVisible();
	});

	test("creates an asset maintenance with one task", async ({ page }) => {
		await page.goto("/asset/asset-maintenance/form");
		await expect(page.getByLabel(/Asset ID/)).toBeVisible();

		await page.getByLabel(/Asset ID/).fill(assetId);
		await page.locator("#company").click();
		await page.getByPlaceholder("Search companies…").fill(companyName);
		await page.getByRole("option", { name: companyName, exact: true }).click();
		await page.getByLabel(/Maintenance Team ID/).fill(teamId);

		await page.getByRole("button", { name: "Add Task" }).click();
		await page.getByPlaceholder("Task name").fill(TASK_NAME);
		const taskRow = page.getByRole("row").filter({
			has: page.getByPlaceholder("Task name"),
		});
		// The row has the Type and Periodicity selects, in that order.
		await taskRow.getByRole("combobox").nth(1).click();
		await page.getByRole("option", { name: "Monthly", exact: true }).click();
		// Ten days ago, so the next due date is in the future and moves when the
		// log is completed today.
		await taskRow.locator('input[type="date"]').first().fill(isoDate(-10));

		const response = await submitAndWait(
			page,
			"asset.createAssetMaintenance",
			() => page.getByRole("button", { name: "Save" }).click(),
		);
		maintenanceId = (await trpcData<{ id: string }>(response)).id;
		await expect(
			toast(page, "Asset maintenance created successfully"),
		).toBeVisible();
		await expect(page).toHaveURL(
			new RegExp(`asset-maintenance/form/?\\?id=${maintenanceId}`),
		);
	});

	test("lists the maintenance and its generated log", async ({
		page,
		request,
	}) => {
		// The form's "Back to List" button points at /asset/asset-maintenance,
		// which has no page until #145 lands, so navigate to the list directly.
		await page.goto(MAINTENANCE_LIST);
		await page.getByPlaceholder("Search assets…").fill(ASSET_NAME);
		const row = rowWithLink(page, ASSET_NAME);
		await expect(row).toBeVisible();
		await expect(row).toContainText(TEAM_NAME);
		await expect(row).toContainText("Planned");

		await page.goto(LOG_LIST);
		await page.getByPlaceholder("Search assets or tasks…").fill(ASSET_NAME);
		const logRow = tableRow(page, TASK_NAME);
		await expect(logRow).toBeVisible();
		await expect(logRow).toContainText(ASSET_NAME);
		await expect(logRow).toContainText("Planned");

		const record = await trpcQuery<MaintenanceRecord>(
			request,
			"asset.getAssetMaintenanceById",
			{ id: maintenanceId },
		);
		nextDueBefore = record.tasks[0]?.nextDueDate ?? "";
		expect(nextDueBefore).not.toBe("");
	});

	test("completes the log and moves the task's next due date", async ({
		page,
		request,
	}) => {
		await page.goto(LOG_LIST);
		await page.getByPlaceholder("Search assets or tasks…").fill(ASSET_NAME);
		await expect(tableRow(page, TASK_NAME)).toBeVisible();

		await clickRowAction(page, TASK_NAME, "Mark Complete");
		const dialog = page.getByRole("dialog", {
			name: "Complete Maintenance Log",
		});
		await expect(dialog).toBeVisible();
		await dialog
			.getByLabel("Actions Performed")
			.fill("Replaced the compressor filter");

		await submitAndWait(page, "asset.completeAssetMaintenanceLog", () =>
			dialog.getByRole("button", { name: "Mark Complete" }).click(),
		);
		await expect(
			toast(page, "Maintenance log marked as completed"),
		).toBeVisible();

		// The completed log stays in the list; a new planned log is generated.
		await expect(
			tableRow(page, TASK_NAME).filter({ hasText: "Completed" }),
		).toHaveCount(1);

		await expect
			.poll(async () => {
				const record = await trpcQuery<MaintenanceRecord>(
					request,
					"asset.getAssetMaintenanceById",
					{ id: maintenanceId },
				);
				return record.tasks[0]?.nextDueDate ?? "";
			})
			.not.toBe(nextDueBefore);

		const after = await trpcQuery<MaintenanceRecord>(
			request,
			"asset.getAssetMaintenanceById",
			{ id: maintenanceId },
		);
		expect(after.tasks[0]?.lastCompletionDate).toBeTruthy();
		expect(
			new Date(after.tasks[0]?.nextDueDate ?? 0).getTime(),
		).toBeGreaterThan(new Date(nextDueBefore).getTime());
	});

	test("deletes the maintenance", async ({ page }) => {
		await page.goto(MAINTENANCE_LIST);
		await page.getByPlaceholder("Search assets…").fill(ASSET_NAME);
		await expect(rowWithLink(page, ASSET_NAME)).toBeVisible();

		await clickRowAction(page, ASSET_NAME, "Delete Maintenance");
		await submitAndWait(page, "asset.deleteAssetMaintenance", () =>
			confirmDelete(page),
		);
		await expect(
			toast(page, "Asset maintenance deleted successfully"),
		).toBeVisible();
		await expect(rowWithLink(page, ASSET_NAME)).toHaveCount(0);
	});

	test("deletes the team", async ({ page }) => {
		await page.goto(TEAM_LIST);
		await page.getByPlaceholder("Search teams…").fill(RUN);
		await expect(rowWithLink(page, TEAM_NAME)).toBeVisible();

		await clickRowAction(page, TEAM_NAME, "Delete Team");
		await submitAndWait(page, "asset.deleteMaintenanceTeam", () =>
			confirmDelete(page),
		);
		await expect(
			toast(page, "Maintenance team deleted successfully"),
		).toBeVisible();
		await expect(rowWithLink(page, TEAM_NAME)).toHaveCount(0);
	});
});
