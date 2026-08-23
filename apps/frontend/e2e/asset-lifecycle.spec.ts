import type { Page } from "@playwright/test";
import {
	acceptE2EOrganizationInvitation,
	callAuth,
	callTrpc,
	createE2ECompany,
	createE2EFinanceBook,
	createE2EUser,
	deleteE2ECompany,
	deleteE2EFinanceBook,
	deleteE2EUser,
	type E2ECompany,
	type E2EFinanceBook,
	type E2EOrganization,
	expect,
	inviteE2EOrganizationMember,
	removeE2EOrganizationMember,
	setActiveE2EOrganization,
	test,
} from "./fixtures";

test.describe.configure({ mode: "serial", timeout: 300_000 });

type E2EAsset = {
	id: string;
	assetName: string;
	assetType: string;
	companyId: string;
	company: string;
	purchaseDate: string | null;
	availableForUseDate: string | null;
	netPurchaseAmount: number | null;
	calculateDepreciation: boolean;
	depreciationStartDate: string | null;
	status: string;
	financeBooks?: Array<{
		financeBookId: string;
		financeBookName: string;
		depreciationStartDate: string;
		totalNumberOfDepreciations: number;
		frequencyOfDepreciation: number;
		postingStatus: string;
	}>;
};

function dateOnly(value: string | null | undefined) {
	return value?.slice(0, 10) ?? null;
}

async function createAssetThroughForm(
	page: Page,
	company: E2ECompany,
	financeBook: E2EFinanceBook,
	assetName: string,
) {
	await page.goto("/asset/items/form", { waitUntil: "networkidle" });
	await expect(page.getByRole("heading", { name: "New Asset" })).toBeVisible({
		timeout: 90_000,
	});

	const companySelect = page.getByRole("button", { name: "Select company…" });
	await expect(companySelect).toBeVisible({ timeout: 90_000 });
	await expect(companySelect).toHaveAttribute("data-state", "closed", {
		timeout: 90_000,
	});
	await companySelect.click();
	await page.getByPlaceholder("Search companies…").fill(company.name);
	const companyOption = page.getByRole("option", {
		name: company.name,
		exact: true,
	});
	await expect(companyOption).toBeVisible({ timeout: 90_000 });
	await companyOption.click();
	await expect(companySelect).toContainText(company.name);

	await page.locator("#assetName").fill(assetName);
	await page.locator("#assetType").selectOption("EXISTING_ASSET");
	await page.locator("#purchaseDate").fill("2026-08-10");
	await page.locator("#availableForUseDate").fill("2026-08-10");
	await page.locator("#netPurchaseAmount").fill("1234.50");
	await page.getByLabel("Calculate Depreciation", { exact: true }).click();

	const method = page.locator("#depreciationMethod");
	await expect(method).toBeVisible();
	await method.click();
	await page.getByRole("option", { name: /Straight Line/i }).click();
	await page.locator("#totalNumberOfDepreciations").fill("12");
	await page.locator("#frequencyOfDepreciation").fill("1");
	await page.locator("#expectedValueAfterUsefulLife").fill("10");
	await page.locator("#depreciationStartDate").fill("2026-08-31");

	await page.getByRole("button", { name: "Add Book", exact: true }).click();
	const bookSelect = page.locator(
		'select[name="financeBooks.0.financeBookId"]',
	);
	await expect(bookSelect).toHaveCount(1);
	await bookSelect.selectOption(financeBook.id);
	await page.locator("#financeBooks-0-totalNumberOfDepreciations").fill("12");
	await page
		.locator('input[name="financeBooks.0.frequencyOfDepreciation"]')
		.fill("1");
	await page
		.locator('input[name="financeBooks.0.depreciationStartDate"]')
		.fill("2026-08-31");

	await page.getByRole("button", { name: "Create Asset", exact: true }).click();
	await page.waitForURL(/\/asset\/items\/(?!form(?:\/|$))[^/]+\/?$/, {
		timeout: 90_000,
	});
	const assetId = page.url().match(/\/asset\/items\/([^/]+)\/?$/)?.[1];
	if (!assetId)
		throw new Error(`Could not read created Asset id from ${page.url()}`);
	return assetId;
}

