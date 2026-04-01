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

export function formatRelativeDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHrs = Math.floor(diffMins / 60);
	if (diffHrs < 24) return `${diffHrs}h ago`;
	const diffDays = Math.floor(diffHrs / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function formatShortDate(date: string): string {
	const d = new Date(date);
	return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
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
