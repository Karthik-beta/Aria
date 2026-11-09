import { expect, type Page } from "@playwright/test";

type Workspace = {
	label: "CRM" | "Asset" | "HRMS";
	path:
		| "/crm/dashboard/overview"
		| "/asset/dashboard/overview"
		| "/hrms/dashboard/overview";
	heading: RegExp;
};

const WORKSPACES: Workspace[] = [
	{
		label: "CRM",
		path: "/crm/dashboard/overview",
		heading: /crm dashboard/i,
	},
	{
		label: "Asset",
		path: "/asset/dashboard/overview",
		heading: /asset dashboard/i,
	},
	{
		label: "HRMS",
		path: "/hrms/dashboard/overview",
		heading: /hrms dashboard/i,
	},
];

function escapeForRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pathMatcher(pathname: string) {
	return new RegExp(`${escapeForRegExp(pathname)}/?$`);
}

export async function expectPath(page: Page, pathname: string) {
	await expect(page).toHaveURL(pathMatcher(pathname));
}

export async function openWorkspaceSwitcher(page: Page) {
	await page.getByRole("button", { name: /inventory\s*aria erp/i }).click();
}

export async function switchWorkspace(page: Page, workspace: Workspace) {
	await openWorkspaceSwitcher(page);
	await page
		.getByRole("menuitem", { name: new RegExp(workspace.label, "i") })
		.click();
	await expectPath(page, workspace.path);
	await expect(
		page.getByRole("heading", { name: workspace.heading }),
	).toBeVisible();
}

export { WORKSPACES };
