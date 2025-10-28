/**
 * Advanced Data Table - Toolbar Component
 * Enhanced toolbar with global search, filters, export/import, and column management
 * @module advanced-data-table/advanced-table-toolbar
 */

'use client';

import * as React from 'react';
import type { Table, RowData, Row } from '@tanstack/react-table';
import { GlobalSearch } from './global-search';
import { ExportImportActions } from './export-import-actions';
import { ColumnManager } from './column-manager';
import { DataTableFacetedFilter } from '@/components/ui/table/data-table-faceted-filter';
import { Button } from '@/components/ui/button';
import { Cross2Icon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import type { ExportFormat, BulkAction } from './types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface AdvancedTableToolbarProps<TData extends RowData> extends React.ComponentProps<'div'> {
  /** Table instance */
  table: Table<TData>;

  /** Enable global search input */
  enableGlobalSearch?: boolean;

  /** Enable export functionality */
  enableExport?: boolean;

  /** Enable import functionality */
  enableImport?: boolean;

  /** Available export formats */
  exportFormats?: readonly ExportFormat[];

  /** Custom export handler */
  onExport?: (format: ExportFormat, rows: readonly Row<TData>[]) => void | Promise<void>;

  /** Custom import handler */
  onImport?: (data: readonly Record<string, unknown>[]) => void | Promise<void>;

  /** Enable column reordering */
  enableColumnReordering?: boolean;

  /** Bulk action definitions */
  bulkActions?: readonly BulkAction<TData>[];

  /** Primary action button (shown when no rows selected) */
  primaryAction?: React.ReactNode;

  /** Optional reload callback invoked when the user clicks the Reload button */
  onReload?: () => void | Promise<void>;
}

/**
 * Advanced Table Toolbar Component
 * Provides search, filtering, export/import, and bulk actions
 */
