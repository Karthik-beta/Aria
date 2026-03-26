/**
 * App-specific sidebar navigation data
 * Each app (Inventory, Asset, CRM, HRMS) has its own navigation structure
 */

import type { NavItem } from "../types";

export type { NavItem };

export const inventoryNavItems: NavItem[] = [
	{
		title: "Dashboard",
		url: "/inventory/dashboard/overview",
		icon: "dashboard",
		isActive: false,
		shortcut: ["d", "d"],
		items: [],
	},
	{
		title: "Items Catalogue",
		url: "#",
		icon: "catalogue",
		isActive: false,
		items: [
			{
				title: "Item",
				url: "/inventory/items-catalogue/item",
			},
			{
				title: "Item Group",
				url: "/inventory/items-catalogue/item-group",
			},
			{
				title: "Product Bundle",
				url: "/inventory/items-catalogue/product-bundle",
			},
			{
				title: "Shipping Rule",
				url: "/inventory/items-catalogue/shipping-rules",
			},
			{
				title: "Item Alternative",
				url: "/inventory/items-catalogue/item-alternatives",
			},
			{
				title: "Item Manufacturer",
				url: "/inventory/items-catalogue/manufacturers",
			},
		],
	},
	{
		title: "Stock Transactions",
		url: "#",
		icon: "transaction",
		isActive: false,
		items: [
			{
				title: "Material Request",
				url: "/inventory/stock-transaction/material-request",
			},
			{
				title: "Stock Entry",
				url: "/inventory/stock-transaction/stock-entry",
			},
			{
				title: "Delivery Note",
				url: "/inventory/stock-transaction/delivery-note",
			},
			{
				title: "Purchase Receipt",
				url: "/inventory/stock-transaction/purchase-receipt",
			},
			{
				title: "Pick List",
				url: "/inventory/stock-transaction/pick-list",
			},
			{
				title: "Delivery Trip",
				url: "/inventory/stock-transaction/delivery-trip",
			},
		],
	},
	{
		title: "Stock Reports",
		url: "#",
		icon: "report",
		isActive: false,
		items: [
			{
				title: "Stock Ledger",
				url: "/inventory/stock-reports/stock-ledger",
			},
			{
				title: "Stock Balance",
				url: "/inventory/stock-reports/stock-balance",
			},
			{
				title: "Stock Projected Qty",
				url: "/inventory/stock-reports/stock-projected-qty",
			},
			{
				title: "Stock Summary",
				url: "/inventory/stock-reports/stock-summary",
			},
			{
				title: "Stock Ageing",
				url: "/inventory/stock-reports/stock-ageing",
			},
			{
				title: "Item Price Stock",
				url: "/inventory/stock-reports/item-price-stock",
			},
			{
				title: "Warehouse Wise Stock Balance",
				url: "/inventory/stock-reports/warehouse-wise-stock-balance",
			},
		],
	},
	{
		title: "Inventory Settings",
		url: "#",
		icon: "settings",
		isActive: false,
		items: [
			{
				title: "Stock Settings",
				url: "/inventory/inventory-settings/stock-settings",
			},
			{
				title: "Warehouse",
				url: "/inventory/inventory-settings/warehouse",
			},
			{
				title: "Unit of Measure (UOM)",
				url: "/inventory/inventory-settings/uom",
			},
			{
				title: "Brand",
				url: "/inventory/inventory-settings/brand",
			},
			{
				title: "Item Attribute",
				url: "/inventory/inventory-settings/item-attribute",
			},
			{
				title: "Item Variant Settings",
				url: "/inventory/inventory-settings/item-variant-settings",
			},
		],
	},
	{
		title: "Serial No and Batch",
		url: "#",
		icon: "serial",
		isActive: false,
		items: [
			{
				title: "Serial No",
				url: "/inventory/serial-no-and-batch/serial-no",
			},
			{
				title: "Batch",
				url: "/inventory/serial-no-and-batch/batch",
			},
			{
				title: "Installation Note",
				url: "/inventory/serial-no-and-batch/installation-note",
			},
			{
				title: "Serial No Service Contract Expiry",
				url: "/inventory/serial-no-and-batch/serial-no-service-contract-expiry",
			},
			{
				title: "Serial No Status",
				url: "/inventory/serial-no-and-batch/serial-no-status",
			},
			{
				title: "Serial No Warranty Expiry",
				url: "/inventory/serial-no-and-batch/serial-no-warranty-expiry",
			},
		],
	},
	{
		title: "Tools",
		url: "#",
		icon: "tools",
		isActive: false,
		items: [
			{
				title: "Packing Slip",
				url: "/inventory/inventory-tools/packing-slip",
			},
			{
				title: "Quality Inspection Template",
				url: "/inventory/quality-inspection-template",
			},
			{
				title: "Quick Stock Balance",
				url: "/inventory/quick-stock-balance",
			},
		],
	},
	{
		title: "Key Reports",
		url: "#",
		icon: "report",
		isActive: false,
		items: [
			{
				title: "Stock Analytics",
				url: "/inventory/reports/stock-analytics",
			},
			{
				title: "Delivery Note Trends",
				url: "/inventory/reports/delivery-note-trends",
			},
			{
				title: "Purchase Receipt Trends",
				url: "/inventory/reports/purchase-receipt-trends",
			},
			{
				title: "Sales Order Analysis",
				url: "/inventory/reports/sales-order-analysis",
			},
			{
				title: "Purchase Order Analysis",
				url: "/inventory/reports/purchase-order-analysis",
			},
			{
				title: "Item Shortage Report",
				url: "/inventory/reports/item-shortage",
			},
			{
				title: "Batch-Wise Balance History",
				url: "/inventory/reports/batch-wise-balance-history",
			},
		],
	},
	{
		title: "Other Reports",
		url: "#",
		icon: "report",
		isActive: false,
		items: [
			{
				title: "Requested Items To Be Transferred",
				url: "/inventory/reports/requested-items-transferred",
			},
			{
				title: "Batch Item Expiry Status",
				url: "/inventory/reports/batch-item-expiry-status",
			},
			{
				title: "Item Prices",
				url: "/inventory/reports/item-prices",
			},
			{
				title: "Itemwise Recommended Reorder Level",
				url: "/inventory/reports/itemwise-reorder-level",
			},
			{
				title: "Item Variant Details",
				url: "/inventory/reports/item-variant-details",
			},
			{
				title: "Subcontracted Raw Materials To Be Transferred",
				url: "/inventory/reports/subcontracted-raw-materials-transferred",
			},
			{
				title: "Subcontracted Item To Be Received",
				url: "/inventory/reports/subcontracted-item-received",
			},
		],
	},
];

