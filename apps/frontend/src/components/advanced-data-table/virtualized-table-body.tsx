/**
 * Advanced Data Table - Virtualized Table Body
 * Uses @tanstack/react-virtual for efficient rendering of large datasets
 */

'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { getCommonPinningStyles } from '@/lib/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Search } from 'lucide-react';

interface VirtualizedTableBodyProps<TData> {
  table: TanstackTable<TData>;
  enableVirtualization?: boolean;
  estimateSize?: number;
  overscan?: number;
  isLoading?: boolean;
}

export function VirtualizedTableBody<TData>({
  table,
  enableVirtualization = true,
  estimateSize = 50,
  overscan = 5,
  isLoading = false,
}: VirtualizedTableBodyProps<TData>) {
  const tableContainerRef = React.useRef<HTMLTableSectionElement>(null);

  // Get rows directly - table.getRowModel() returns filtered/sorted rows automatically
  // DO NOT memoize with [table] as dependency - it prevents updates when filters change
  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current?.parentElement || null,
    estimateSize: () => estimateSize,
    overscan: overscan,
    enabled: enableVirtualization && rows.length > 50,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0;

  if (isLoading) {
    return (
      <TableBody>
        {Array.from({ length: 10 }).map((_, index) => (
          <TableRow key={index}>
            {table.getAllColumns().map((column) => (
              <TableCell key={column.id}>
                <Skeleton className="h-6 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    );
  }

  if (!rows?.length) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={table.getAllColumns().length} className="h-64">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-muted p-4">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No data available</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {table.getState().columnFilters.length > 0 || table.getState().globalFilter
                    ? 'No results match your search criteria. Try adjusting your filters.'
                    : 'There are no items in this table yet. Get started by adding your first item.'}
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  // Regular rendering for small datasets
  if (!enableVirtualization || rows.length <= 50) {
    return (
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                style={{
                  ...getCommonPinningStyles({ column: cell.column }),
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    );
  }

  // Virtualized rendering for large datasets
  return (
    <TableBody ref={tableContainerRef}>
      {paddingTop > 0 && (
        <TableRow>
          <TableCell colSpan={table.getAllColumns().length} style={{ height: `${paddingTop}px` }} />
        </TableRow>
      )}
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        return (
          <TableRow
            key={row.id}
            data-state={row.getIsSelected() && 'selected'}
            data-index={virtualRow.index}
            ref={(node) => rowVirtualizer.measureElement(node)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                style={{
                  ...getCommonPinningStyles({ column: cell.column }),
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        );
      })}
      {paddingBottom > 0 && (
        <TableRow>
          <TableCell
            colSpan={table.getAllColumns().length}
            style={{ height: `${paddingBottom}px` }}
          />
        </TableRow>
      )}
    </TableBody>
  );
}
