import { Injectable } from "@nestjs/common";
import { Counter, Gauge, Histogram, type Metric, register } from "prom-client";

function getOrCreate<T extends Metric<string>>(
	name: string,
	create: () => T,
): T {
	return (register.getSingleMetric(name) as T | undefined) ?? create();
}

/** Prometheus instrumentation for depreciation discovery and durable posting. */
@Injectable()
export class DepreciationMetrics {
	private readonly discovered = getOrCreate(
		"aria_asset_depreciation_discovered_total",
		() =>
			new Counter({
				name: "aria_asset_depreciation_discovered_total",
				help: "Depreciation schedule periods discovered from database state.",
				labelNames: ["trigger"],
			}),
	);
	private readonly enqueued = getOrCreate(
		"aria_asset_depreciation_enqueued_total",
		() =>
			new Counter({
				name: "aria_asset_depreciation_enqueued_total",
				help: "Depreciation posting jobs added to BullMQ.",
				labelNames: ["trigger"],
			}),
	);
	private readonly duplicateSkipped = getOrCreate(
		"aria_asset_depreciation_duplicate_skipped_total",
		() =>
			new Counter({
				name: "aria_asset_depreciation_duplicate_skipped_total",
				help: "Pending periods skipped because a deterministic queue job exists.",
			}),
	);
	private readonly completed = getOrCreate(
		"aria_asset_depreciation_completed_total",
		() =>
			new Counter({
				name: "aria_asset_depreciation_completed_total",
				help: "Depreciation jobs completed successfully.",
				labelNames: ["result"],
			}),
	);
	private readonly failed = getOrCreate(
		"aria_asset_depreciation_failed_total",
		() =>
			new Counter({
				name: "aria_asset_depreciation_failed_total",
				help: "Depreciation jobs that reached a terminal failed state.",
			}),
	);
	private readonly retried = getOrCreate(
		"aria_asset_depreciation_retried_total",
		() =>
			new Counter({
				name: "aria_asset_depreciation_retried_total",
				help: "Depreciation worker failures eligible for another attempt.",
			}),
	);
	private readonly blocked = getOrCreate(
		"aria_asset_depreciation_blocked_total",
		() =>
			new Counter({
				name: "aria_asset_depreciation_blocked_total",
				help: "Depreciation jobs deferred behind an earlier unposted period.",
			}),
	);
	private readonly duration = getOrCreate(
		"aria_asset_depreciation_processing_duration_seconds",
		() =>
			new Histogram({
				name: "aria_asset_depreciation_processing_duration_seconds",
				help: "Time spent processing one depreciation posting job.",
				labelNames: ["result"],
				buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
			}),
	);
	private readonly oldestLag = getOrCreate(
		"aria_asset_depreciation_oldest_unposted_lag_seconds",
		() =>
			new Gauge({
				name: "aria_asset_depreciation_oldest_unposted_lag_seconds",
				help: "Age of the oldest due and unfrozen depreciation period.",
			}),
	);

	recordDiscovery(trigger: string, discovered: number, enqueued: number): void {
		this.discovered.inc({ trigger }, discovered);
		this.enqueued.inc({ trigger }, enqueued);
	}

	recordDuplicateSkipped(count = 1): void {
		this.duplicateSkipped.inc(count);
	}

	recordCompleted(result: string): void {
		this.completed.inc({ result });
	}

	recordFailed(terminal: boolean): void {
		(terminal ? this.failed : this.retried).inc();
	}

	recordBlocked(): void {
		this.blocked.inc();
	}

	recordDuration(result: string, seconds: number): void {
		this.duration.observe({ result }, seconds);
	}

	setOldestUnposted(date: Date | null, now = new Date()): void {
		this.oldestLag.set(
			date ? Math.max(0, (now.getTime() - date.getTime()) / 1000) : 0,
		);
	}
}
