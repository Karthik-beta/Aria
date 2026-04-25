// ── Formatters ────────────────────────────────────────────────────────

const INR = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

const COMPACT = new Intl.NumberFormat("en-IN", {
	notation: "compact",
	maximumFractionDigits: 1,
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

export function formatCompact(value: number): string {
	return COMPACT.format(value);
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

// ── Stock Entry Type Labels ───────────────────────────────────────────

const STOCK_ENTRY_TYPE_LABELS: Record<string, string> = {
	MATERIAL_RECEIPT: "Material Receipt",
	MATERIAL_ISSUE: "Material Issue",
	MATERIAL_TRANSFER: "Material Transfer",
	MATERIAL_TRANSFER_FOR_MANUFACTURE: "Transfer for Manufacture",
	MANUFACTURE: "Manufacture",
	REPACK: "Repack",
	SEND_TO_SUBCONTRACTOR: "Subcontractor",
};

export function formatStockEntryType(type: string): string {
	return STOCK_ENTRY_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

// ── Delivery Status Labels ────────────────────────────────────────────

const DELIVERY_STATUS_LABELS: Record<string, string> = {
	DRAFT: "Draft",
	TO_BILL: "To Bill",
	COMPLETED: "Completed",
	RETURN_ISSUED: "Return Issued",
	CANCELLED: "Cancelled",
	CLOSED: "Closed",
};

export function formatDeliveryStatus(status: string): string {
	return DELIVERY_STATUS_LABELS[status] ?? status;
}

export function getDeliveryStatusColor(status: string): string {
	switch (status) {
		case "COMPLETED":
		case "CLOSED":
			return "var(--chart-2)";
		case "DRAFT":
			return "var(--chart-3)";
		case "TO_BILL":
			return "var(--chart-1)";
		case "RETURN_ISSUED":
			return "var(--chart-4)";
		case "CANCELLED":
			return "var(--chart-5)";
		default:
			return "var(--muted-foreground)";
	}
}

// ── Expiry urgency ────────────────────────────────────────────────────

export function getExpiryUrgency(daysUntilExpiry: number): {
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

export function getStockValueInsight(
	totalStockValue: number,
	totalStockQuantity: number,
	totalItems: number,
): InsightResult {
	if (totalItems === 0) {
		return {
			text: "No items in catalogue yet",
			subtext: "Add items to begin tracking value",
		};
	}
	if (totalStockQuantity <= 0) {
		return {
			text: "No committed stock yet",
			subtext: `${totalItems} item${totalItems === 1 ? "" : "s"} in catalogue`,
		};
	}
	const avgPerUnit =
		Math.round((totalStockValue / totalStockQuantity) * 100) / 100;
	return {
		text: `~${formatCompactCurrency(avgPerUnit)} avg per unit`,
		subtext: `Across ${totalItems} active item type${totalItems === 1 ? "" : "s"}`,
	};
}

export function getActiveItemsInsight(
	totalItems: number,
	activeWarehouses: number,
): InsightResult {
	if (activeWarehouses === 0) {
		return {
			text: "No warehouses configured",
			subtext: "Set up warehouses to track stock",
		};
	}
	const perWarehouse = Math.round(totalItems / activeWarehouses);
	return {
		text: `~${perWarehouse} item${perWarehouse === 1 ? "" : "s"} per warehouse`,
		subtext: `Tracking ${activeWarehouses} storage location${activeWarehouses === 1 ? "" : "s"}`,
	};
}

export function getLowStockInsight(
	lowStockItemCount: number,
	totalItems: number,
): InsightResult {
	if (lowStockItemCount === 0) {
		return {
			text: "All items within safe limits",
			subtext: "No reorder action needed",
			colorClass: "text-green-600 dark:text-green-400",
		};
	}
	const pct =
		totalItems > 0 ? Math.round((lowStockItemCount / totalItems) * 100) : 100;
	return {
		text: `${pct}% of items need reorder`,
		subtext: "Below safety stock threshold",
		colorClass: "text-destructive",
	};
}

export function getPendingRequestsInsight(
	pendingMaterialRequests: number,
): InsightResult {
	if (pendingMaterialRequests === 0) {
		return {
			text: "Procurement up to date",
			subtext: "No open material requests",
			colorClass: "text-green-600 dark:text-green-400",
		};
	}
	return {
		text: `${pendingMaterialRequests} request${pendingMaterialRequests === 1 ? "" : "s"} awaiting action`,
		subtext: "Check material request queue",
	};
}
