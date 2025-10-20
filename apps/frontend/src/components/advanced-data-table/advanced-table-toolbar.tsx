/**
 * Advanced Data Table - Toolbar Component
 * Enhanced toolbar with global search, filters, export/import, and column management
 */

'use client';

import * as React from 'react';
import type { Table } from '@tanstack/react-table';
import { GlobalSearch } from './global-search';
import { ExportImportActions } from './export-import-actions';
import { ColumnManager } from './column-manager';
import { DataTableFacetedFilter } from '@/components/ui/table/data-table-faceted-filter';
import { Button } from '@/components/ui/button';
import { Cross2Icon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import type { ExportFormat, BulkAction } from './types';
import type { Row } from '@tanstack/react-table';
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
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface AdvancedTableToolbarProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  enableGlobalSearch?: boolean;
  enableExport?: boolean;
  enableImport?: boolean;
  exportFormats?: ExportFormat[];
  onExport?: (format: ExportFormat, rows: Row<TData>[]) => void | Promise<void>;
  onImport?: (data: Record<string, any>[]) => void | Promise<void>;
  enableColumnReordering?: boolean;
  bulkActions?: BulkAction<TData>[];
  primaryAction?: React.ReactNode;
}

export function AdvancedTableToolbar<TData>({
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
  children,
  className,
  ...props
}: AdvancedTableToolbarProps<TData>) {
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<BulkAction<TData> | null>(null);

  // Memoize state access to prevent render issues
  const isFiltered = React.useMemo(() => table.getState().columnFilters.length > 0, [table]);

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table]
  );

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const hasSelection = selectedCount > 0;

  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
    table.setGlobalFilter('');
  }, [table]);

  const handleActionClick = (action: BulkAction<TData>) => {
    if (action.requiresConfirmation) {
      setPendingAction(action);
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (action: BulkAction<TData>) => {
    try {
      setIsExecuting(true);
      await action.action(selectedRows);
      toast.success(`Successfully performed "${action.label}" on ${selectedCount} row(s)`);
      table.resetRowSelection();
    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error(
        `Failed to perform action: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsExecuting(false);
      setPendingAction(null);
    }
  };

  const handleConfirm = () => {
    if (pendingAction) {
      executeAction(pendingAction);
    }
  };

  const handleCancel = () => {
    setPendingAction(null);
  };

  return (
    <>
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className={cn('flex w-full flex-col gap-4 p-1', className)}
        {...props}
      >
        {/* Top Row: Global Search and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2">
            {enableGlobalSearch && <GlobalSearch table={table} />}

            {/* Selection Info - Only show when rows are selected */}
            {hasSelection && (
              <span className="text-sm font-medium text-muted-foreground ml-2">
                {selectedCount} row{selectedCount !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Dynamic Primary Action / Bulk Actions Button */}
            {hasSelection && bulkActions.length > 0 ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" disabled={isExecuting}>
                      {isExecuting ? 'Processing...' : 'Actions'}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Bulk Operations</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {bulkActions.map((action, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => handleActionClick(action)}
                        disabled={isExecuting}
                        className={cn(action.variant === 'destructive' && 'text-destructive')}
                      >
                        {action.icon && <span className="mr-2">{action.icon}</span>}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.resetRowSelection()}
                  disabled={isExecuting}
                >
                  Clear
                </Button>
              </>
            ) : (
              primaryAction
            )}

            {enableExport && (
              <ExportImportActions
                table={table}
                exportFormats={exportFormats}
                onExport={onExport}
                onImport={onImport}
                enableImport={enableImport}
              />
            )}
            <ColumnManager table={table} enableReordering={enableColumnReordering} />
          </div>
        </div>

        {/* Bottom Row: Column Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {columns.map((column) => {
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
