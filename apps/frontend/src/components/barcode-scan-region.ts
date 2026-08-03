const SCAN_REGION_WIDTH_RATIO = 0.6;
const SCAN_REGION_HEIGHT_RATIO = 0.5;
const MAX_SCAN_OUTPUT_WIDTH = 1280;

/** Pixel coordinates used to crop and scale a camera frame for decoding. */
export interface BarcodeScanRegion {
	height: number;
	left: number;
	outputHeight: number;
	outputWidth: number;
	top: number;
	width: number;
}

/**
 * Calculates the centered camera region represented by the scanner target box.
 *
 * The selected region is magnified before decoding so small 1D modules retain
 * enough pixels for ZXing when a camera provides a low-resolution frame.
 */
export function calculateBarcodeScanRegion(
	sourceWidth: number,
	sourceHeight: number,
): BarcodeScanRegion {
	const normalizedWidth = Number.isFinite(sourceWidth)
		? Math.max(0, Math.floor(sourceWidth))
		: 0;
	const normalizedHeight = Number.isFinite(sourceHeight)
		? Math.max(0, Math.floor(sourceHeight))
		: 0;

	if (normalizedWidth === 0 || normalizedHeight === 0) {
		return {
			height: 0,
			left: 0,
			outputHeight: 0,
			outputWidth: 0,
			top: 0,
			width: 0,
		};
	}

	const width = Math.max(
		1,
		Math.round(normalizedWidth * SCAN_REGION_WIDTH_RATIO),
	);
	const height = Math.max(
		1,
		Math.round(normalizedHeight * SCAN_REGION_HEIGHT_RATIO),
	);
	const outputWidth = Math.min(normalizedWidth, MAX_SCAN_OUTPUT_WIDTH);
	const outputHeight = Math.max(1, Math.round(height * (outputWidth / width)));

	return {
		height,
		left: Math.floor((normalizedWidth - width) / 2),
		outputHeight,
		outputWidth,
		top: Math.floor((normalizedHeight - height) / 2),
		width,
	};
}

/**
 * Draws the visible target region into a reusable canvas for ZXing decoding.
 *
 * Returns the original frame when a canvas context is unavailable, preserving
 * scanner compatibility instead of turning an optimization into a hard failure.
 */
export function drawBarcodeScanRegion(
	sourceCanvas: HTMLCanvasElement,
	regionCanvas: HTMLCanvasElement,
): HTMLCanvasElement {
	const region = calculateBarcodeScanRegion(
		sourceCanvas.width,
		sourceCanvas.height,
	);
	if (region.width === 0 || region.height === 0) return sourceCanvas;

	regionCanvas.width = region.outputWidth;
	regionCanvas.height = region.outputHeight;

	let context: CanvasRenderingContext2D | null;
	try {
		context = regionCanvas.getContext("2d", { willReadFrequently: true });
	} catch {
		context = regionCanvas.getContext("2d");
	}
	if (!context) return sourceCanvas;

	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	context.drawImage(
		sourceCanvas,
		region.left,
		region.top,
		region.width,
		region.height,
		0,
		0,
		region.outputWidth,
		region.outputHeight,
	);

	return regionCanvas;
}
