/**
 * Advanced Data Table - Main Export
 * Enterprise-grade reusable data table component for Aria ERP
 * 
 * Features:
 * - Advanced sorting and filtering (multi-column, Excel-style)
 * - Comprehensive global and column-specific search with autocomplete
 * - CRUD operations support (inline editing, modals)
 * - Data export (CSV, Excel, JSON, PDF) and import
 * - Bulk actions with confirmation dialogs
 * - Customizable columns (show/hide, reorder, resize, freeze)
 * - Pagination with configurable page sizes
 * - Virtual scrolling for large datasets (@tanstack/react-virtual)
 * - Asynchronous data loading with tRPC + TanStack Query
 * - Fixed headers and column pinning
 * - Clear state indication (loading, sorting, filters, selection)
 * - Row and column virtualization
 * - Fully responsive design
 * - Keyboard navigation and accessibility
 * - Real-time updates via tRPC subscriptions
 * 
 * @example
 * ```tsx
 * import { AdvancedDataTable, useAdvancedDataTable } from '@/components/advanced-data-table';
 * 
 * function MyTable() {
 *   const { table } = useAdvancedDataTable({
 *     data: myData,
 *     columns: myColumns,
 *     pageCount: totalPages,
 *   });
 * 
 *   return (
 *     <AdvancedDataTable
 *       table={table}
 *       data={myData}
 *       enableExport
 *       enableBulkActions
 *       bulkActions={[
 *         {
 *           label: 'Delete Selected',
 *           action: async (rows) => { ... },
 *           variant: 'destructive',
 *           requiresConfirmation: true,
 *         }
 *       ]}
 *     />
 *   );
 * }
 * ```
 */

export { AdvancedDataTable } from './advanced-data-table';
export { useAdvancedDataTable } from './use-advanced-data-table';
export { AdvancedTableToolbar } from './advanced-table-toolbar';
export { GlobalSearch } from './global-search';
export { ExportImportActions } from './export-import-actions';
export { BulkActions } from './bulk-actions';
export { ColumnManager } from './column-manager';
export { VirtualizedTableBody } from './virtualized-table-body';

export * from './types';
export * from './utils';
