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
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { Button } from '@/components/ui/button';
import { Cross2Icon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import type { ExportFormat } from './types';
import type { Row } from '@tanstack/react-table';

interface AdvancedTableToolbarProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  enableGlobalSearch?: boolean;
  enableExport?: boolean;
  enableImport?: boolean;
  exportFormats?: ExportFormat[];
  onExport?: (format: ExportFormat, rows: Row<TData>[]) => void | Promise<void>;
  onImport?: (data: Record<string, any>[]) => void | Promise<void>;
  enableColumnReordering?: boolean;
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
  children,
  className,
  ...props
}: AdvancedTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table]
  );

  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
    table.setGlobalFilter('');
  }, [table]);

  return (
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
        </div>
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
          {children}
          <DataTableViewOptions table={table} />
        </div>
      </div>
    </div>
  );
}
