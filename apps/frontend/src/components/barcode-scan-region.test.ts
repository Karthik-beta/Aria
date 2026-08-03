import { describe, expect, it, vi } from "vitest";
import {
	calculateBarcodeScanRegion,
	drawBarcodeScanRegion,
} from "./barcode-scan-region";

describe("calculateBarcodeScanRegion", () => {
	it("maps a 640 by 480 camera frame to the centered target region", () => {
		expect(calculateBarcodeScanRegion(640, 480)).toEqual({
			height: 240,
			left: 128,
			outputHeight: 400,
			outputWidth: 640,
			top: 120,
			width: 384,
		});
	});

	it("caps high-resolution output while preserving the crop aspect ratio", () => {
		expect(calculateBarcodeScanRegion(3840, 2160)).toEqual({
			height: 1080,
			left: 768,
			outputHeight: 600,
			outputWidth: 1280,
			top: 540,
			width: 2304,
		});
	});

	it.each([
		[0, 480],
		[640, 0],
		[Number.NaN, 480],
		[640, Number.POSITIVE_INFINITY],
	])("returns an empty region for an invalid %s by %s frame", (width, height) => {
		expect(calculateBarcodeScanRegion(width, height)).toEqual({
			height: 0,
			left: 0,
			outputHeight: 0,
			outputWidth: 0,
			top: 0,
			width: 0,
		});
	});
});

describe("drawBarcodeScanRegion", () => {
	it("reuses the canvas backing buffer across equal-sized frames", () => {
		const sourceCanvas = { height: 480, width: 640 } as HTMLCanvasElement;
		const drawImage = vi.fn();
		const context = {
			drawImage,
			imageSmoothingEnabled: false,
			imageSmoothingQuality: "low",
		} as unknown as CanvasRenderingContext2D;
		const setWidth = vi.fn();
		const setHeight = vi.fn();
		let width = 0;
		let height = 0;
		const regionCanvas = {
			get width() {
				return width;
			},
			set width(value: number) {
				width = value;
				setWidth(value);
			},
			get height() {
				return height;
			},
			set height(value: number) {
				height = value;
				setHeight(value);
			},
			getContext: vi.fn(() => context),
		} as unknown as HTMLCanvasElement;

		drawBarcodeScanRegion(sourceCanvas, regionCanvas);
		drawBarcodeScanRegion(sourceCanvas, regionCanvas);

		expect(setWidth).toHaveBeenCalledOnce();
		expect(setWidth).toHaveBeenCalledWith(640);
		expect(setHeight).toHaveBeenCalledOnce();
		expect(setHeight).toHaveBeenCalledWith(400);
		expect(drawImage).toHaveBeenCalledTimes(2);
	});

	it("falls back to the original frame when canvas decoding is unavailable", () => {
		const sourceCanvas = document.createElement("canvas");
		sourceCanvas.width = 640;
		sourceCanvas.height = 480;
		const regionCanvas = document.createElement("canvas");
		vi.spyOn(regionCanvas, "getContext").mockReturnValue(null);

		expect(drawBarcodeScanRegion(sourceCanvas, regionCanvas)).toBe(
			sourceCanvas,
		);
	});
});
