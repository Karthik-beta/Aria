import { describe, expect, it } from "vitest";
import {
	BarcodeScanStabilityTracker,
	REQUIRED_STABLE_READS,
	STABLE_SCAN_WINDOW_MS,
} from "./barcode-scan-stability";

const correctEan = { text: "8904287602549", format: "EAN_13" };
const transientMisread = { text: "4904182602549", format: "EAN_13" };

describe("BarcodeScanStabilityTracker", () => {
	it("ignores a transient misread and accepts three subsequent matching reads", () => {
		const tracker = new BarcodeScanStabilityTracker();

		expect(tracker.record(transientMisread, 0)).toMatchObject({
			count: 1,
			accepted: false,
		});
		expect(tracker.record(correctEan, 300)).toMatchObject({
			count: 1,
			accepted: false,
		});
		expect(tracker.record(correctEan, 800)).toMatchObject({
			count: 2,
			accepted: false,
		});
		expect(tracker.record(correctEan, 1_300)).toMatchObject({
			count: 3,
			accepted: true,
		});
	});

	it("accepts only once until reset", () => {
		const tracker = new BarcodeScanStabilityTracker();

		tracker.record(correctEan, 0);
		tracker.record(correctEan, 500);
		expect(tracker.record(correctEan, 1_000).accepted).toBe(true);
		expect(tracker.record(correctEan, 1_500).accepted).toBe(false);

		tracker.reset();
		expect(tracker.record(correctEan, 2_000)).toMatchObject({
			count: 1,
			accepted: false,
		});
	});

	it("resets when the decoded value changes", () => {
		const tracker = new BarcodeScanStabilityTracker();

		tracker.record(correctEan, 0);
		tracker.record(correctEan, 500);
		expect(tracker.record(transientMisread, 800)).toMatchObject({
			candidate: transientMisread,
			count: 1,
			accepted: false,
		});
	});

	it("treats the format as part of the candidate identity", () => {
		const tracker = new BarcodeScanStabilityTracker();

		tracker.record(correctEan, 0);
		expect(
			tracker.record({ ...correctEan, format: "CODE_128" }, 500),
		).toMatchObject({ count: 1, accepted: false });
	});

	it("restarts after the stability window expires", () => {
		const tracker = new BarcodeScanStabilityTracker();

		tracker.record(correctEan, 0);
		tracker.record(correctEan, 1_000);
		expect(tracker.record(correctEan, 2_501)).toMatchObject({
			count: 1,
			accepted: false,
		});
	});

	it("allows gaps with no successful result inside the stability window", () => {
		const tracker = new BarcodeScanStabilityTracker();

		tracker.record(correctEan, 0);
		tracker.record(correctEan, 1_500);
		expect(tracker.record(correctEan, 2_400)).toMatchObject({
			count: 3,
			accepted: true,
		});
	});

	it("accepts a candidate exactly at the stability-window boundary", () => {
		const tracker = new BarcodeScanStabilityTracker();

		tracker.record(correctEan, 0);
		tracker.record(correctEan, STABLE_SCAN_WINDOW_MS - 1);
		expect(tracker.record(correctEan, STABLE_SCAN_WINDOW_MS)).toMatchObject({
			count: REQUIRED_STABLE_READS,
			accepted: true,
		});
	});

	it("measures expiration from the first read rather than extending the window", () => {
		const tracker = new BarcodeScanStabilityTracker();

		tracker.record(correctEan, 0);
		tracker.record(correctEan, STABLE_SCAN_WINDOW_MS - 100);
		expect(tracker.record(correctEan, STABLE_SCAN_WINDOW_MS + 1)).toMatchObject(
			{ count: 1, accepted: false },
		);
	});

	it.each([
		"EAN_13",
		"UPC_A",
		"CODE_39",
		"CODE_128",
		"QR_CODE",
	])("applies the same stability policy to %s", (format) => {
		const tracker = new BarcodeScanStabilityTracker();
		const candidate = { text: `value-for-${format}`, format };

		tracker.record(candidate, 0);
		tracker.record(candidate, 100);
		expect(tracker.record(candidate, 200)).toMatchObject({
			candidate,
			count: REQUIRED_STABLE_READS,
			accepted: true,
		});
	});

	it("never accepts rapidly alternating checksum-valid values", () => {
		const tracker = new BarcodeScanStabilityTracker();

		for (let index = 0; index < 20; index += 1) {
			const candidate = index % 2 === 0 ? correctEan : transientMisread;
			expect(tracker.record(candidate, index * 50)).toMatchObject({
				count: 1,
				accepted: false,
			});
		}
	});

	it("honors explicit policy options without changing the production defaults", () => {
		const tracker = new BarcodeScanStabilityTracker({
			requiredReads: 2,
			windowMs: 100,
		});

		expect(tracker.record(correctEan, 0)).toMatchObject({
			count: 1,
			required: 2,
			accepted: false,
		});
		expect(tracker.record(correctEan, 100)).toMatchObject({
			count: 2,
			required: 2,
			accepted: true,
		});
	});
});
