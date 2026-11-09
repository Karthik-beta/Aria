// ── Formatters ────────────────────────────────────────────────────────

const INR = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

const QUANTITY_FMT = new Intl.NumberFormat("en-IN", {
	maximumFractionDigits: 0,
});

const SHORT_MONTH_DAY_UTC = new Intl.DateTimeFormat("en-IN", {
	day: "2-digit",
	month: "short",
	timeZone: "UTC",
});

export function formatCurrency(value: number): string {
	return INR.format(value);
}

export function formatCompactCurrency(value: number): string {
	if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
	if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
	if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
	return `₹${value}`;
}

export function formatQuantity(value: number): string {
	return QUANTITY_FMT.format(value);
}

/**
 * Formats a dashboard activity timestamp relative to a stable reference time.
 *
 * Passing a server snapshot time keeps the server-rendered HTML and hydrated
 * client text identical, which avoids React hydration mismatches.
 */
export function formatRelativeDate(
	date: Date | string,
	referenceTime = Date.now(),
): string {
	const d = typeof date === "string" ? new Date(date) : date;
	const diffMs = referenceTime - d.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHrs = Math.floor(diffMins / 60);
	if (diffHrs < 24) return `${diffHrs}h ago`;
	const diffDays = Math.floor(diffHrs / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	return SHORT_MONTH_DAY_UTC.format(d);
}

export function formatShortDate(date: string): string {
	const d = new Date(date);
	return SHORT_MONTH_DAY_UTC.format(d);
}

export function formatMonth(month: string): string {
	const [year, m] = month.split("-");
	const date = new Date(Number(year), Number(m) - 1);
	return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

// ── Asset Status Labels ───────────────────────────────────────────────

const ASSET_STATUS_LABELS: Record<string, string> = {
	DRAFT: "Draft",
	SUBMITTED: "Submitted",
	PARTIALLY_DEPRECIATED: "Partially Depreciated",
	FULLY_DEPRECIATED: "Fully Depreciated",
	SOLD: "Sold",
	SCRAPPED: "Scrapped",
	IN_MAINTENANCE: "In Maintenance",
	OUT_OF_ORDER: "Out of Order",
};

export function formatAssetStatus(status: string): string {
	return ASSET_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function getAssetStatusColor(status: string): string {
	switch (status) {
		case "SUBMITTED":
			return "var(--chart-2)";
		case "PARTIALLY_DEPRECIATED":
			return "var(--chart-1)";
		case "FULLY_DEPRECIATED":
			return "var(--chart-3)";
		case "IN_MAINTENANCE":
			return "var(--chart-4)";
		case "OUT_OF_ORDER":
			return "var(--chart-5)";
		case "DRAFT":
			return "var(--muted-foreground)";
		case "SOLD":
			return "var(--primary)";
		case "SCRAPPED":
			return "var(--accent-foreground)";
		default:
			return "var(--muted-foreground)";
	}
}

// ── Adjustment Status Labels ──────────────────────────────────────────

const ADJUSTMENT_STATUS_LABELS: Record<string, string> = {
	DRAFT: "Draft",
	SUBMITTED: "Submitted",
	CANCELLED: "Cancelled",
};

export function formatAdjustmentStatus(status: string): string {
	return ADJUSTMENT_STATUS_LABELS[status] ?? status;
}

export function getAdjustmentStatusColor(status: string): string {
	switch (status) {
		case "SUBMITTED":
			return "var(--chart-2)";
		case "DRAFT":
			return "var(--chart-3)";
		case "CANCELLED":
			return "var(--chart-5)";
		default:
			return "var(--muted-foreground)";
	}
}

// ── Maintenance Urgency ───────────────────────────────────────────────

export function getMaintenanceUrgency(daysUntilDue: number): {
	label: string;
	className: string;
} {
	if (daysUntilDue <= 0) {
		return { label: "Overdue", className: "text-red-600 dark:text-red-400" };
	}
	if (daysUntilDue <= 7) {
		return {
			label: "Urgent",
			className: "text-red-600 dark:text-red-400",
		};
	}
	if (daysUntilDue <= 30) {
		return {
			label: "Soon",
			className: "text-amber-600 dark:text-amber-400",
		};
	}
	if (daysUntilDue <= 60) {
		return {
			label: "Upcoming",
			className: "text-yellow-600 dark:text-yellow-400",
		};
	}
	return { label: "Planned", className: "text-green-600 dark:text-green-400" };
}

// ── Insurance Expiry Urgency ──────────────────────────────────────────

export function getInsuranceUrgency(daysUntilExpiry: number): {
	label: string;
	className: string;
} {
	if (daysUntilExpiry <= 0) {
		return { label: "Expired", className: "text-red-600 dark:text-red-400" };
	}
	if (daysUntilExpiry <= 7) {
		return {
			label: "Critical",
			className: "text-red-600 dark:text-red-400",
		};
	}
	if (daysUntilExpiry <= 30) {
		return {
			label: "Warning",
			className: "text-amber-600 dark:text-amber-400",
		};
	}
	if (daysUntilExpiry <= 60) {
		return {
			label: "Upcoming",
			className: "text-yellow-600 dark:text-yellow-400",
		};
	}
	return { label: "OK", className: "text-green-600 dark:text-green-400" };
}

// ── Chart colors ──────────────────────────────────────────────────────

export const CHART_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--primary)",
	"var(--muted-foreground)",
	"var(--accent-foreground)",
] as const;

export function getChartColor(index: number): string {
	return CHART_COLORS[index % CHART_COLORS.length];
}

// ── KPI Insight Callouts ──────────────────────────────────────────────

export interface InsightResult {
	text: string;
	subtext: string;
	colorClass?: string;
}

export function getAssetValueInsight(
	totalAssetValue: number,
	totalPurchaseValue: number,
): InsightResult {
	if (totalPurchaseValue === 0) {
		return {
			text: "No assets registered yet",
			subtext: "Add assets to begin tracking value",
		};
	}
	const retentionPct = Math.round((totalAssetValue / totalPurchaseValue) * 100);
	return {
		text: `${retentionPct}% value retained`,
		subtext: `Purchase cost ${formatCompactCurrency(totalPurchaseValue)}`,
	};
}

export function getActiveAssetsInsight(
	activeAssets: number,
	totalAssets: number,
	locationCount: number,
): InsightResult {
	if (totalAssets === 0) {
		return {
			text: "No assets in registry",
			subtext: "Create assets to begin tracking",
		};
	}
	const activePct = Math.round((activeAssets / totalAssets) * 100);
	return {
		text: `${activePct}% operational`,
		subtext: `Across ${locationCount} location${locationCount === 1 ? "" : "s"}`,
	};
}

export function getMaintenanceDueInsight(
	maintenanceDueCount: number,
): InsightResult {
	if (maintenanceDueCount === 0) {
		return {
			text: "All maintenance up to date",
			subtext: "No overdue tasks",
			colorClass: "text-green-600 dark:text-green-400",
		};
	}
	return {
		text: `${maintenanceDueCount} task${maintenanceDueCount === 1 ? "" : "s"} due now`,
		subtext: "Check maintenance schedule",
		colorClass: "text-destructive",
	};
}

export function getPendingAdjustmentsInsight(
	pendingAdjustments: number,
): InsightResult {
	if (pendingAdjustments === 0) {
		return {
			text: "No pending adjustments",
			subtext: "All values are current",
			colorClass: "text-green-600 dark:text-green-400",
		};
	}
	return {
		text: `${pendingAdjustments} draft${pendingAdjustments === 1 ? "" : "s"} awaiting review`,
		subtext: "Submit or cancel when ready",
	};
}
