/**
 * Advanced Data Table Hook
 * Custom hook for managing advanced data table state and features
 * @module advanced-data-table/use-advanced-data-table
 */

'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

/**
 * Props for the useAdvancedDataTable hook
 * @template TData - The row data type
 */
export interface UseAdvancedDataTableProps<TData extends RowData> {
  /** Data array to display in the table */
  data: readonly TData[];

  /** Column definitions */
  columns: ColumnDef<TData, unknown>[];

  /** Total page count for server-side pagination (-1 for client-side) */
  pageCount?: number;

  /** Initial page size */
  initialPageSize?: number;

  /** Initial sorting state */
  initialSorting?: SortingState;

  /** Initial column visibility state */
  initialColumnVisibility?: VisibilityState;

  /** Enable row selection */
  enableRowSelection?: boolean;

  /** Enable multi-row selection */
  enableMultiRowSelection?: boolean;

  /** Enable column resizing */
  enableColumnResizing?: boolean;

  /** Enable global filtering */
  enableGlobalFilter?: boolean;

  /** Callback when pagination changes */
  onPaginationChange?: (pagination: PaginationState) => void;

  /** Callback when sorting changes */
  onSortingChange?: (sorting: SortingState) => void;

  /** Callback when column filters change */
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;

  /** Callback when row selection changes */
  onRowSelectionChange?: (selection: RowSelectionState) => void;

  /** Callback when global filter changes */
  onGlobalFilterChange?: (filter: string) => void;

  /** Optional reload callback exposed via table.options.meta.onReload */
  onReload?: () => void | Promise<void>;
}

/**
 * Advanced Data Table Hook
 * Manages table state and provides TanStack Table instance
 * @template TData - The row data type
 */
export function useAdvancedDataTable<TData extends RowData>({
  data,
  columns,
  pageCount = -1,
  initialPageSize = 10,
  initialSorting = [],
  initialColumnVisibility = {},
  enableRowSelection = true,
  enableMultiRowSelection = true,
  enableColumnResizing = true,
  enableGlobalFilter = true,
  onPaginationChange,
  onSortingChange,
  onColumnFiltersChange,
  onRowSelectionChange,
  onGlobalFilterChange,
  onReload,
}: UseAdvancedDataTableProps<TData>) {
  // State management
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);

  // Calculate actual page count from data (memoized to prevent recalculation)
  const calculatedPageCount = React.useMemo(() => {
    if (pageCount > 0) return pageCount;
    return Math.ceil(data.length / pagination.pageSize);
  }, [data.length, pagination.pageSize, pageCount]);

  // Store callback refs to prevent stale closures and unnecessary re-runs
  const onPaginationChangeRef = React.useRef(onPaginationChange);
  const onSortingChangeRef = React.useRef(onSortingChange);
  const onColumnFiltersChangeRef = React.useRef(onColumnFiltersChange);
  const onRowSelectionChangeRef = React.useRef(onRowSelectionChange);
  const onGlobalFilterChangeRef = React.useRef(onGlobalFilterChange);

  // Update refs when callbacks change (avoids stale closures)
  React.useEffect(() => {
    onPaginationChangeRef.current = onPaginationChange;
  }, [onPaginationChange]);

  React.useEffect(() => {
    onSortingChangeRef.current = onSortingChange;
  }, [onSortingChange]);

  React.useEffect(() => {
    onColumnFiltersChangeRef.current = onColumnFiltersChange;
  }, [onColumnFiltersChange]);

  React.useEffect(() => {
    onRowSelectionChangeRef.current = onRowSelectionChange;
  }, [onRowSelectionChange]);

  React.useEffect(() => {
    onGlobalFilterChangeRef.current = onGlobalFilterChange;
  }, [onGlobalFilterChange]);

  // Handle state changes with callbacks using refs to prevent stale closures
  React.useEffect(() => {
    onPaginationChangeRef.current?.(pagination);
  }, [pagination]);

  React.useEffect(() => {
    onSortingChangeRef.current?.(sorting);
  }, [sorting]);

  React.useEffect(() => {
    onColumnFiltersChangeRef.current?.(columnFilters);
  }, [columnFilters]);

  React.useEffect(() => {
    onRowSelectionChangeRef.current?.(rowSelection);
  }, [rowSelection]);

  React.useEffect(() => {
    onGlobalFilterChangeRef.current?.(globalFilter);
  }, [globalFilter]);

  // Create table instance - DON'T memoize the options object
  // TanStack Table handles internal optimization
  const table = useReactTable<TData>({
    data: data as TData[], // Type assertion for readonly -> mutable
    columns,
    pageCount: pageCount > 0 ? pageCount : calculatedPageCount,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter,
      columnOrder,
    },
    enableRowSelection,
    enableMultiRowSelection,
    enableColumnResizing,
    enableGlobalFilter,
    globalFilterFn: 'includesString' as const,
    columnResizeMode: 'onChange' as const,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: pageCount > 0,
    // Expose onReload in meta so consumers (toolbar) can call it
    meta: {
      onReload,
    },
  });

  // Return API - DON'T memoize, state needs to update on every render
  return {
    table,
    // Expose state for external use
    state: {
      rowSelection,
      columnVisibility,
      columnFilters,
      sorting,
      globalFilter,
      pagination,
      columnOrder,
    },
    // Expose setters for external control
    setRowSelection,
    setColumnVisibility,
    setColumnFilters,
    setSorting,
    setGlobalFilter,
    setPagination,
    setColumnOrder,
  };
}
