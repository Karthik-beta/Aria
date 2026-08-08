import { expect, type Page, test } from "@playwright/test";

const ASSET_FORM_PATH = "/asset/items/form";
const CORRECT_EAN = "8904287602549";

type BarcodeLookupMock =
	| { kind: "found"; assetId: string; assetName: string }
	| {
			kind: "error";
			code: "INTERNAL_SERVER_ERROR" | "NOT_FOUND";
			httpStatus: number;
			message: string;
	  };

const mockCategories = {
	items: [
		{
			id: "cat-001",
			name: "Machinery",
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 60,
			frequencyOfDepreciation: 12,
			dailyProrataBased: null,
			shiftBased: null,
			rateOfDepreciation: null,
			expectedValueAfterUsefulLife: 5000,
			nonDepreciableCategory: false,
			enableCwipAccounting: false,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-02T00:00:00.000Z",
		},
	],
};

const mockLocations = {
	items: [
		{
			id: "loc-001",
			name: "Head Office",
			parentLocationId: null,
			parentLocationName: null,
			isGroup: false,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		},
	],
};

async function login(page: Page) {
	await page.goto("/auth/sign-in");
	await page.getByLabel(/email or username/i).fill("admin@aria.local");
	await page.getByLabel(/^password$/i).fill("admin123");
	await page.getByRole("button", { name: /sign in/i }).click();
	await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 45_000 });
}

async function mockFormQueries(page: Page) {
	await page.route("**/trpc/asset.listAssetCategories**", async (route) => {
		const url = route.request().url();
		const isBatch = url.includes("batch=1");
		const body = isBatch
			? [{ result: { data: mockCategories } }]
			: { result: { data: mockCategories } };
		await route.fulfill({
			contentType: "application/json",
			body: JSON.stringify(body),
		});
	});

	await page.route("**/trpc/asset.listLocations**", async (route) => {
		const url = route.request().url();
		const isBatch = url.includes("batch=1");
		const body = isBatch
			? [{ result: { data: mockLocations } }]
			: { result: { data: mockLocations } };
		await route.fulfill({
			contentType: "application/json",
			body: JSON.stringify(body),
		});
	});
}

async function installCameraFailure(
	page: Page,
	name: "NotAllowedError" | "NotFoundError" | "NotReadableError",
	message: string,
) {
	await page.addInitScript(
		({ errorName, errorMessage }) => {
			const mockGetUserMedia = async () => {
				throw new DOMException(errorMessage, errorName);
			};
			const mockEnumerateDevices = async () => [];
			const mediaDevicesMock = {
				getUserMedia: mockGetUserMedia,
				enumerateDevices: mockEnumerateDevices,
			};

			if (typeof MediaDevices !== "undefined" && MediaDevices.prototype) {
				Object.defineProperty(MediaDevices.prototype, "getUserMedia", {
					value: mockGetUserMedia,
					configurable: true,
					writable: true,
				});
				Object.defineProperty(MediaDevices.prototype, "enumerateDevices", {
					value: mockEnumerateDevices,
					configurable: true,
					writable: true,
				});
			} else {
				Object.defineProperty(
					Object.getPrototypeOf(navigator),
					"mediaDevices",
					{
						value: mediaDevicesMock,
						configurable: true,
					},
				);
			}
		},
		{ errorName: name, errorMessage: message },
	);
}

function getBarcodeFromRequest(requestUrl: string): string | undefined {
	const input = new URL(requestUrl).searchParams.get("input");
	if (!input) return undefined;

	const parsed = JSON.parse(input) as Record<string, unknown>;
	const batchEntry = parsed["0"] as
		| { json?: { barcode?: string }; barcode?: string }
		| undefined;
	const directEntry = parsed as {
		json?: { barcode?: string };
		barcode?: string;
	};
	return (
		batchEntry?.json?.barcode ??
		batchEntry?.barcode ??
		directEntry.json?.barcode ??
		directEntry.barcode
	);
}

async function mockBarcodeLookup(page: Page, response: BarcodeLookupMock) {
	const receivedBarcodes: string[] = [];

	await page.route("**/trpc/asset.getAssetByBarcode**", async (route) => {
		const barcode = getBarcodeFromRequest(route.request().url());
		if (barcode) receivedBarcodes.push(barcode);

		const payload =
			response.kind === "found"
				? {
						result: {
							data: {
								id: response.assetId,
								assetName: response.assetName,
							},
						},
					}
				: {
						error: {
							message: response.message,
							code: response.code === "NOT_FOUND" ? -32_004 : -32_603,
							data: {
								code: response.code,
								httpStatus: response.httpStatus,
								path: "asset.getAssetByBarcode",
							},
						},
					};
		const body = route.request().url().includes("batch=1")
			? [payload]
			: payload;
		await route.fulfill({ json: body });
	});

	return receivedBarcodes;
}

async function openManualScanner(page: Page) {
	const scanButton = page.getByRole("button", { name: /^Scan$/i });
	const dialogHeading = page.getByRole("heading", {
		name: /Scan Barcode \/ QR Code/i,
	});

	// The form can be visible before Next.js finishes attaching client handlers.
	await expect(async () => {
		await scanButton.click();
		await expect(dialogHeading).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 20_000 });
	await expect(
		page
			.getByRole("dialog")
			.getByText(/Hold one barcode or QR code clearly in view/i),
	).toBeVisible();
}

async function openAssetForm(page: Page) {
	await mockFormQueries(page);
	await page.goto(ASSET_FORM_PATH, { waitUntil: "domcontentloaded" });
	await expect(page.getByLabel(/Barcode \/ QR Code/i)).toBeVisible({
		timeout: 45_000,
	});
}