export function AdvancedTableToolbar<TData extends RowData>({
  table,
  enableGlobalSearch = true,
  enableExport = true,
  enableImport = true,
  exportFormats,
  onExport,
  onImport,
  enableColumnReordering = true,
  bulkActions = [],
  primaryAction,
  onReload,
  children,
  className,
  ...props
}: AdvancedTableToolbarProps<TData>) {
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [isReloading, setIsReloading] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<BulkAction<TData> | null>(null);

  // Track mounted state to avoid setState calls after unmount
  const isMountedRef = React.useRef(false);

  // Abort controller for canceling in-flight operations
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Cleanup abort controller on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Get filterable columns - table updates this automatically
  const filterableColumns = table.getAllColumns().filter((column) => column.getCanFilter());

  // Determine whether any filters are active
  const tableState = table.getState();
  const isFiltered =
    tableState.columnFilters.length > 0 ||
    Boolean(tableState.globalFilter && String(tableState.globalFilter).trim().length > 0);

  // Get selected rows
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const hasSelection = selectedCount > 0;

  // Reset all filters
  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
    table.setGlobalFilter('');
  }, [table]);

  // Execute bulk action with error handling
  const executeAction = React.useCallback(
    async (action: BulkAction<TData>) => {
      // Cancel any pending operations
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        setIsExecuting(true);

        // Check if action is disabled
        if (action.disabled) {
          const isDisabled =
            typeof action.disabled === 'function' ? action.disabled(selectedRows) : action.disabled;
          if (isDisabled) {
            toast.error(`Action "${action.label}" is currently disabled`);
            return;
          }
        }

        await action.action(selectedRows);

        // Only show success if not aborted
        if (!abortControllerRef.current?.signal.aborted && isMountedRef.current) {
          toast.success(`Successfully performed "${action.label}" on ${selectedCount} row(s)`);
          table.resetRowSelection();
        }
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted && isMountedRef.current) {
          console.error('[BulkAction]', error);
          toast.error(
            `Failed to perform action: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted && isMountedRef.current) {
          setIsExecuting(false);
          setPendingAction(null);
        }
      }
    },
    [selectedRows, selectedCount, table]
  );

  // Handle action click
  const handleActionClick = React.useCallback(
    (action: BulkAction<TData>) => {
      if (action.requiresConfirmation) {
        setPendingAction(action);
      } else {
        executeAction(action);
      }
    },
    [executeAction]
  );

  // Handle reload with error handling
  const handleReload = React.useCallback(async () => {
    if (isReloading || isExecuting) return;

    try {
      setIsReloading(true);

      if (onReload) {
        await onReload();
      } else {
        // Fallback: attempt to trigger reload handler on table meta
        const tableMeta = table.options.meta;
        if (tableMeta?.onReload) {
          await tableMeta.onReload();
        }
      }
    } catch (error) {
      console.error('[Reload]', error);
      if (isMountedRef.current) {
        toast.error(
          `Failed to reload: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsReloading(false);
      }
    }
  }, [isReloading, isExecuting, onReload, table.options.meta]);

  // Confirmation handlers
  const handleConfirm = React.useCallback(() => {
    if (pendingAction) {
      executeAction(pendingAction);
    }
  }, [pendingAction, executeAction]);

  const handleCancel = React.useCallback(() => {
    setPendingAction(null);
  }, []);

  // Fallback spin class name
  const spinClass = 'aria-toolbar-spin';

  return (
    <>
      {/* Inline fallback styles to guarantee spin animation works even if Tailwind classes are not present */}
      <style>{`
        /* Requested spin animation */
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Loading helper class */
        .loading { animation-name: spin; animation-duration: 1s; animation-iteration-count: infinite; animation-timing-function: linear; }

        /* Backwards-compatible aria-toolbar-spin */
        @keyframes aria-toolbar-spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .aria-toolbar-spin { animation: aria-toolbar-spin-anim 1s linear infinite; }
        /* Ensure SVGs rotate around their center */
        .aria-toolbar-spin svg, .aria-toolbar-spin > svg, .loading svg, .loading > svg { transform-box: fill-box; transform-origin: center; }
      `}</style>
      <div
        role="toolbar"
        aria-orientation="horizontal"
        aria-busy={isReloading || isExecuting}
        className={cn('flex w-full flex-col gap-4 p-1', className)}
        {...props}
      >
        {/* Top Row: Global Search and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2">
            {enableGlobalSearch && <GlobalSearch table={table} />}

            {/* Selection Info - Only show when rows are selected */}
            {/* {hasSelection && (
              <span className="text-sm font-medium text-muted-foreground ml-2">
                {selectedCount} row{selectedCount !== 1 ? 's' : ''} selected
              </span>
            )} */}
          </div>
          <div className="flex items-center gap-2">
            {/* Dynamic Primary Action / Bulk Actions Button */}
            {hasSelection && bulkActions.length > 0 ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.resetRowSelection()}
                  disabled={isExecuting || isReloading}
                >
                  Clear
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" disabled={isExecuting}>
                      {isExecuting || isReloading ? 'Processing...' : 'Actions'}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Bulk Operations</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {bulkActions.map((action, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => !isReloading && handleActionClick(action)}
                        disabled={isExecuting || isReloading}
                        className={cn(action.variant === 'destructive' && 'text-destructive')}
                      >
                        {action.icon && <span className="mr-2">{action.icon}</span>}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : // If reloading, render a disabled placeholder for primaryAction if it's a Button-like element
            isReloading && typeof primaryAction !== 'string' ? (
              <span aria-hidden className="opacity-50 pointer-events-none">
                {primaryAction}
              </span>
            ) : (
              primaryAction
            )}

            {/* Reload button - disables interactions while running */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReload}
                  disabled={isReloading || isExecuting}
                  aria-label={isReloading ? 'Reloading' : 'Reload'}
                  className={cn('p-2', isReloading && 'pointer-events-none')}
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isReloading ? `animate-spin ${spinClass} loading` : ''
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>{isReloading ? 'Reloading' : 'Reload'}</TooltipContent>
            </Tooltip>

            {enableExport && (
              <ExportImportActions
                table={table}
                exportFormats={exportFormats ? [...exportFormats] : undefined}
                onExport={onExport}
                onImport={onImport}
                enableImport={enableImport}
              />
            )}
            {/* ColumnManager may accept enableReordering only; we render it but disable pointer events while reloading */}
            <div className={cn(isReloading && 'pointer-events-none opacity-60')}>
              <ColumnManager table={table} enableReordering={enableColumnReordering} />
            </div>
          </div>
        </div>

        {/* Bottom Row: Column Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {filterableColumns.map((column) => {
              const columnMeta = column.columnDef.meta;
              if (!columnMeta?.variant) return null;

              if (columnMeta.variant === 'multiSelect' || columnMeta.variant === 'select') {
                return (
                  <DataTableFacetedFilter
                    key={column.id}
                    column={column}
                    title={columnMeta.label}
                    options={columnMeta.options || []}
                    multiple={columnMeta.variant === 'multiSelect'}
                  />
                );
              }

              return null;
            })}
            {isFiltered && (
              <Button
                aria-label="Reset filters"
                variant="outline"
                size="sm"
                className="border-dashed"
                onClick={onReset}
                disabled={isReloading || isExecuting}
              >
                <Cross2Icon />
                Reset
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">{children}</div>
        </div>
      </div>

      {/* Confirmation Dialog for Bulk Actions */}
      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.confirmationMessage ||
                `Are you sure you want to perform "${pendingAction?.label}" on ${selectedCount} selected row(s)? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
