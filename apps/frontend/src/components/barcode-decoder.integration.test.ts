import {
	BarcodeFormat,
	BinaryBitmap,
	HybridBinarizer,
	MultiFormatReader,
	RGBLuminanceSource,
} from "@zxing/library";
import { describe, expect, it, vi } from "vitest";
import { BarcodeScanStabilityTracker } from "./barcode-scan-stability";

const LEFT_PATTERNS = {
	L: [
		"0001101",
		"0011001",
		"0010011",
		"0111101",
		"0100011",
		"0110001",
		"0101111",
		"0111011",
		"0110111",
		"0001011",
	],
	G: [
		"0100111",
		"0110011",
		"0011011",
		"0100001",
		"0011101",
		"0111001",
		"0000101",
		"0010001",
		"0001001",
		"0010111",
	],
} as const;

const RIGHT_PATTERNS = [
	"1110010",
	"1100110",
	"1101100",
	"1000010",
	"1011100",
	"1001110",
	"1010000",
	"1000100",
	"1001000",
	"1110100",
] as const;

const FIRST_DIGIT_PARITY = [
	"LLLLLL",
	"LLGLGG",
	"LLGGLG",
	"LLGGGL",
	"LGLLGG",
	"LGGLLG",
	"LGGGLL",
	"LGLGLG",
	"LGLGGL",
	"LGGLGL",
] as const;

/** Renders a fixed EAN-13 value as a test bitmap without computing its check digit. */
function renderEan13(
	value: string,
	moduleWidth = 4,
): { data: Uint8ClampedArray; height: number; width: number } {
	if (!/^\d{13}$/.test(value)) {
		throw new Error("EAN-13 test values must contain exactly 13 digits");
	}

	const digits = [...value].map(Number);
	const parity = FIRST_DIGIT_PARITY[digits[0] ?? -1];
	if (!parity) throw new Error("Unable to determine EAN-13 parity");

	const quietZone = "0".repeat(11);
	let modules = `${quietZone}101`;
	for (let index = 1; index <= 6; index += 1) {
		const digit = digits[index];
		const encoding = parity[index - 1] as "G" | "L";
		if (digit === undefined) throw new Error("Missing EAN-13 digit");
		modules += LEFT_PATTERNS[encoding][digit];
	}
	modules += "01010";
	for (let index = 7; index <= 12; index += 1) {
		const digit = digits[index];
		if (digit === undefined) throw new Error("Missing EAN-13 digit");
		modules += RIGHT_PATTERNS[digit];
	}
	modules += `101${quietZone}`;

	const width = modules.length * moduleWidth;
	const height = 160;
	const data = new Uint8ClampedArray(width * height);
	data.fill(255);

	for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
		if (modules[moduleIndex] !== "1") continue;
		for (let xOffset = 0; xOffset < moduleWidth; xOffset += 1) {
			const x = moduleIndex * moduleWidth + xOffset;
			for (let y = 8; y < height - 8; y += 1) {
				data[y * width + x] = 0;
			}
		}
	}

	return { data, height, width };
}

function decodeEan13(value: string, moduleWidth = 4) {
	const { data, height, width } = renderEan13(value, moduleWidth);
	return decodeGrayscale(data, width, height);
}

function decodeGrayscale(
	data: Uint8Array | Uint8ClampedArray,
	width: number,
	height: number,
) {
	const source = new RGBLuminanceSource(
		data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data),
		width,
		height,
	);
	const bitmap = new BinaryBitmap(new HybridBinarizer(source));
	const reader = new MultiFormatReader();
	// BrowserMultiFormatReader initializes the core reader with explicit hints.
	const result = reader.decode(bitmap, new Map());

	return {
		format: BarcodeFormat[result.getBarcodeFormat()],
		text: result.getText(),
	};
}

function placeBarcode(
	frame: Uint8ClampedArray,
	frameWidth: number,
	barcode: ReturnType<typeof renderEan13>,
	left: number,
	top: number,
) {
	for (let y = 0; y < barcode.height; y += 1) {
		const sourceStart = y * barcode.width;
		const targetStart = (top + y) * frameWidth + left;
		frame.set(
			barcode.data.subarray(sourceStart, sourceStart + barcode.width),
			targetStart,
		);
	}
}

describe("ZXing barcode stability integration", () => {
	it("decodes the barcode inside the target region instead of a competing code", () => {
		const frameWidth = 1200;
		const frameHeight = 480;
		const cameraFrame = new Uint8ClampedArray(frameWidth * frameHeight);
		cameraFrame.fill(255);
		placeBarcode(
			cameraFrame,
			frameWidth,
			renderEan13("4904182602549", 2),
			0,
			160,
		);
		placeBarcode(
			cameraFrame,
			frameWidth,
			renderEan13("8904287602549", 3),
			420,
			160,
		);

		expect(decodeGrayscale(cameraFrame, frameWidth, frameHeight)).toEqual({
			format: "EAN_13",
			text: "4904182602549",
		});

		const targetWidth = 720;
		const targetHeight = 240;
		const targetRegion = new Uint8ClampedArray(targetWidth * targetHeight);
		for (let y = 0; y < targetHeight; y += 1) {
			const sourceStart = (120 + y) * frameWidth + 240;
			targetRegion.set(
				cameraFrame.subarray(sourceStart, sourceStart + targetWidth),
				y * targetWidth,
			);
		}

		expect(decodeGrayscale(targetRegion, targetWidth, targetHeight)).toEqual({
			format: "EAN_13",
			text: "8904287602549",
		});
	});

	it("decodes a visible EAN before reaching ZXing's noisy 2D readers", () => {
		const consoleWarn = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);

		try {
			expect(decodeEan13("8904287602549")).toEqual({
				format: "EAN_13",
				text: "8904287602549",
			});
			expect(consoleWarn).not.toHaveBeenCalled();
		} finally {
			consoleWarn.mockRestore();
		}
	});

	it.each([
		2, 3, 4, 6,
	])("decodes the supplied EAN consistently at %d pixels per module", (moduleWidth) => {
		expect(decodeEan13("8904287602549", moduleWidth)).toEqual({
			format: "EAN_13",
			text: "8904287602549",
		});
	});

	it("rejects an EAN fixture with an invalid check digit", () => {
		expect(() => decodeEan13("8904287602548")).toThrow();
	});

	it("accepts the correct decoded value only after a transient valid misread", () => {
		const tracker = new BarcodeScanStabilityTracker();
		const values = [
			"4904182602549",
			"8904287602549",
			"8904287602549",
			"8904287602549",
		];

		const observations = values.map((value, index) =>
			tracker.record(decodeEan13(value), index * 250),
		);

		expect(
			observations.map(({ accepted, count }) => ({ accepted, count })),
		).toEqual([
			{ accepted: false, count: 1 },
			{ accepted: false, count: 1 },
			{ accepted: false, count: 2 },
			{ accepted: true, count: 3 },
		]);
		expect(observations.at(-1)?.candidate).toEqual({
			format: "EAN_13",
			text: "8904287602549",
		});
	});
});
