import { expect, type Page, test } from "@playwright/test";

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

test.describe("Asset Barcode Scanning & Input UI", () => {
	test.describe.configure({ mode: "serial" });

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

		await page.goto("/asset/asset-sub-module/asset", {
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

		await page.goto("/asset/asset-sub-module/asset/form", {
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

	test("barcode scanner dialog - permission denied scenario", async ({
		page,
	}) => {
		// Mock getUserMedia to simulate permission denied
		await page.addInitScript(() => {
			const mockGetUserMedia = async () => {
				throw new DOMException("Permission denied", "NotAllowedError");
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
			} else if (typeof Navigator !== "undefined" && Navigator.prototype) {
				Object.defineProperty(Navigator.prototype, "mediaDevices", {
					value: mediaDevicesMock,
					configurable: true,
					writable: true,
				});
			}
		});

		await mockFormQueries(page);
		await page.goto("/asset/asset-sub-module/asset/form", {
			waitUntil: "networkidle",
		});
		await page.waitForTimeout(2000); // wait for React hydration

		// Click Scan to open dialog
		const scanButton = page.getByRole("button", { name: /Scan/i });
		await expect(scanButton).toBeVisible();
		await scanButton.click();

		// Verify dialog is visible
		const dialogTitle = page.getByText(/Scan Barcode \/ QR Code/i);
		await expect(dialogTitle).toBeVisible();

		// Verify permission denied overlay is visible
		const deniedText = page.getByText(
			/Camera permission denied or unavailable/i,
		);
		await expect(deniedText).toBeVisible({ timeout: 15_000 });
	});

	test("barcode scanner dialog - permission granted scenario", async ({
		page,
	}) => {
		// Mock mediaDevices to simulate permission granted and list a camera
		await page.addInitScript(() => {
			const mockStream = new MediaStream();
			mockStream.getTracks = () => [
				{
					stop: () => {},
					enabled: true,
				} as unknown as MediaStreamTrack,
			];
			const mockGetUserMedia = async () => mockStream;
			const mockEnumerateDevices = async () => [
				{
					deviceId: "mock-camera-id",
					kind: "videoinput" as const,
					label: "Mock Back Camera",
					groupId: "mock-group-id",
					toJSON: () => {},
				},
			];

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
			} else if (typeof Navigator !== "undefined" && Navigator.prototype) {
				Object.defineProperty(Navigator.prototype, "mediaDevices", {
					value: mediaDevicesMock,
					configurable: true,
					writable: true,
				});
			}
		});

		await mockFormQueries(page);
		await page.goto("/asset/asset-sub-module/asset/form", {
			waitUntil: "networkidle",
		});
		await page.waitForTimeout(2000); // wait for React hydration

		// Click Scan to open dialog
		const scanButton = page.getByRole("button", { name: /Scan/i });
		await expect(scanButton).toBeVisible();
		await scanButton.click();

		// Verify dialog is visible
		const dialogTitle = page.getByText(/Scan Barcode \/ QR Code/i);
		await expect(dialogTitle).toBeVisible();

		// Verify loading spinner disappears and targeting box/video feed becomes active
		const videoFeed = page.locator("video");
		await expect(videoFeed).toBeVisible({ timeout: 15_000 });

		// Verify there is no denied text
		const deniedText = page.getByText(
			/Camera permission denied or unavailable/i,
		);
		await expect(deniedText).not.toBeVisible();
	});

	test("barcode scanner dialog - manual entry scenario", async ({ page }) => {
		// Mock permission denied to show the manual entry is fully functional even when camera is blocked
		await page.addInitScript(() => {
			const mockGetUserMedia = async () => {
				throw new DOMException("Permission denied", "NotAllowedError");
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
			} else if (typeof Navigator !== "undefined" && Navigator.prototype) {
				Object.defineProperty(Navigator.prototype, "mediaDevices", {
					value: mediaDevicesMock,
					configurable: true,
					writable: true,
				});
			}
		});

		await mockFormQueries(page);
		await page.goto("/asset/asset-sub-module/asset/form", {
			waitUntil: "networkidle",
		});
		await page.waitForTimeout(2000); // wait for React hydration

		// Click Scan to open dialog
		const scanButton = page.getByRole("button", { name: /Scan/i });
		await expect(scanButton).toBeVisible();
		await scanButton.click();

		// Verify dialog is visible
		const dialogTitle = page.getByText(/Scan Barcode \/ QR Code/i);
		await expect(dialogTitle).toBeVisible();

		// Locate manual input and type code
		const manualInput = page.getByPlaceholder(/Enter barcode or QR code.../i);
		await expect(manualInput).toBeVisible();
		await manualInput.fill("MANUAL-BARCODE-123");

		// Click Submit
		const submitButton = page.getByRole("button", { name: /Submit/i });
		await expect(submitButton).toBeVisible();
		await submitButton.click();

		// Verify dialog is closed (title is no longer visible)
		await expect(dialogTitle).not.toBeVisible();

		// Verify the value in the form input field is updated
		const formInput = page.getByLabel(/Barcode \/ QR Code/i);
		await expect(formInput).toHaveValue("MANUAL-BARCODE-123");
	});
});