test.describe("Asset Lifecycle E2E Workflow", () => {
	test("should navigate to assets page and expose the owner create entrypoint", async ({
		page,
	}) => {
		await page.goto("/asset/items");
		await expect(page.getByRole("heading", { name: /assets/i })).toBeVisible({
			timeout: 90_000,
		});
		await expect(
			page.getByRole("button", { name: "Add Asset", exact: true }),
		).toBeEnabled();
	});

	test("creates a supported Asset and preserves finance-book dates through reload and submit", async ({
		page,
	}) => {
		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const company = await createE2ECompany(
			page,
			`Wave4 Browser Company ${suffix}`,
		);
		const financeBook = await createE2EFinanceBook(
			page,
			`Wave4 Browser Finance Book ${suffix}`,
		);
		let assetId: string | undefined;

		try {
			assetId = await createAssetThroughForm(
				page,
				company,
				financeBook,
				`Wave4 Browser Asset ${suffix}`,
			);

			const created = await callTrpc<E2EAsset>(page, "asset.getAssetById", {
				id: assetId,
			});
			expect(created).toMatchObject({
				id: assetId,
				assetType: "EXISTING_ASSET",
				companyId: company.id,
				company: company.name,
				purchaseDate: expect.any(String),
				availableForUseDate: expect.any(String),
				netPurchaseAmount: 1234.5,
				calculateDepreciation: true,
				status: "DRAFT",
			});
			expect(dateOnly(created.purchaseDate)).toBe("2026-08-10");
			expect(dateOnly(created.availableForUseDate)).toBe("2026-08-10");
			expect(dateOnly(created.depreciationStartDate)).toBe("2026-08-31");
			expect(created.financeBooks).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						financeBookId: financeBook.id,
						financeBookName: financeBook.name,
						depreciationStartDate: "2026-08-31",
						totalNumberOfDepreciations: 12,
						frequencyOfDepreciation: 1,
						postingStatus: "PENDING",
					}),
				]),
			);

			await page.goto(`/asset/items/form?id=${assetId}`, {
				waitUntil: "networkidle",
			});
			await expect(
				page.getByRole("heading", { name: "Edit Asset" }),
			).toBeVisible({
				timeout: 90_000,
			});
			await expect(page.locator("#company")).toContainText(company.name);
			await expect(page.locator("#purchaseDate")).toHaveValue("2026-08-10");
			await expect(page.locator("#availableForUseDate")).toHaveValue(
				"2026-08-10",
			);
			await expect(page.locator("#depreciationStartDate")).toHaveValue(
				"2026-08-31",
			);
			await expect(
				page.locator('select[name="financeBooks.0.financeBookId"]'),
			).toHaveValue(financeBook.id);
			await expect(
				page.locator('input[name="financeBooks.0.depreciationStartDate"]'),
			).toHaveValue("2026-08-31");

			await page.reload({ waitUntil: "networkidle" });
			await expect(
				page.getByRole("heading", { name: "Edit Asset" }),
			).toBeVisible({
				timeout: 90_000,
			});
			await expect(page.locator("#purchaseDate")).toHaveValue("2026-08-10");
			await expect(page.locator("#availableForUseDate")).toHaveValue(
				"2026-08-10",
			);
			await expect(
				page.locator('input[name="financeBooks.0.depreciationStartDate"]'),
			).toHaveValue("2026-08-31");

			await page.goto(`/asset/items/${assetId}`, {
				waitUntil: "networkidle",
			});
			await expect(
				page.getByRole("heading", { name: `Wave4 Browser Asset ${suffix}` }),
			).toBeVisible({ timeout: 90_000 });
			await expect(
				page.locator("main").getByText("DRAFT", { exact: true }).first(),
			).toBeVisible();
			const submitResponse = page.waitForResponse((response) =>
				response.url().includes("/trpc/asset.submitAsset"),
			);
			await page.getByRole("button", { name: "Submit", exact: true }).click();
			const submitResult = await submitResponse;
			if (!submitResult.ok()) {
				throw new Error(
					`Asset submit failed (${submitResult.status()}): ${await submitResult.text()}`,
				);
			}
			await expect(
				page.locator("main").getByText("SUBMITTED", { exact: true }).first(),
			).toBeVisible({
				timeout: 90_000,
			});
			await page.reload({ waitUntil: "networkidle" });
			await expect(
				page.locator("main").getByText("SUBMITTED", { exact: true }).first(),
			).toBeVisible({
				timeout: 90_000,
			});

			const submitted = await callTrpc<E2EAsset>(page, "asset.getAssetById", {
				id: assetId,
			});
			expect(submitted.status).toBe("SUBMITTED");
			expect(
				submitted.financeBooks?.find(
					(book) => book.financeBookId === financeBook.id,
				)?.postingStatus,
			).toBe("PENDING");
			const schedules = await callTrpc<{ items: Array<{ status: string }> }>(
				page,
				"asset.getAssetDepreciationSchedules",
				{ assetId },
			);
			expect(schedules.items.length).toBeGreaterThan(0);
			expect(
				schedules.items.every((schedule) => schedule.status === "ACTIVE"),
			).toBe(true);
		} finally {
			let canDeleteReferences = true;
			if (assetId) {
				let current = await callTrpc<E2EAsset | null>(
					page,
					"asset.getAssetById",
					{ id: assetId },
				).catch(() => null);
				if (current?.status === "SUBMITTED") {
					current = await callTrpc<E2EAsset>(
						page,
						"asset.cancelAsset",
						{ id: assetId },
						"mutation",
					);
				}
				if (current?.status === "DRAFT") {
					const schedules = await callTrpc<{
						items: Array<{ id: string }>;
					}>(page, "asset.getAssetDepreciationSchedules", { assetId });
					if (schedules.items.length === 0) {
						await callTrpc(
							page,
							"asset.deleteAsset",
							{ id: assetId },
							"mutation",
						);
					} else {
						canDeleteReferences = false;
					}
				} else if (current) {
					// Cancelled lifecycle schedules are intentionally retained by the API.
					canDeleteReferences = false;
				}
			}
			if (canDeleteReferences) {
				await deleteE2EFinanceBook(page, financeBook.id);
				await deleteE2ECompany(page, company.id);
			}
		}
	});

	test("isolates Asset cache across the real organization switcher", async ({
		page,
	}) => {
		const session = await callAuth<{
			session?: { activeOrganizationId?: string | null };
		}>(page, "/get-session");
		const originalOrganizationId = session.session?.activeOrganizationId;
		if (!originalOrganizationId) {
			throw new Error("The authenticated admin has no active organization");
		}

		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const organizations = await callAuth<
			Array<{ id: string; name: string; slug: string }>
		>(page, "/organization/list");
		const assetOrganization = organizations.find((org) => org.slug === "asset");
		const inventoryOrganization = organizations.find(
			(org) => org.slug === "inventory",
		);
		if (!assetOrganization || !inventoryOrganization) {
			throw new Error(
				"Wave 4 organization-switch proof requires existing asset and inventory workspace organizations",
			);
		}
		let assetCompany: E2ECompany | undefined;
		let inventoryCompany: E2ECompany | undefined;
		let assetId: string | undefined;
		let inventoryAssetId: string | undefined;

		try {
			await setActiveE2EOrganization(page, assetOrganization.id);
			assetCompany = await createE2ECompany(
				page,
				`Wave4 Asset Company ${suffix}`,
			);
			const assetName = `Wave4 Asset ${suffix}`;
			const asset = await callTrpc<{ id: string }>(
				page,
				"asset.createAsset",
				{
					assetName,
					assetType: "EXISTING_ASSET",
					companyId: assetCompany.id,
					purchaseDate: "2026-08-10",
					availableForUseDate: "2026-08-10",
					netPurchaseAmount: 1,
					calculateDepreciation: false,
				},
				"mutation",
			);
			assetId = asset.id;

			await page.goto("/asset/items", { waitUntil: "networkidle" });
			await expect(
				page.getByRole("link", { name: assetName, exact: true }),
			).toBeVisible({ timeout: 90_000 });

			await page
				.getByRole("button", { name: "Asset by Pivotr", exact: true })
				.click();
			await page.getByRole("menuitem", { name: /^Inventory/ }).click();
			await expect(page).toHaveURL(/\/inventory(?:\/|$)/, {
				timeout: 90_000,
			});
			await expect
				.poll(
					async () =>
						(
							await callAuth<{
								session?: { activeOrganizationId?: string | null };
							}>(page, "/get-session")
						).session?.activeOrganizationId,
					{ timeout: 90_000 },
				)
				.toBe(inventoryOrganization.id);
			await expect(
				page.getByRole("button", { name: "Inventory by Pivotr", exact: true }),
			).toBeVisible({ timeout: 90_000 });

			inventoryCompany = await createE2ECompany(
				page,
				`Wave4 Inventory Company ${suffix}`,
			);
			const inventoryAssetName = `Wave4 Inventory Asset ${suffix}`;
			const inventoryAsset = await callTrpc<{ id: string }>(
				page,
				"asset.createAsset",
				{
					assetName: inventoryAssetName,
					assetType: "EXISTING_ASSET",
					companyId: inventoryCompany.id,
					purchaseDate: "2026-08-10",
					availableForUseDate: "2026-08-10",
					netPurchaseAmount: 1,
					calculateDepreciation: false,
				},
				"mutation",
			);
			inventoryAssetId = inventoryAsset.id;

			await page
				.getByRole("button", { name: "Inventory by Pivotr", exact: true })
				.click();
			await page.getByRole("menuitem", { name: /^Asset/ }).click();
			await expect(page).toHaveURL(/\/asset(?:\/|$)/, {
				timeout: 90_000,
			});
			await expect
				.poll(
					async () =>
						(
							await callAuth<{
								session?: { activeOrganizationId?: string | null };
							}>(page, "/get-session")
						).session?.activeOrganizationId,
					{ timeout: 90_000 },
				)
				.toBe(assetOrganization.id);
			await page
				.getByRole("link", { name: "View all assets →", exact: true })
				.click();
			await expect(page).toHaveURL(/\/asset\/items(?:\/|$)/);
			await expect(
				page.getByRole("link", { name: assetName, exact: true }),
			).toBeVisible({ timeout: 90_000 });
			await expect(
				page.getByRole("link", { name: inventoryAssetName, exact: true }),
			).toHaveCount(0);
		} finally {
			await setActiveE2EOrganization(page, assetOrganization.id);
			if (assetId) {
				await callTrpc(page, "asset.deleteAsset", { id: assetId }, "mutation");
			}
			if (assetCompany) {
				await deleteE2ECompany(page, assetCompany.id);
			}
			await setActiveE2EOrganization(page, inventoryOrganization.id);
			if (inventoryAssetId) {
				await callTrpc(
					page,
					"asset.deleteAsset",
					{ id: inventoryAssetId },
					"mutation",
				);
			}
			if (inventoryCompany) {
				await deleteE2ECompany(page, inventoryCompany.id);
			}
			await setActiveE2EOrganization(page, originalOrganizationId);
		}
	});

	test("denies member direct form and backend Asset writes while admin remains functional", async ({
		page,
		browser,
	}) => {
		const session = await callAuth<{
			session?: { activeOrganizationId?: string | null };
		}>(page, "/get-session");
		const originalOrganizationId = session.session?.activeOrganizationId;
		if (!originalOrganizationId) {
			throw new Error("The authenticated admin has no active organization");
		}
		const organizations = await callAuth<E2EOrganization[]>(
			page,
			"/organization/list",
		);
		const assetOrganization = organizations.find(
			(organization) => organization.slug === "asset",
		);
		if (!assetOrganization) {
			throw new Error(
				"Member Asset route proof requires the existing asset workspace organization",
			);
		}
		const organizationId = assetOrganization.id;
		await setActiveE2EOrganization(page, organizationId);

		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const memberEmail = `wave4-member-${suffix}@aria.local`;
		const memberPassword = "Wave4Member#2026";
		const member = await createE2EUser(
			page,
			memberEmail,
			`Wave4 Member ${suffix}`,
			memberPassword,
		);
		const invitation = await inviteE2EOrganizationMember(
			page,
			organizationId,
			memberEmail,
		);
		const company = await createE2ECompany(
			page,
			`Wave4 Member Company ${suffix}`,
		);
		const memberContext = await browser.newContext({
			baseURL:
				process.env.PLAYWRIGHT_BASE_URL ??
				process.env.PLAYWRIGHT_TEST_BASE_URL ??
				"http://localhost:3000",
		});
		const memberPage = await memberContext.newPage();
		let memberAccepted = false;
		let acceptedMemberId: string | undefined;

		try {
			await memberPage.goto("/asset/items/form", { waitUntil: "networkidle" });
			if (/\/auth\/sign-in/.test(memberPage.url())) {
				await memberPage
					.getByRole("textbox", { name: "Email or Username" })
					.fill(memberEmail);
				await memberPage
					.getByRole("textbox", { name: "Password" })
					.fill(memberPassword);
				await memberPage
					.getByRole("button", { name: "Sign In", exact: true })
					.click();
			}
			await expect
				.poll(
					async () =>
						memberPage.evaluate(
							async (backendBase) => {
								const response = await fetch(
									`${backendBase}/api/auth/get-session`,
									{ credentials: "include" },
								);
								if (!response.ok) return null;
								const payload = (await response.json()) as {
									user?: { id?: string };
								} | null;
								return payload?.user?.id ?? null;
							},
							(
								process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
							).replace(/\/$/),
						),
					{ timeout: 30_000 },
				)
				.toBe(member.id);
			const accepted = await acceptE2EOrganizationInvitation(
				memberPage,
				invitation.id,
			);
			acceptedMemberId = accepted.member?.id;
			memberAccepted = true;
			await callAuth(
				memberPage,
				"/organization/set-active",
				{ organizationId },
				"POST",
			);
			await memberPage.goto("/asset/items/form", { waitUntil: "networkidle" });
			await expect(
				memberPage.getByRole("heading", { name: "Write access required" }),
			).toBeVisible({ timeout: 90_000 });

			await expect(
				callTrpc(
					memberPage,
					"asset.createAsset",
					{
						assetName: `Wave4 Member Asset ${suffix}`,
						assetType: "EXISTING_ASSET",
						companyId: company.id,
						purchaseDate: "2026-08-10",
						availableForUseDate: "2026-08-10",
						netPurchaseAmount: 1,
						calculateDepreciation: false,
					},
					"mutation",
				),
			).rejects.toThrow(/authorized|permission|forbidden|owner|administrator/i);

			await page.goto("/asset/items/form", { waitUntil: "networkidle" });
			await expect(
				page.getByRole("heading", { name: "New Asset" }),
			).toBeVisible({ timeout: 90_000 });
		} finally {
			await memberContext.close();
			if (memberAccepted) {
				await removeE2EOrganizationMember(
					page,
					organizationId,
					acceptedMemberId ?? memberEmail,
				);
			}
			await deleteE2EUser(page, member.id);
			await deleteE2ECompany(page, company.id);
			await setActiveE2EOrganization(page, originalOrganizationId);
		}
	});

	test("discovers a company beyond the first selector page through real search and pagination", async ({
		page,
	}) => {
		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const names = Array.from(
			{ length: 51 },
			(_, index) =>
				`Wave4 Selector ${suffix} ${String(index + 1).padStart(3, "0")}`,
		);
		const companies = await Promise.all(
			names.map((name) => createE2ECompany(page, name)),
		);
		try {
			await page.goto("/asset/items/form", { waitUntil: "networkidle" });
			await expect(
				page.getByRole("heading", { name: "New Asset" }),
			).toBeVisible({
				timeout: 90_000,
			});
			const companySelect = page.getByRole("button", {
				name: "Select company…",
			});
			await expect(companySelect).toHaveAttribute("data-state", "closed", {
				timeout: 90_000,
			});
			await companySelect.click();
			const search = page.getByPlaceholder("Search companies…");
			await search.fill(`Wave4 Selector ${suffix}`);
			const lastCompany = page.getByRole("option", {
				name: names.at(-1),
				exact: true,
			});
			await expect(lastCompany).toHaveCount(0);
			await expect(
				page.getByRole("button", { name: "Load more", exact: true }),
			).toBeVisible({ timeout: 90_000 });
			await page
				.getByRole("button", { name: "Load more", exact: true })
				.click();
			await expect(lastCompany).toBeVisible({ timeout: 90_000 });
			await lastCompany.click();
			await expect(companySelect).toContainText(names.at(-1) ?? "");
		} finally {
			await Promise.all(
				companies.map((company) => deleteE2ECompany(page, company.id)),
			);
		}
	});
});
