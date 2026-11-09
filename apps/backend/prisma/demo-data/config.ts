/**
 * Demo Data Configuration
 *
 * Controls the shape, scale, and scope of generated demo data for the
 * Inventory Management and Asset Management modules. Adjust these settings
 * to tailor demo scenarios for different audiences and presentation contexts.
 *
 * Business context: Pivotr Technologies Pvt Ltd — a Bangalore-based SME
 * manufacturing and distributing electronic components, modules, and
 * custom assemblies.
 */

export type DemoScale = "small" | "medium" | "large";

export interface DemoConfig {
	/** Controls the volume of generated records */
	scale: DemoScale;

	/** Company name used across all records */
	company: string;

	/** Currency code for pricing and transactions */
	currency: string;

	/**
	 * Date window for transactional data.
	 * Master data is created outside this range (earlier).
	 * Transactions span this period to produce realistic history.
	 */
	dateRange: {
		from: Date;
		to: Date;
	};

	/**
	 * Which sub-modules to include.
	 * When all are true the full demo story is available.
	 */
	modules: {
		itemsCatalogue: boolean;
		serialNoAndBatch: boolean;
		stockTransactions: boolean;
		stockReports: boolean;
		inventoryTools: boolean;
		reports: boolean;
		inventorySettings: boolean;
		dashboard: boolean;
	};
}

/** Scale multipliers applied to base record counts */
export const SCALE_MULTIPLIERS: Record<DemoScale, number> = {
	small: 1,
	medium: 2,
	large: 4,
};

/**
 * Default configuration producing a medium-density dataset that covers
 * roughly 6 months of operations for a single electronics SME.
 */
export function getDefaultConfig(): DemoConfig {
	const now = new Date();
	const sixMonthsAgo = new Date(now);
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

	return {
		scale: "medium",
		company: "Pivotr Technologies Pvt Ltd",
		currency: "INR",
		dateRange: {
			from: sixMonthsAgo,
			to: now,
		},
		modules: {
			itemsCatalogue: true,
			serialNoAndBatch: true,
			stockTransactions: true,
			stockReports: true,
			inventoryTools: true,
			reports: true,
			inventorySettings: true,
			dashboard: true,
		},
	};
}

/**
 * Merge partial overrides with the default config.
 */
export function resolveConfig(overrides?: Partial<DemoConfig>): DemoConfig {
	const base = getDefaultConfig();
	if (!overrides) return base;

	return {
		...base,
		...overrides,
		dateRange: { ...base.dateRange, ...overrides.dateRange },
		modules: { ...base.modules, ...overrides.modules },
	};
}
