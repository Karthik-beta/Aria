import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarcodeScannerDialog } from "./barcode-scanner-dialog";

interface MockScannerControls {
	stop: ReturnType<typeof vi.fn>;
}

interface MockScannerResult {
	getText: () => string;
}

type MockDecodeCallback = (
	result: MockScannerResult | undefined,
	error: unknown,
	controls: MockScannerControls,
) => void;

const scannerMocks = vi.hoisted(() => ({
	decodeFromConstraints: vi.fn(),
	listVideoInputDevices: vi.fn(),
	readerConstructor: vi.fn(),
	callbacks: [] as MockDecodeCallback[],
	controls: { stop: vi.fn() } as MockScannerControls,
	trackStop: vi.fn(),
	ChecksumException: class MockChecksumException extends Error {},
	FormatException: class MockFormatException extends Error {},
	NotFoundException: class MockNotFoundException extends Error {},
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("@zxing/browser", () => ({
	BrowserMultiFormatReader: class BrowserMultiFormatReader {
		static listVideoInputDevices = scannerMocks.listVideoInputDevices;

		constructor(...args: unknown[]) {
			scannerMocks.readerConstructor(...args);
		}

		decodeFromConstraints(
			constraints: MediaStreamConstraints,
			video: HTMLVideoElement,
			callback: MockDecodeCallback,
		) {
			return scannerMocks.decodeFromConstraints(constraints, video, callback);
		}
	},
}));

vi.mock("@zxing/library", () => ({
	BarcodeFormat: {
		AZTEC: 0,
		CODABAR: 1,
		CODE_39: 2,
		CODE_93: 3,
		CODE_128: 4,
		DATA_MATRIX: 5,
		EAN_8: 6,
		EAN_13: 7,
		ITF: 8,
		MAXICODE: 9,
		PDF_417: 10,
		QR_CODE: 11,
		RSS_14: 12,
		RSS_EXPANDED: 13,
		UPC_A: 14,
		UPC_E: 15,
		UPC_EAN_EXTENSION: 16,
	},
	DecodeHintType: {
		OTHER: 0,
		PURPOSE: 1,
		POSSIBLE_FORMATS: 2,
		TRY_HARDER: 3,
		CHARACTER_SET: 4,
		ALLOWED_LENGTHS: 5,
		ASSUME_CODE_39_CHECK_DIGIT: 6,
		NEED_RESULT_POINT_CALLBACK: 7,
		ALLOWED_EAN_EXTENSIONS: 8,
	},
	ChecksumException: scannerMocks.ChecksumException,
	FormatException: scannerMocks.FormatException,
	NotFoundException: scannerMocks.NotFoundException,
}));

function createDevice(deviceId: string, label: string): MediaDeviceInfo {
	return {
		deviceId,
		groupId: "camera-group",
		kind: "videoinput",
		label,
		toJSON: () => ({}),
	};
}

function createResult(text: string): MockScannerResult {
	return {
		getText: () => text,
	};
}

function installSuccessfulCamera(deviceId?: string) {
	scannerMocks.decodeFromConstraints.mockImplementation(
		async (
			constraints: MediaStreamConstraints,
			video: HTMLVideoElement,
			callback: MockDecodeCallback,
		) => {
			scannerMocks.callbacks.push(callback);
			const videoConstraints =
				typeof constraints.video === "object" ? constraints.video : undefined;
			const requestedDeviceId =
				typeof videoConstraints?.deviceId === "object" &&
				"exact" in videoConstraints.deviceId
					? String(videoConstraints.deviceId.exact)
					: undefined;
			const activeDeviceId = requestedDeviceId ?? deviceId;
			const track = {
				getSettings: () => (activeDeviceId ? { deviceId: activeDeviceId } : {}),
				stop: scannerMocks.trackStop,
			};
			const stream = {
				getTracks: () => [track],
				getVideoTracks: () => [track],
			};
			Object.defineProperty(video, "srcObject", {
				configurable: true,
				value: stream,
				writable: true,
			});
			return scannerMocks.controls;
		},
	);
}

describe("BarcodeScannerDialog", () => {
	beforeEach(() => {
		scannerMocks.decodeFromConstraints.mockReset();
		scannerMocks.listVideoInputDevices.mockReset();
		scannerMocks.listVideoInputDevices.mockResolvedValue([]);
		scannerMocks.readerConstructor.mockReset();
		scannerMocks.callbacks.length = 0;
		scannerMocks.controls.stop.mockReset();
		scannerMocks.trackStop.mockReset();
		installSuccessfulCamera();
	});

	it("uses ZXing multi-format reader configured with performance hints and scan options", async () => {
		render(
			<BarcodeScannerDialog isOpen onClose={vi.fn()} onScanSuccess={vi.fn()} />,
		);

		await waitFor(() =>
			expect(scannerMocks.readerConstructor).toHaveBeenCalled(),
		);
		expect(scannerMocks.readerConstructor).toHaveBeenCalledWith(
			expect.any(Map),
			expect.objectContaining({
				delayBetweenScanAttempts: 80,
				delayBetweenScanSuccess: 500,
			}),
		);
		expect(
			screen.getByText(/Hold one barcode or QR code clearly in view/i),
		).toBeInTheDocument();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("accepts the first successful result exactly once", async () => {
		const onClose = vi.fn();
		const onScanSuccess = vi.fn();
		render(
			<BarcodeScannerDialog
				isOpen
				onClose={onClose}
				onScanSuccess={onScanSuccess}
			/>,
		);

		await waitFor(() => expect(scannerMocks.callbacks.length).toBe(1));
		const callback = scannerMocks.callbacks[0];
		expect(callback).toBeDefined();

		act(() => {
			callback?.(
				createResult("8904287602549"),
				undefined,
				scannerMocks.controls,
			);
			callback?.(
				createResult("4904182602549"),
				undefined,
				scannerMocks.controls,
			);
		});

		expect(onScanSuccess).toHaveBeenCalledTimes(1);
		expect(onScanSuccess).toHaveBeenCalledWith("8904287602549");
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(scannerMocks.controls.stop).toHaveBeenCalledTimes(1);
	});

	it("falls back to default camera constraints only when overconstrained", async () => {
		const overconstrained = Object.assign(new Error("unsupported settings"), {
			name: "OverconstrainedError",
		});
		scannerMocks.decodeFromConstraints
			.mockRejectedValueOnce(overconstrained)
			.mockImplementationOnce(
				async (
					_constraints: MediaStreamConstraints,
					video: HTMLVideoElement,
					callback: MockDecodeCallback,
				) => {
					scannerMocks.callbacks.push(callback);
					Object.defineProperty(video, "srcObject", {
						configurable: true,
						value: null,
						writable: true,
					});
					return scannerMocks.controls;
				},
			);

		render(
			<BarcodeScannerDialog isOpen onClose={vi.fn()} onScanSuccess={vi.fn()} />,
		);

		await waitFor(() =>
			expect(scannerMocks.decodeFromConstraints).toHaveBeenCalledTimes(2),
		);
		expect(scannerMocks.decodeFromConstraints.mock.calls[0]?.[0]).toEqual({
			video: {
				facingMode: { ideal: "environment" },
				height: { ideal: 720 },
				width: { ideal: 1280 },
			},
		});
		expect(scannerMocks.decodeFromConstraints.mock.calls[1]?.[0]).toEqual({
			video: true,
		});
	});

	it("reports permission denial without retrying the camera", async () => {
		const permissionError = Object.assign(new Error("permission denied"), {
			name: "NotAllowedError",
		});
		scannerMocks.decodeFromConstraints.mockRejectedValueOnce(permissionError);
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		render(
			<BarcodeScannerDialog isOpen onClose={vi.fn()} onScanSuccess={vi.fn()} />,
		);

		expect(
			await screen.findByText(/Camera permission was denied/i),
		).toBeInTheDocument();
		expect(scannerMocks.decodeFromConstraints).toHaveBeenCalledTimes(1);
		consoleError.mockRestore();
	});

	it("stops the previous stream and restarts when the camera changes", async () => {
		const backCamera = createDevice("back-camera", "Back Camera");
		const frontCamera = createDevice("front-camera", "Front Camera");
		scannerMocks.listVideoInputDevices.mockResolvedValue([
			backCamera,
			frontCamera,
		]);
		scannerMocks.decodeFromConstraints.mockReset();
		installSuccessfulCamera("back-camera");

		render(
			<BarcodeScannerDialog isOpen onClose={vi.fn()} onScanSuccess={vi.fn()} />,
		);

		const selector = await screen.findByRole("combobox");
		await waitFor(() => expect(selector).toHaveValue("back-camera"));
		fireEvent.change(selector, { target: { value: "front-camera" } });

		await waitFor(() => {
			const latestCall = scannerMocks.decodeFromConstraints.mock.calls.at(-1);
			expect(latestCall?.[0]).toEqual({
				video: {
					deviceId: { exact: "front-camera" },
					height: { ideal: 720 },
					width: { ideal: 1280 },
				},
			});
		});
		expect(scannerMocks.trackStop).toHaveBeenCalled();
		expect(scannerMocks.controls.stop).toHaveBeenCalled();
	});

	it("continues scanning after expected decode misses", async () => {
		const onScanSuccess = vi.fn();
		render(
			<BarcodeScannerDialog
				isOpen
				onClose={vi.fn()}
				onScanSuccess={onScanSuccess}
			/>,
		);

		await waitFor(() => expect(scannerMocks.callbacks.length).toBe(1));
		const callback = scannerMocks.callbacks[0];
		expect(callback).toBeDefined();

		act(() => {
			callback?.(
				undefined,
				new scannerMocks.NotFoundException(),
				scannerMocks.controls,
			);
			callback?.(
				undefined,
				new scannerMocks.ChecksumException(),
				scannerMocks.controls,
			);
			callback?.(
				undefined,
				new scannerMocks.FormatException(),
				scannerMocks.controls,
			);
		});

		expect(onScanSuccess).not.toHaveBeenCalled();
		expect(scannerMocks.controls.stop).not.toHaveBeenCalled();

		act(() => {
			callback?.(
				createResult("8904287602549"),
				undefined,
				scannerMocks.controls,
			);
		});

		expect(onScanSuccess).toHaveBeenCalledOnce();
		expect(onScanSuccess).toHaveBeenCalledWith("8904287602549");
	});

	it("stops scanning when an unexpected decoder error reaches the callback", async () => {
		render(
			<BarcodeScannerDialog isOpen onClose={vi.fn()} onScanSuccess={vi.fn()} />,
		);

		await waitFor(() => expect(scannerMocks.callbacks.length).toBe(1));
		act(() => {
			scannerMocks.callbacks[0]?.(
				undefined,
				new Error("unexpected decoder failure"),
				scannerMocks.controls,
			);
		});

		expect(
			screen.getByText(/Barcode scanning stopped unexpectedly/i),
		).toBeInTheDocument();
		expect(scannerMocks.controls.stop).toHaveBeenCalledOnce();
	});

	it("stops scanner controls and media tracks when unmounted", async () => {
		const { unmount } = render(
			<BarcodeScannerDialog isOpen onClose={vi.fn()} onScanSuccess={vi.fn()} />,
		);

		await waitFor(() =>
			expect(
				screen.queryByText(/Accessing camera stream/i),
			).not.toBeInTheDocument(),
		);
		unmount();

		expect(scannerMocks.controls.stop).toHaveBeenCalledOnce();
		expect(scannerMocks.trackStop).toHaveBeenCalledOnce();
	});

	it("trims manual input and prevents a late camera callback from accepting twice", async () => {
		const onClose = vi.fn();
		const onScanSuccess = vi.fn();
		render(
			<BarcodeScannerDialog
				isOpen
				onClose={onClose}
				onScanSuccess={onScanSuccess}
			/>,
		);

		await waitFor(() => expect(scannerMocks.callbacks.length).toBe(1));
		const callback = scannerMocks.callbacks[0];
		fireEvent.change(screen.getByPlaceholderText(/Enter barcode or QR code/i), {
			target: { value: "  MANUAL-123  " },
		});
		fireEvent.click(screen.getByRole("button", { name: /Submit/i }));

		expect(onScanSuccess).toHaveBeenCalledTimes(1);
		expect(onScanSuccess).toHaveBeenCalledWith("MANUAL-123");
		expect(onClose).toHaveBeenCalledOnce();

		act(() => {
			callback?.(
				createResult("8904287602549"),
				undefined,
				scannerMocks.controls,
			);
			callback?.(
				createResult("8904287602549"),
				undefined,
				scannerMocks.controls,
			);
			callback?.(
				createResult("8904287602549"),
				undefined,
				scannerMocks.controls,
			);
		});

		expect(onScanSuccess).toHaveBeenCalledTimes(1);
	});

	it.each([
		["NotFoundError", "No camera is available"],
		[
			"NotReadableError",
			"camera is unavailable or already in use by another application",
		],
	] as const)("reports %s without attempting a fallback", async (name, message) => {
		scannerMocks.decodeFromConstraints.mockRejectedValueOnce(
			Object.assign(new Error(message), { name }),
		);

		render(
			<BarcodeScannerDialog isOpen onClose={vi.fn()} onScanSuccess={vi.fn()} />,
		);

		expect(
			await screen.findByText(new RegExp(message, "i")),
		).toBeInTheDocument();
		expect(scannerMocks.decodeFromConstraints).toHaveBeenCalledOnce();
	});

	it("renders Torch toggle button when media track supports torch", async () => {
		const applyConstraintsMock = vi.fn().mockResolvedValue(undefined);
		scannerMocks.decodeFromConstraints.mockImplementation(
			async (
				_constraints: MediaStreamConstraints,
				video: HTMLVideoElement,
				callback: MockDecodeCallback,
			) => {
				scannerMocks.callbacks.push(callback);
				const track = {
					getCapabilities: () => ({ torch: true }),
					getSettings: () => ({ deviceId: "cam-1" }),
					applyConstraints: applyConstraintsMock,
					stop: scannerMocks.trackStop,
				};
				const stream = {
					getTracks: () => [track],
					getVideoTracks: () => [track],
				};
				Object.defineProperty(video, "srcObject", {
					configurable: true,
					value: stream,
					writable: true,
				});
				return scannerMocks.controls;
			},
		);

		render(
			<BarcodeScannerDialog isOpen onClose={vi.fn()} onScanSuccess={vi.fn()} />,
		);

		const torchBtn = await screen.findByTestId("torch-toggle-button");
		expect(torchBtn).toBeInTheDocument();

		fireEvent.click(torchBtn);
		await waitFor(() =>
			expect(applyConstraintsMock).toHaveBeenCalledWith({
				advanced: [{ torch: true }],
			}),
		);
	});
});