export const assetNavItems: NavItem[] = [
	{
		title: "Dashboard",
		url: "/asset/dashboard",
		icon: "dashboard",
		isActive: false,
		shortcut: ["d", "d"],
		items: [],
	},
	{
		title: "Assets",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Asset",
				url: "/asset/asset",
			},
			{
				title: "Location",
				url: "/asset/location",
			},
			{
				title: "Asset Category",
				url: "/asset/asset-category",
			},
		],
	},
	{
		title: "Maintenance",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Asset Maintenance Team",
				url: "/asset/maintenance-team",
			},
			{
				title: "Asset Maintenance",
				url: "/asset/maintenance",
			},
			{
				title: "Asset Maintenance Log",
				url: "/asset/maintenance-log",
			},
			{
				title: "Asset Value Adjustment",
				url: "/asset/value-adjustment",
			},
		],
	},
	{
		title: "Reports",
		url: "#",
		icon: "report",
		isActive: false,
		items: [
			{
				title: "Asset Depreciation Ledger",
				url: "/asset/reports/depreciation-ledger",
			},
			{
				title: "Asset Depreciations and Balances",
				url: "/asset/reports/depreciations-balances",
			},
			{
				title: "Asset Activity",
				url: "/asset/reports/activity",
			},
		],
	},
	{
		title: "Settings",
		url: "#",
		icon: "settings",
		isActive: false,
		items: [
			{
				title: "Asset Settings",
				url: "/asset/settings",
			},
		],
	},
];

