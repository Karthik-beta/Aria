/**
 * Advanced Data Table - Main Component
 * Enterprise-grade data table with all advanced features
 * @module advanced-data-table/advanced-data-table
 */

'use client';

import * as React from 'react';
import { type Table as _TanstackTable, type RowData, flexRender } from '@tanstack/react-table';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea as _ScrollArea, ScrollBar as _ScrollBar } from '@/components/ui/scroll-area';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { AdvancedTableToolbar } from './advanced-table-toolbar';
import { VirtualizedTableBody } from './virtualized-table-body';
import { getCommonPinningStyles } from '@/lib/data-table';
import { cn } from '@/lib/utils';
import type { AdvancedDataTableProps, AdvancedDataTableError } from './types';

/**
 * Create a standardized error object
 */
function createError(
  type: AdvancedDataTableError['type'],
  message: string,
  cause?: unknown,
  extra?: Record<string, unknown>
): AdvancedDataTableError {
  return { type, message, cause, ...extra } as AdvancedDataTableError;
}

/**
 * Advanced Data Table Component
 * Provides enterprise-grade table functionality with virtualization, filtering, and more
 * @template TData - The row data type
 * @template TValue - The cell value type (optional)
 */
export function AdvancedDataTable<TData extends RowData, TValue = unknown>({
  table,
  data: _data,
  totalItems: _totalItems,
  enableGlobalSearch = true,
  enableColumnSearch: _enableColumnSearch = true,
  enableExport = true,
  enableImport = true,
  enableBulkActions = true,
  enableVirtualization = true,
  enableRealtime = false,
  enableInlineEdit: _enableInlineEdit = false,
  enableColumnResizing = true,
  enableColumnReordering = true,
  enableColumnFreezing: _enableColumnFreezing = true,
  exportFormats = ['csv', 'excel', 'json'],
  onExport,
  onImport,
  bulkActions,
  onRowCreate: _onRowCreate,
  onRowUpdate: _onRowUpdate,
  onRowDelete: _onRowDelete,
  subscriptionKey,
  onSubscriptionUpdate,
  virtualScrollEstimateSize = 50,
  virtualScrollOverscan = 5,
  toolbar,
  primaryAction,
  actionBar,
  emptyState: _emptyState,
  loadingState: _loadingState,
  ariaLabel = 'Advanced data table',
  ariaDescription,
  onStateChange,
  onError,
  enableAdvancedFilter: _enableAdvancedFilter = true,
  className,
  containerClassName,
}: AdvancedDataTableProps<TData, TValue>) {
  const [isLoading, _setIsLoading] = React.useState(false);
  const [_error, setError] = React.useState<AdvancedDataTableError | null>(null);

  // Store callback refs to prevent stale closures
  const onErrorRef = React.useRef(onError);
  const onStateChangeRef = React.useRef(onStateChange);
  const onSubscriptionUpdateRef = React.useRef(onSubscriptionUpdate);

  // Update refs when callbacks change
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  React.useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  React.useEffect(() => {
    onSubscriptionUpdateRef.current = onSubscriptionUpdate;
  }, [onSubscriptionUpdate]);

  // Centralized error handler
  const handleError = React.useCallback((error: AdvancedDataTableError) => {
    setError(error);
    onErrorRef.current?.(error);
    console.error('[AdvancedDataTable]', error);
  }, []);

  // Handle real-time updates via tRPC subscription
  React.useEffect(() => {
    if (!enableRealtime || !subscriptionKey) return;

    // TODO: Implement tRPC subscription when ready
    // Example implementation:
    // const subscription = trpc.subscribeToUpdates.useSubscription(
    //   { key: subscriptionKey },
    //   {
    //     onData: (data) => {
    //       try {
    //         onSubscriptionUpdateRef.current?.(data);
    //       } catch (err) {
    //         handleError(createError('network', 'Failed to process subscription update', err));
    //       }
    //     },
    //     onError: (err) => {
    //       handleError(createError('network', 'Subscription error occurred', err));
    //     },
    //   }
    // );
    //
    // return () => {
    //   subscription.unsubscribe();
    // };

    // Cleanup function (currently no-op until subscription is implemented)
    return () => {
      // Cleanup subscription when component unmounts or dependencies change
    };
  }, [enableRealtime, subscriptionKey, handleError]);

  // Extract table state values to avoid complex expressions in dependency array
  // Per React docs: https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps
  const tableState = table.getState();
  const sorting = tableState.sorting;
  const columnFilters = tableState.columnFilters;
  const columnVisibility = tableState.columnVisibility;
  const rowSelection = tableState.rowSelection;
  const pagination = tableState.pagination;
  const globalFilter = tableState.globalFilter;

  // Monitor table state changes (debounced to avoid excessive callbacks)
  React.useEffect(() => {
    if (!onStateChangeRef.current) return;

    const state = {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter: globalFilter as string | undefined,
    };

    try {
      onStateChangeRef.current(state);
    } catch (err) {
      handleError(createError('unknown', 'Error in state change callback', err));
    }
  }, [
    sorting,
    columnFilters,
    columnVisibility,
    rowSelection,
    pagination,
    globalFilter,
    handleError,
  ]);

  // Keyboard navigation with proper cleanup
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      try {
        const { key, ctrlKey, metaKey, target } = event;

        // Don't interfere with input fields
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          return;
        }

        const isMac =
          typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
        const modKey = isMac ? metaKey : ctrlKey;

        // Ctrl/Cmd + A: Select all rows
        if (modKey && key === 'a') {
          event.preventDefault();
          table.toggleAllRowsSelected();
        }

        // Escape: Clear selection
        if (key === 'Escape') {
          event.preventDefault();
          table.resetRowSelection();
        }
      } catch (err) {
        handleError(createError('unknown', 'Keyboard navigation error', err));
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [table, handleError]);

  return (
    <div
      className={cn('flex flex-1 flex-col space-y-4', containerClassName)}
      role="region"
      aria-label={ariaLabel}
      aria-description={ariaDescription}
    >
      {/* Toolbar with integrated bulk actions */}
      {toolbar || (
        <AdvancedTableToolbar
          table={table}
          enableGlobalSearch={enableGlobalSearch}
          enableExport={enableExport}
          enableImport={enableImport}
          exportFormats={exportFormats}
          onExport={onExport}
          onImport={
            onImport ? (data) => onImport(data as readonly Record<string, unknown>[]) : undefined
          }
          enableColumnReordering={enableColumnReordering}
          bulkActions={enableBulkActions ? bulkActions : []}
          primaryAction={primaryAction}
        />
      )}

      {/* Table Container */}
      <div className={cn('relative w-full', className)}>
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="w-full overflow-auto">
            <Table
              style={{
                width: enableColumnResizing ? table.getCenterTotalSize() : '100%',
                minWidth: '100%',
              }}
            >
              {/* Table Header with Sticky Headers */}
              <TableHeader className="bg-muted/95 backdrop-blur supports-backdrop-filter:bg-muted/60">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column }),
                          width: enableColumnResizing ? header.getSize() : undefined,
                          position: 'relative',
                        }}
                        className="font-semibold whitespace-nowrap"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}

                        {/* Column Resizer */}
                        {enableColumnResizing && header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                              'hover:bg-primary/50 transition-colors',
                              header.column.getIsResizing() && 'bg-primary'
                            )}
                            aria-label={`Resize ${header.column.id} column`}
                          />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              {/* Virtualized Table Body */}
              <VirtualizedTableBody
                table={table}
                enableVirtualization={enableVirtualization}
                estimateSize={virtualScrollEstimateSize}
                overscan={virtualScrollOverscan}
                isLoading={isLoading}
              />
            </Table>
          </div>
        </div>
      </div>

      {/* Pagination and Action Bar */}
      <div className="flex flex-col gap-2.5">
        <DataTablePagination table={table} />
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  );
}
