import {
	expect,
	type Locator,
	type Page,
	type Response,
} from "@playwright/test";

/**
 * UI helpers shared by the real-backend asset specs.
 *
 * Writes wait on the tRPC mutation response rather than on timers, and list
 * assertions wait on the visible row, because the list pages refresh through
 * optimistic updates and realtime invalidation.
 */

/**
 * Resolves with the response of the tRPC call to `procedure`. The frontend
 * uses `httpBatchLink`, so the procedure name appears in the URL path
 * (`/trpc/asset.createLocation?batch=1`). Start waiting before the action that
 * triggers the call.
 */
export function waitForTrpc(
	page: Page,
	procedure: string,
	method: "GET" | "POST" = "POST",
): Promise<Response> {
	return page.waitForResponse(
		(response) =>
			response.url().includes("/trpc/") &&
			response
				.url()
				.split("?")[0]
				?.split("/trpc/")[1]
				?.split(",")
				.includes(procedure) === true &&
			response.request().method() === method,
	);
}

/** Runs `action` and returns the matching tRPC mutation response once it is OK. */
export async function submitAndWait(
	page: Page,
	procedure: string,
	action: () => Promise<void>,
): Promise<Response> {
	const responsePromise = waitForTrpc(page, procedure);
	await action();
	const response = await responsePromise;
	expect(response.ok(), `${procedure}: ${await response.text()}`).toBe(true);
	return response;
}

/**
 * The `data` of a tRPC response. Batched calls answer with an array of
 * results, single calls with one result object.
 */
export async function trpcData<T>(response: Response): Promise<T> {
	const body = await response.json();
	const result = Array.isArray(body) ? body[0] : body;
	return result.result.data as T;
}

/** A success toast (sonner) with the given text. */
export function toast(page: Page, text: string | RegExp): Locator {
	return page.locator("[data-sonner-toast]").filter({ hasText: text }).first();
}

/** The table row whose text contains `text`. */
export function tableRow(page: Page, text: string | RegExp): Locator {
	return page.getByRole("row").filter({ hasText: text });
}

/**
 * The row whose name cell is a link to `name`. Use it when another row's text
 * can contain the same string (for example a child row naming its parent).
 */
export function rowWithLink(page: Page, name: string): Locator {
	return page
		.getByRole("row")
		.filter({ has: page.getByRole("link", { name, exact: true }) });
}

/**
 * Opens the row's actions menu and clicks the given menu item. `row` is the
 * text the row contains, or an already narrowed row locator (for example from
 * `rowWithLink`) when other rows can contain the same text.
 */
export async function clickRowAction(
	page: Page,
	row: string | RegExp | Locator,
	action: string | RegExp,
) {
	const rowLocator =
		typeof row === "string" || row instanceof RegExp
			? tableRow(page, row)
			: row;
	await rowLocator.getByRole("button", { name: /actions/i }).click();
	await page.getByRole("menuitem", { name: action }).click();
}

/** Confirms the shared "Are you sure?" delete dialog. */
export async function confirmDelete(page: Page) {
	const dialog = page.getByRole("dialog", { name: "Are you sure?" });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "Continue" }).click();
}

/** Picks an option from a cmdk popover picker (company, category, location). */
export async function pickFromPopover(
	page: Page,
	trigger: Locator,
	optionName: string,
) {
	await trigger.click();
	await page.getByRole("option", { name: optionName, exact: true }).click();
}

/** Reads the id query parameter the form pages redirect to after a create. */
export function idFromUrl(page: Page): string {
	const id = new URL(page.url()).searchParams.get("id");
	if (!id) throw new Error(`No id query parameter in ${page.url()}`);
	return id;
}
