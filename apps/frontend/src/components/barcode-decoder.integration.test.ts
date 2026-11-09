import {
	BarcodeFormat,
	BinaryBitmap,
	HybridBinarizer,
	MultiFormatReader,
	QRCodeWriter,
	RGBLuminanceSource,
} from "@zxing/library";
import { describe, expect, it, vi } from "vitest";

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

function decodeQrCode(value: string) {
	const matrix = new QRCodeWriter().encode(
		value,
		BarcodeFormat.QR_CODE,
		240,
		240,
		new Map(),
	);
	const width = matrix.getWidth();
	const height = matrix.getHeight();
	const data = new Uint8ClampedArray(width * height);
	data.fill(255);

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (matrix.get(x, y)) data[y * width + x] = 0;
		}
	}

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

describe("ZXing barcode decoder integration", () => {
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

	it.each([2, 3, 4, 6])(
		"decodes the supplied EAN consistently at %d pixels per module",
		(moduleWidth) => {
			expect(decodeEan13("8904287602549", moduleWidth)).toEqual({
				format: "EAN_13",
				text: "8904287602549",
			});
		},
	);

	it("rejects an EAN fixture with an invalid check digit", () => {
		expect(() => decodeEan13("8904287602548")).toThrow();
	});

	it("decodes a QR code produced by ZXing's official writer", () => {
		expect(decodeQrCode("ARIA-ASSET-QR-001")).toEqual({
			format: "QR_CODE",
			text: "ARIA-ASSET-QR-001",
		});
	});
});
