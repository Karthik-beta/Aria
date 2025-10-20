/**
 * Advanced Data Table Types
 * Enterprise-grade type definitions for the advanced data table component
 */

import type { Row, RowData, Table } from '@tanstack/react-table';
import type { Option } from '@/types/data-table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    options?: Option[];
    range?: [number, number];
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
    exportable?: boolean;
    searchable?: boolean;
    resizable?: boolean;
    freezable?: boolean;
  }
}

export type FilterVariant =
  | 'text'
  | 'number'
  | 'range'
  | 'date'
  | 'dateRange'
  | 'boolean'
  | 'select'
  | 'multiSelect';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

export type BulkAction<TData> = {
  label: string;
  icon?: React.ReactNode;
  action: (rows: Row<TData>[]) => void | Promise<void>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
};

export interface AdvancedDataTableProps<TData, TValue> {
  // Core table configuration
  table: Table<TData>;

  // Data and columns
  data: TData[];
  totalItems?: number;

  // Features configuration
  enableGlobalSearch?: boolean;
  enableColumnSearch?: boolean;
  enableExport?: boolean;
  enableImport?: boolean;
  enableBulkActions?: boolean;
  enableVirtualization?: boolean;
  enableRealtime?: boolean;
  enableInlineEdit?: boolean;
  enableColumnResizing?: boolean;
  enableColumnReordering?: boolean;
  enableColumnFreezing?: boolean;

  // Export configuration
  exportFormats?: ExportFormat[];
  onExport?: (format: ExportFormat, rows: Row<TData>[]) => void | Promise<void>;

  // Import configuration
  onImport?: (file: File) => void | Promise<void>;

  // Bulk actions
  bulkActions?: BulkAction<TData>[];

  // CRUD operations
  onRowCreate?: () => void | Promise<void>;
  onRowUpdate?: (row: Row<TData>) => void | Promise<void>;
  onRowDelete?: (rows: Row<TData>[]) => void | Promise<void>;

  // Real-time updates via tRPC subscription
  subscriptionKey?: string;
  onSubscriptionUpdate?: (data: TData) => void;

  // Virtualization settings
  virtualScrollEstimateSize?: number;
  virtualScrollOverscan?: number;

  // UI customization
  toolbar?: React.ReactNode;
  primaryAction?: React.ReactNode; // Primary action button that converts to "Actions" when rows are selected
  actionBar?: React.ReactNode;
  emptyState?: React.ReactNode;
  loadingState?: React.ReactNode;

  // Accessibility
  ariaLabel?: string;
  ariaDescription?: string;

  // Callbacks
  onStateChange?: (state: TableState) => void;
  onError?: (error: Error) => void;

  // Advanced filtering
  enableAdvancedFilter?: boolean;

  // Styling
  className?: string;
  containerClassName?: string;
}

export interface TableState {
  sorting: any[];
  columnFilters: any[];
  columnVisibility: Record<string, boolean>;
  rowSelection: Record<string, boolean>;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
}

export interface ColumnResizeState {
  columnSizingInfo: {
    columnSizingStart: [string, number][];
    deltaOffset: number;
    deltaPercentage: number;
    isResizingColumn: string | false;
    startOffset: number;
    startSize: number;
  };
}

export interface VirtualItem {
  key: string;
  index: number;
  start: number;
  size: number;
  end: number;
}