export const crmNavItems: NavItem[] = [
	{
		title: "Dashboard",
		url: "/crm/dashboard",
		icon: "dashboard",
		isActive: false,
		shortcut: ["d", "d"],
		items: [],
	},
	{
		title: "Sales Analytics",
		url: "/",
		icon: "dashboard",
		isActive: false,
		shortcut: ["d", "d"],
		items: [],
	},
	{
		title: "Sales Pipeline",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Lead",
				url: "/crm/leads",
			},
			{
				title: "Opportunity",
				url: "/crm/opportunities",
			},
			{
				title: "Customer",
				url: "/crm/customers",
			},
			{
				title: "Appointment",
				url: "/crm/appointments",
			},
			{
				title: "Communication",
				url: "/crm/communications",
			},
		],
	},
	{
		title: "Masters",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Territory",
				url: "/crm/territories",
			},
			{
				title: "Customer Group",
				url: "/crm/customer-groups",
			},
			{
				title: "Contact",
				url: "/crm/contacts",
			},
			{
				title: "Prospect",
				url: "/crm/prospects",
			},
			{
				title: "Sales Person",
				url: "/crm/sales-persons",
			},
			{
				title: "Lead Source",
				url: "/crm/lead-sources",
			},
		],
	},
	{
		title: "Reports",
		url: "#",
		icon: "report",
		isActive: false,
		items: [
			{
				title: "Lead Details",
				url: "/crm/reports/lead-details",
			},
			{
				title: "Sales Pipeline Analytics",
				url: "/crm/reports/sales-pipeline-analytics",
			},
			{
				title: "Opportunity Summary by Sales Stage",
				url: "/crm/reports/opportunity-summary",
			},
			{
				title: "Prospects Engaged But Not Converted",
				url: "/crm/reports/prospects-engaged",
			},
			{
				title: "First Response Time for Opportunity",
				url: "/crm/reports/first-response-time",
			},
			{
				title: "Inactive Customers",
				url: "/crm/reports/inactive-customers",
			},
			{
				title: "Campaign Efficiency",
				url: "/crm/reports/campaign-efficiency",
			},
			{
				title: "Lead Owner Efficiency",
				url: "/crm/reports/lead-owner-efficiency",
			},
		],
	},
	{
		title: "Campaign",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Campaign",
				url: "/crm/campaigns",
			},
		],
	},
	{
		title: "Settings",
		url: "#",
		icon: "settings",
		isActive: false,
		items: [
			{
				title: "CRM Settings",
				url: "/crm/settings",
			},
		],
	},
	{
		title: "Maintenance",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Maintenance Visit",
				url: "/crm/maintenance-visits",
			},
			{
				title: "Warranty Claim",
				url: "/crm/warranty-claims",
			},
		],
	},
];

