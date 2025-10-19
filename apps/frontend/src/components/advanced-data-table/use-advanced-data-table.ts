/**
 * Advanced Data Table Hook
 * Custom hook for managing advanced data table state and features
 */

'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
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

export interface UseAdvancedDataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  pageCount?: number;
  initialPageSize?: number;
  initialSorting?: SortingState;
  initialColumnVisibility?: VisibilityState;
  enableRowSelection?: boolean;
  enableMultiRowSelection?: boolean;
  enableColumnResizing?: boolean;
  enableGlobalFilter?: boolean;
  onPaginationChange?: (pagination: PaginationState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  onGlobalFilterChange?: (filter: string) => void;
}

export function useAdvancedDataTable<TData>({
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
}: UseAdvancedDataTableProps<TData>) {
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

  // Calculate actual page count from data
  const calculatedPageCount = React.useMemo(() => {
    if (pageCount > 0) return pageCount;
    return Math.ceil(data.length / pagination.pageSize);
  }, [data.length, pagination.pageSize, pageCount]);

  // Handle state changes with callbacks
  React.useEffect(() => {
    if (onPaginationChange) {
      onPaginationChange(pagination);
    }
  }, [pagination, onPaginationChange]);

  React.useEffect(() => {
    if (onSortingChange) {
      onSortingChange(sorting);
    }
  }, [sorting, onSortingChange]);

  React.useEffect(() => {
    if (onColumnFiltersChange) {
      onColumnFiltersChange(columnFilters);
    }
  }, [columnFilters, onColumnFiltersChange]);

  React.useEffect(() => {
    if (onRowSelectionChange) {
      onRowSelectionChange(rowSelection);
    }
  }, [rowSelection, onRowSelectionChange]);

  React.useEffect(() => {
    if (onGlobalFilterChange) {
      onGlobalFilterChange(globalFilter);
    }
  }, [globalFilter, onGlobalFilterChange]);

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount > 0 ? pageCount : calculatedPageCount,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter,
    },
    enableRowSelection,
    enableMultiRowSelection,
    enableColumnResizing,
    enableGlobalFilter,
    columnResizeMode: 'onChange',
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: pageCount > 0,
  });

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
    },
    // Expose setters for external control
    setRowSelection,
    setColumnVisibility,
    setColumnFilters,
    setSorting,
    setGlobalFilter,
    setPagination,
  };
}
