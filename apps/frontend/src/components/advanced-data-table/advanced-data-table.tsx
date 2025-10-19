/**
 * Advanced Data Table - Main Component
 * Enterprise-grade data table with all advanced features
 */

'use client';

import * as React from 'react';
import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { AdvancedTableToolbar } from './advanced-table-toolbar';
import { VirtualizedTableBody } from './virtualized-table-body';
import { BulkActions } from './bulk-actions';
import { getCommonPinningStyles } from '@/lib/data-table';
import { cn } from '@/lib/utils';
import type { AdvancedDataTableProps } from './types';

export function AdvancedDataTable<TData, TValue>({
  table,
  data,
  totalItems,
  enableGlobalSearch = true,
  enableColumnSearch = true,
  enableExport = true,
  enableImport = true,
  enableBulkActions = true,
  enableVirtualization = true,
  enableRealtime = false,
  enableInlineEdit = false,
  enableColumnResizing = true,
  enableColumnReordering = true,
  enableColumnFreezing = true,
  exportFormats = ['csv', 'excel', 'json'],
  onExport,
  onImport,
  bulkActions,
  onRowCreate,
  onRowUpdate,
  onRowDelete,
  subscriptionKey,
  onSubscriptionUpdate,
  virtualScrollEstimateSize = 50,
  virtualScrollOverscan = 5,
  toolbar,
  actionBar,
  emptyState,
  loadingState,
  ariaLabel = 'Advanced data table',
  ariaDescription,
  onStateChange,
  onError,
  enableAdvancedFilter = true,
  className,
  containerClassName,
}: AdvancedDataTableProps<TData, TValue>) {
  const [isLoading, setIsLoading] = React.useState(false);

  // Handle real-time updates via tRPC subscription
  React.useEffect(() => {
    if (!enableRealtime || !subscriptionKey) return;

    // TODO: Implement tRPC subscription
    // const subscription = trpc.subscribeToUpdates.useSubscription(
    //   { key: subscriptionKey },
    //   {
    //     onData: (data) => {
    //       if (onSubscriptionUpdate) {
    //         onSubscriptionUpdate(data);
    //       }
    //     },
    //     onError: (error) => {
    //       if (onError) {
    //         onError(error);
    //       }
    //     },
    //   }
    // );

    // return () => subscription.unsubscribe();
  }, [enableRealtime, subscriptionKey, onSubscriptionUpdate, onError]);

  // Monitor table state changes
  React.useEffect(() => {
    if (!onStateChange) return;

    const state = {
      sorting: table.getState().sorting,
      columnFilters: table.getState().columnFilters,
      columnVisibility: table.getState().columnVisibility,
      rowSelection: table.getState().rowSelection,
      pagination: table.getState().pagination,
    };

    onStateChange(state);
  }, [table.getState(), onStateChange]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, ctrlKey, metaKey } = event;
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? metaKey : ctrlKey;

      // Ctrl/Cmd + A: Select all rows
      if (modKey && key === 'a') {
        event.preventDefault();
        table.toggleAllRowsSelected();
      }

      // Escape: Clear selection
      if (key === 'Escape') {
        table.resetRowSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [table]);

  return (
    <div
      className={cn('flex flex-1 flex-col space-y-4', containerClassName)}
      role="region"
      aria-label={ariaLabel}
      aria-description={ariaDescription}
    >
      {/* Toolbar */}
      {toolbar || (
        <AdvancedTableToolbar
          table={table}
          enableGlobalSearch={enableGlobalSearch}
          enableExport={enableExport}
          enableImport={enableImport}
          exportFormats={exportFormats}
          onExport={onExport}
          onImport={onImport ? (data) => onImport(data as any) : undefined}
          enableColumnReordering={enableColumnReordering}
        />
      )}

      {/* Bulk Actions */}
      {enableBulkActions && bulkActions && bulkActions.length > 0 && (
        <BulkActions table={table} actions={bulkActions} />
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
              <TableHeader className="bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
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
