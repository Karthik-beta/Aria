/**
 * Advanced Data Table Types
 * Enterprise-grade type definitions for the advanced data table component
 * @module advanced-data-table/types
 */

import type {
	ColumnFiltersState,
	PaginationState,
	Row,
	RowData,
	SortingState,
	Table,
	VisibilityState,
} from "@tanstack/react-table";
import type {
	BulkEditColumnConfig,
	BulkEditFieldType,
	Option,
} from "@/types/data-table";

/**
 * Supported export formats
 */
export type ExportFormat = "csv" | "excel" | "pdf" | "json";

/**
 * Error types for advanced data table operations
 */
export type AdvancedDataTableError =
	| { type: "export"; message: string; format: ExportFormat; cause?: unknown }
	| { type: "import"; message: string; fileName: string; cause?: unknown }
	| {
			type: "bulk-action";
			message: string;
			actionLabel: string;
			cause?: unknown;
	  }
	| { type: "validation"; message: string; field?: string; cause?: unknown }
	| { type: "network"; message: string; cause?: unknown }
	| { type: "unknown"; message: string; cause?: unknown };

/**
 * Result type for async operations
 */
export type AsyncResult<T, E = AdvancedDataTableError> =
	| { success: true; data: T }
	| { success: false; error: E };

/**
 * Bulk action definition with improved type safety
 * @template TData - The row data type
 */
export type BulkAction<TData extends RowData = RowData> = {
	/** Unique identifier for the action */
	id?: string;
	/** Display label for the action */
	label: string;
	/** Optional icon component */
	icon?: React.ReactNode;
	/** Action handler that receives selected rows */
	action: (rows: readonly Row<TData>[]) => void | Promise<void>;
	/** Visual variant for the action button */
	variant?:
		| "default"
		| "destructive"
		| "outline"
		| "secondary"
		| "ghost"
		| "link";
	/** Whether to show confirmation dialog before executing */
	requiresConfirmation?: boolean;
	/** Custom confirmation message */
	confirmationMessage?: string;
	/** Whether the action is disabled */
	disabled?: boolean | ((rows: readonly Row<TData>[]) => boolean);
};

/**
 * Resolved bulk-edit field definition derived from a column.
 */
export interface ResolvedBulkEditField {
	columnId: string;
	field: string;
	type: BulkEditFieldType;
	label: string;
	placeholder?: string;
	options?: readonly Option[];
	allowClear: boolean;
	columnConfig: BulkEditColumnConfig;
}

/**
 * Normalized bulk-edit request passed to consuming pages.
 */
export interface BulkEditRequest<TData extends RowData = RowData> {
	rows: readonly Row<TData>[];
	columnId: string;
	field: string;
	operation: "set" | "clear";
	value?: string | number | boolean;
	config: ResolvedBulkEditField;
}

/**
 * Props for the AdvancedDataTable component
 * @template TData - The row data type extending RowData
 */
export interface AdvancedDataTableProps<TData extends RowData> {
	// Core table configuration
	/** TanStack Table instance (required) */
	table: Table<TData>;

	/** Raw data array (required for empty state detection) */
	data: readonly TData[];

	/** Total items count for server-side pagination */
	totalItems?: number;

	// Features configuration
	/** Enable global search across all columns */
	enableGlobalSearch?: boolean;

	/** Enable per-column search filters */
	enableColumnSearch?: boolean;

	/** Enable data export functionality */
	enableExport?: boolean;

	/** Enable data import functionality */
	enableImport?: boolean;

	/** Enable bulk actions on selected rows */
	enableBulkActions?: boolean;

	/** Enable built-in bulk edit for eligible columns */
	enableBulkEdit?: boolean;

	/** Enable virtualization for large datasets (>50 rows) */
	enableVirtualization?: boolean;

	/** Enable real-time updates via subscriptions */
	enableRealtime?: boolean;