export const hrmsNavItems: NavItem[] = [
	{
		title: "Dashboard",
		url: "/hrms/dashboard",
		icon: "dashboard",
		isActive: false,
		shortcut: ["d", "d"],
		items: [],
	},
	{
		title: "Setup",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Company",
				url: "/hrms/company",
			},
			{
				title: "Branch",
				url: "/hrms/branches",
			},
			{
				title: "Department",
				url: "/hrms/departments",
			},
			{
				title: "Designation",
				url: "/hrms/designations",
			},
		],
	},
	{
		title: "Employee",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Employee",
				url: "/hrms/employees",
			},
			{
				title: "Employee Grade",
				url: "/hrms/employee-grades",
			},
		],
	},
	{
		title: "Leaves",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Leave Application",
				url: "/hrms/leave-applications",
			},
			{
				title: "Compensatory Leave Request",
				url: "/hrms/compensatory-leave-requests",
			},
		],
	},
	{
		title: "Settings",
		url: "#",
		icon: "settings",
		isActive: false,
		items: [
			{
				title: "HR Settings",
				url: "/hrms/settings",
			},
		],
	},
	{
		title: "Attendance",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Attendance",
				url: "/hrms/attendance",
			},
			{
				title: "Attendance Request",
				url: "/hrms/attendance-requests",
			},
			{
				title: "Employee Checkin",
				url: "/hrms/employee-checkins",
			},
		],
	},
	{
		title: "Expense Claim",
		url: "#",
		icon: "dashboard",
		isActive: false,
		items: [
			{
				title: "Expense Claim",
				url: "/hrms/expense-claims",
			},
			{
				title: "Employee Advance",
				url: "/hrms/employee-advances",
			},
		],
	},
	{
		title: "Key Reports",
		url: "#",
		icon: "report",
		isActive: false,
		items: [
			{
				title: "Monthly Attendance Sheet",
				url: "/hrms/reports/monthly-attendance",
			},
			{
				title: "Recruitment Analytics",
				url: "/hrms/reports/recruitment-analytics",
			},
			{
				title: "Employee Analytics",
				url: "/hrms/reports/employee-analytics",
			},
			{
				title: "Employee Leave Balance",
				url: "/hrms/reports/employee-leave-balance",
			},
			{
				title: "Employee Leave Balance Summary",
				url: "/hrms/reports/employee-leave-balance-summary",
			},
			{
				title: "Employee Advance Summary",
				url: "/hrms/reports/employee-advance-summary",
			},
			{
				title: "Employee Exits",
				url: "/hrms/reports/employee-exits",
			},
		],
	},
	{
		title: "Other Reports",
		url: "#",
		icon: "report",
		isActive: false,
		items: [
			{
				title: "Employee Information",
				url: "/hrms/reports/employee-information",
			},
			{
				title: "Employee Birthday",
				url: "/hrms/reports/employee-birthday",
			},
			{
				title: "Employees Working on a Holiday",
				url: "/hrms/reports/employees-holiday",
			},
			{
				title: "Daily Work Summary Replies",
				url: "/hrms/reports/daily-work-summary",
			},
		],
	},
];

/**
 * Metadata for each app (used for headers, labels, etc.)
 * Frozen for performance optimization
 */
export const appMetadata = Object.freeze({
	inventory: Object.freeze({
		label: "Inventory Management",
		description: "Manage stock, items, and warehouse operations",
	}),
	asset: Object.freeze({
		label: "Asset Management",
		description: "Track and manage company assets",
	}),
	crm: Object.freeze({
		label: "Customer Relations",
		description: "Manage customers, leads, and sales",
	}),
	hrms: Object.freeze({
		label: "Human Resources",
		description: "Manage employees, payroll, and attendance",
	}),
} as const);

/**
 * Pre-computed navigation map for fast lookups
 * Frozen for performance optimization
 */
const NAV_MAP = Object.freeze({
	inventory: inventoryNavItems,
	asset: assetNavItems,
	crm: crmNavItems,
	hrms: hrmsNavItems,
} as const);

/**
 * Type for valid app names
 */
type AppName = keyof typeof NAV_MAP;

/**
 * Get navigation items for a specific app
 * Optimized with pre-computed map and type safety
 * @param appName - The app name (e.g., 'inventory', 'asset', 'crm', 'hrms')
 * @returns Array of navigation items for the app
 */
export const getAppNavItems = (appName: string): NavItem[] => {
	const lowerAppName = appName.toLowerCase() as AppName;
	return NAV_MAP[lowerAppName] ?? inventoryNavItems; // Default to inventory if app not found
};

/**
 * Get metadata for a specific app
 * Optimized with direct object access
 * @param appName - The app name
 * @returns Metadata object for the app
 */
export const getAppMetadata = (appName: string) => {
	const lowerAppName = appName.toLowerCase() as AppName;
	return appMetadata[lowerAppName] ?? appMetadata.inventory;
};
