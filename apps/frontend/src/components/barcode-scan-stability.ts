export const REQUIRED_STABLE_READS = 3;
export const STABLE_SCAN_WINDOW_MS = 2_500;

/** Text and symbology returned by one successful decoder attempt. */
export interface BarcodeScanCandidate {
	text: string;
	format: string;
}

/** Stability progress emitted after recording a successful candidate. */
export interface BarcodeScanObservation {
	candidate: BarcodeScanCandidate;
	count: number;
	required: number;
	accepted: boolean;
}

interface BarcodeScanStabilityOptions {
	requiredReads?: number;
	windowMs?: number;
}

/**
 * Tracks matching decoder results and accepts a barcode only after it remains
 * stable across multiple successful camera frames. Failed decode attempts are
 * intentionally ignored because callers record only successful candidates.
 */
export class BarcodeScanStabilityTracker {
	private readonly requiredReads: number;
	private readonly windowMs: number;
	private currentCandidate: BarcodeScanCandidate | null = null;
	private firstReadAt = 0;
	private count = 0;
	private hasAccepted = false;

	constructor(options: BarcodeScanStabilityOptions = {}) {
		this.requiredReads = options.requiredReads ?? REQUIRED_STABLE_READS;
		this.windowMs = options.windowMs ?? STABLE_SCAN_WINDOW_MS;
	}

	/** Records one successful decode and reports the current stability progress. */
	record(
		candidate: BarcodeScanCandidate,
		now: number = Date.now(),
	): BarcodeScanObservation {
		if (this.hasAccepted) {
			return {
				candidate,
				count: this.requiredReads,
				required: this.requiredReads,
				accepted: false,
			};
		}

		const matchesCurrent =
			this.currentCandidate?.text === candidate.text &&
			this.currentCandidate.format === candidate.format;
		const isWithinWindow = now - this.firstReadAt <= this.windowMs;

		if (!matchesCurrent || !isWithinWindow) {
			this.currentCandidate = candidate;
			this.firstReadAt = now;
			this.count = 1;
		} else {
			this.count += 1;
		}

		const accepted = this.count >= this.requiredReads;
		if (accepted) {
			this.hasAccepted = true;
		}

		return {
			candidate,
			count: Math.min(this.count, this.requiredReads),
			required: this.requiredReads,
			accepted,
		};
	}

	/** Clears candidate history before a new camera session or device switch. */
	reset(): void {
		this.currentCandidate = null;
		this.firstReadAt = 0;
		this.count = 0;
		this.hasAccepted = false;
	}
}