test.describe("Asset Barcode Scanning & Input UI", () => {
	test.beforeEach(async ({ page }) => {
		test.setTimeout(180_000);
		await login(page);
	});

	test("renders Scan Barcode button on list page", async ({ page }) => {
		await page.route("**/trpc/asset.listAssets**", async (route) => {
			const url = route.request().url();
			const isBatch = url.includes("batch=1");
			const responseData = { items: [], totalCount: 0 };
			const body = isBatch
				? [{ result: { data: responseData } }]
				: { result: { data: responseData } };
			await route.fulfill({
				contentType: "application/json",
				body: JSON.stringify(body),
			});
		});

		await page.goto("/asset/items", {
			waitUntil: "domcontentloaded",
		});

		await expect(
			page.getByRole("button", { name: /Scan Barcode/i }),
		).toBeVisible({ timeout: 45_000 });
	});

	test("renders Barcode/QR Code input and Scan button on form page", async ({
		page,
	}) => {
		await mockFormQueries(page);

		await page.goto("/asset/items/form", {
			waitUntil: "domcontentloaded",
		});

		// Verify barcode label and input field
		const barcodeInput = page.getByLabel(/Barcode \/ QR Code/i);
		await expect(barcodeInput).toBeVisible({ timeout: 45_000 });

		// Verify scan button next to the input
		const scanButton = page.getByRole("button", { name: /Scan/i });
		await expect(scanButton).toBeVisible();

		// Test manual typing in barcode input
		await barcodeInput.fill("1234567890ABC");
		await expect(barcodeInput).toHaveValue("1234567890ABC");
	});

	for (const scenario of [
		{
			name: "NotAllowedError" as const,
			browserMessage: "Permission denied",
			expectedMessage: /Camera permission was denied/i,
		},
		{
			name: "NotFoundError" as const,
			browserMessage: "No camera",
			expectedMessage: /No camera is available on this device/i,
		},
		{
			name: "NotReadableError" as const,
			browserMessage: "Camera busy",
			expectedMessage: /camera is unavailable or already in use/i,
		},
	]) {
		test(`reports ${scenario.name} camera failures accurately`, async ({
			page,
		}) => {
			await installCameraFailure(page, scenario.name, scenario.browserMessage);
			await openAssetForm(page);
			await openManualScanner(page);

			await expect(
				page.getByRole("dialog").getByText(scenario.expectedMessage),
			).toBeVisible({ timeout: 15_000 });
		});
	}

	test("manual scanner accepts only a typed NOT_FOUND response", async ({
		page,
	}) => {
		await installCameraFailure(page, "NotAllowedError", "Permission denied");
		const receivedBarcodes = await mockBarcodeLookup(page, {
			kind: "error",
			code: "NOT_FOUND",
			httpStatus: 404,
			message: `Asset with barcode "${CORRECT_EAN}" not found`,
		});
		await openAssetForm(page);
		await openManualScanner(page);

		await page
			.getByPlaceholder(/Enter barcode or QR code/i)
			.fill(`  ${CORRECT_EAN}  `);
		await page.getByRole("button", { name: /Submit/i }).click();

		await expect(page.getByRole("dialog")).not.toBeVisible();
		await expect(page.getByLabel(/Barcode \/ QR Code/i)).toHaveValue(
			CORRECT_EAN,
		);
		await expect(
			page.getByText(/Barcode is unique and available/i),
		).toBeVisible();
		await expect.poll(() => receivedBarcodes).toEqual([CORRECT_EAN]);
	});

	test("duplicate lookup leaves the previous form value unchanged", async ({
		page,
	}) => {
		await installCameraFailure(page, "NotAllowedError", "Permission denied");
		await mockBarcodeLookup(page, {
			kind: "found",
			assetId: "existing-asset",
			assetName: "Existing Forklift",
		});
		await openAssetForm(page);
		await openManualScanner(page);
		await page.getByRole("button", { name: /^Cancel$/i }).click();
		await expect(page.getByRole("dialog")).not.toBeVisible();
		const formInput = page.getByLabel(/Barcode \/ QR Code/i);
		await formInput.fill("ORIGINAL-BARCODE");
		await openManualScanner(page);

		await page.getByPlaceholder(/Enter barcode or QR code/i).fill(CORRECT_EAN);
		await page.getByRole("button", { name: /Submit/i }).click();

		await expect(formInput).toHaveValue("ORIGINAL-BARCODE");
		await expect(
			page.getByText(/already registered to asset "Existing Forklift"/i),
		).toBeVisible();
	});

	test("server lookup failure leaves the previous form value unchanged", async ({
		page,
	}) => {
		await installCameraFailure(page, "NotAllowedError", "Permission denied");
		await mockBarcodeLookup(page, {
			kind: "error",
			code: "INTERNAL_SERVER_ERROR",
			httpStatus: 500,
			message: "Barcode lookup service unavailable",
		});
		await openAssetForm(page);
		await openManualScanner(page);
		await page.getByRole("button", { name: /^Cancel$/i }).click();
		await expect(page.getByRole("dialog")).not.toBeVisible();
		const formInput = page.getByLabel(/Barcode \/ QR Code/i);
		await formInput.fill("ORIGINAL-BARCODE");
		await openManualScanner(page);

		await page.getByPlaceholder(/Enter barcode or QR code/i).fill(CORRECT_EAN);
		await page.getByRole("button", { name: /Submit/i }).click();

		await expect(formInput).toHaveValue("ORIGINAL-BARCODE");
		await expect(
			page.getByText(/Barcode lookup service unavailable/i),
		).toBeVisible();
	});
});