	/** Enable inline editing (reserved for future use) */
	enableInlineEdit?: boolean;

	/** Enable column resizing */
	enableColumnResizing?: boolean;

	/** Enable column reordering via drag-and-drop */
	enableColumnReordering?: boolean;

	/** Enable column pinning/freezing */
	enableColumnFreezing?: boolean;

	// Export configuration
	/** Available export formats */
	exportFormats?: readonly ExportFormat[];

	/** Custom export handler */
	onExport?: (
		format: ExportFormat,
		rows: readonly Row<TData>[],
	) => void | Promise<void>;

	// Import configuration
	/** Custom import handler that receives the parsed data */
	onImport?: (data: readonly Record<string, unknown>[]) => void | Promise<void>;

	// Bulk actions
	/** Array of bulk action definitions */
	bulkActions?: readonly BulkAction<TData>[];

	/** Built-in bulk edit handler */
	onBulkEdit?: (request: BulkEditRequest<TData>) => void | Promise<void>;

	// CRUD operations
	/** Handler for creating new rows */
	onRowCreate?: () => void | Promise<void>;

	/** Handler for updating a single row */
	onRowUpdate?: (row: Row<TData>) => void | Promise<void>;

	/** Handler for deleting multiple rows */
	onRowDelete?: (rows: readonly Row<TData>[]) => void | Promise<void>;

	// Real-time updates via tRPC subscription
	/** Unique key for subscription identification */
	subscriptionKey?: string;

	/** Callback when subscription receives new data */
	onSubscriptionUpdate?: (data: TData) => void;

	// Virtualization settings
	/** Estimated row height in pixels for virtualizer */
	virtualScrollEstimateSize?: number;

	/** Number of rows to render outside viewport */
	virtualScrollOverscan?: number;

	// UI customization
	/** Custom toolbar component (replaces default) */
	toolbar?: React.ReactNode;

	/** Primary action button (converts to "Actions" when rows are selected) */
	primaryAction?: React.ReactNode;

	/** Custom action bar shown when rows are selected */
	actionBar?: React.ReactNode;

	/** Custom empty state component */
	emptyState?: React.ReactNode;

	/** Custom loading state component */
	loadingState?: React.ReactNode;

	// Accessibility
	/** ARIA label for the table region */
	ariaLabel?: string;

	/** ARIA description for the table region */
	ariaDescription?: string;

	// Callbacks
	/** Callback fired when table state changes */
	onStateChange?: (state: TableState) => void;

	/** Error handler for all table operations */
	onError?: (error: AdvancedDataTableError) => void;

	// Advanced filtering
	/** Enable advanced filter UI (reserved for future use) */
	enableAdvancedFilter?: boolean;

	// Styling
	/** Additional CSS classes for the table */
	className?: string;

	/** Additional CSS classes for the container */
	containerClassName?: string;
}

/**
 * Table state snapshot for external state management
 */
export interface TableState {
	sorting: SortingState;
	columnFilters: ColumnFiltersState;
	columnVisibility: VisibilityState;
	rowSelection: Record<string, boolean>;
	pagination: PaginationState;
	globalFilter?: string;
}

/**
 * Column resize state (from TanStack Table)
 */
export interface ColumnResizeState {
	columnSizingInfo: {
		columnSizingStart: readonly [string, number][];
		deltaOffset: number | null;
		deltaPercentage: number | null;
		isResizingColumn: string | false;
		startOffset: number | null;
		startSize: number | null;
	};
}

/**
 * Virtual item representation (from TanStack Virtual)
 */
export interface VirtualItem {
	key: React.Key;
	index: number;
	start: number;
	size: number;
	end: number;
	lane?: number;
}

/**
 * Utility type for extracting row data type from Table
 */
export type ExtractTableData<T> = T extends Table<infer TData> ? TData : never;

/**
 * Utility type for ensuring RowData constraint
 */
export type EnsureRowData<T> = T extends RowData ? T : never;
