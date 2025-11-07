/**
 * Inventory Items Catalogue - List Page
 * Enterprise-grade table with full CRUD operations using tRPC + Advanced Data Table
 *
 * Navigation Pattern: Uses Next.js Link components for navigation (no router.push memory leaks)
 * CRUD Pattern: Separate pages for create/edit (no modals), inline delete with confirmation
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AdvancedDataTable,
  useAdvancedDataTable,
  type BulkAction,
} from '@/components/advanced-data-table';
import { type ColumnDef, type Row } from '@tanstack/react-table';
import { type Inventory } from '@aria/types';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Edit,
  Trash,
  Eye,
  Plus,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertModal } from '@/components/modal/alert-modal';
import { cn } from '@/lib/utils';

// Stock status helper
const getStockStatus = (quantity: number) => {
  if (quantity === 0) {
    return { label: 'Out of Stock', variant: 'destructive' as const, icon: XCircle };
  }
  if (quantity < 10) {
    return { label: 'Low Stock', variant: 'secondary' as const, icon: AlertTriangle };
  }
  return { label: 'In Stock', variant: 'default' as const, icon: CheckCircle2 };
};

export default function InventoryItemsPage() {
  const utils = trpc.useUtils();

  // State for delete confirmation only
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);

  // Stable delete handler using ref pattern - prevents columns re-memoization
  const handleDeleteRef = React.useRef<(id: string) => void>(() => {
    setItemToDelete(id);
    setIsDeleteDialogOpen(true);
  });

  // Wrapped in useCallback for external use
  const handleDelete = React.useCallback((id: string) => {
    handleDeleteRef.current?.(id);
  }, []);

  // Fetch all inventory items with optimized settings
  const {
    data: rawItems = [],
    isLoading,
    error: queryError,
  } = trpc.inventory.listItems.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: Infinity, // Official TanStack Query pattern: never stale since WebSocket updates cache
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes (formerly cacheTime)
  });

  // Transform dates from strings to Date objects - Memoized for performance
  const items = React.useMemo(
    () =>
      rawItems.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })),
    [rawItems]
  );

  // Real-time subscription for CRUD events
  // Following official React pattern: use cleanup flag to prevent state updates after unmount
  // https://react.dev/learn/synchronizing-with-effects#fetching-data
  const errorCountRef = React.useRef(0);
  const lastErrorTimeRef = React.useRef(0);
  const [subscriptionEnabled, setSubscriptionEnabled] = React.useState(false);

  // Mounted ref to track component lifecycle - official React pattern for cleanup
  // Initialize as false during render, set to true after mount to prevent premature callbacks
  const isMountedRef = React.useRef(false);

  React.useEffect(() => {
    // Mark component as mounted and enable subscription
    isMountedRef.current = true;
    setSubscriptionEnabled(true);

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Memoize callbacks with mounted check to prevent state updates after unmount
  const handleSubscriptionData = React.useCallback(
    (event: { type: 'created' | 'updated' | 'deleted'; data: Inventory.Item | { id: string } }) => {
      // Guard: only update state if component is still mounted
      if (!isMountedRef.current) return;

      // Invalidate and refetch the list when any CRUD operation occurs
      void utils.inventory.listItems.invalidate();

      // Show appropriate toast notification
      if (event.type === 'created') {
        toast.success('New item added to inventory');
      } else if (event.type === 'updated') {
        toast.info('Item updated');
      } else if (event.type === 'deleted') {
        toast.info('Item removed from inventory');
      }
    },
    [utils]
  );

  const handleSubscriptionError = React.useCallback((_error: unknown) => {
    // Guard: only update state if component is still mounted
    if (!isMountedRef.current) return;

    errorCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastError = now - lastErrorTimeRef.current;
    lastErrorTimeRef.current = now;

    // Only show error toast for persistent connection issues (3+ consecutive failures within 5 seconds)
    if (errorCountRef.current >= 3 && timeSinceLastError < 5000) {
      toast.error('Real-time updates temporarily unavailable');
    }
  }, []);

  const handleSubscriptionStarted = React.useCallback(() => {
    // Guard: only update state if component is still mounted
    if (!isMountedRef.current) return;

    errorCountRef.current = 0; // Reset error count on successful connection
  }, []);

  trpc.inventory.onItemsChanged.useSubscription(undefined, {
    enabled: subscriptionEnabled, // Only enable after mount
    onStarted: handleSubscriptionStarted,
    onData: handleSubscriptionData,
    onError: handleSubscriptionError,
  });

  // Show error state if query fails
  // Guard against state updates after unmount
  React.useEffect(() => {
    if (queryError && isMountedRef.current) {
      toast.error(`Failed to load inventory items: ${queryError.message}`);
    }
  }, [queryError]);

  // Delete mutation with optimistic updates
  // Following official TanStack Query pattern: callbacks in useMutation always run
  // Use isMountedRef guard to prevent state updates after unmount
  // https://tanstack.com/query/v5/docs/framework/react/guides/mutations
  const deleteMutation = trpc.inventory.deleteItem.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await utils.inventory.listItems.cancel();

      // Snapshot the previous value
      const previousItems = utils.inventory.listItems.getData();

      // Optimistically update the cache
      utils.inventory.listItems.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((item) => item.id !== variables.id);
      });

      // Return context with snapshot for rollback
      return { previousItems };
    },
    onSuccess: () => {
      // Guard: only update state if component is still mounted
      if (!isMountedRef.current) return;

      toast.success('Item deleted successfully');
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error, variables, context) => {
      // Guard: only update state if component is still mounted
      if (!isMountedRef.current) return;

      // Rollback on error
      if (context?.previousItems) {
        utils.inventory.listItems.setData(undefined, context.previousItems);
      }
      toast.error(`Failed to delete item: ${error.message}`);
    },
    onSettled: () => {
      // Always refetch after mutation to ensure data consistency
      // Note: invalidate is safe to call even if unmounted (doesn't trigger UI updates)
      utils.inventory.listItems.invalidate();
    },
  });

  // Bulk delete mutation with optimistic updates
  // Following official TanStack Query pattern with mounted guard
  const bulkDeleteMutation = trpc.inventory.deleteItem.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.inventory.listItems.cancel();

      // Snapshot the previous value
      const previousItems = utils.inventory.listItems.getData();

      // Optimistically remove item
      utils.inventory.listItems.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((item) => item.id !== variables.id);
      });

      return { previousItems };
    },
    onError: (error, variables, context) => {
      // Guard: only update state if component is still mounted
      if (!isMountedRef.current) return;

      // Rollback on error
      if (context?.previousItems) {
        utils.inventory.listItems.setData(undefined, context.previousItems);
      }
    },
    onSettled: () => {
      // Always refetch after mutation to ensure data consistency
      utils.inventory.listItems.invalidate();
    },
  });

  // Confirm delete callback
  const confirmDelete = React.useCallback(() => {
    if (itemToDelete) {
      deleteMutation.mutate({ id: itemToDelete });
    }
  }, [itemToDelete, deleteMutation]);

  // Column definitions - Completely stable, no external dependencies
  // According to TanStack Table docs: columns should be wrapped in useMemo with empty deps
  const columns = React.useMemo<ColumnDef<Inventory.Item>[]>(
    () => [
      // Selection column - uses table instance passed via context by TanStack Table
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() ? 'indeterminate' : false)
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all rows on this page"
            className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        size: 40, // Fixed width for checkbox column
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        enableColumnFilter: false,
        enableGlobalFilter: false,
      },

      // Name column
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Item Name" />,
        cell: ({ row }) => (
          <Link
            href={`/inventory/items-catalogue/item/${row.original.id}`}
            className="flex items-center gap-2 hover:underline"
          >
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.getValue('name')}</span>
          </Link>
        ),
        meta: {
          label: 'Item Name',
          placeholder: 'Search items...',
          variant: 'text',
          searchable: true,
          exportable: true,
        },
        enableSorting: true,
        enableColumnFilter: true,
        enableGlobalFilter: true,
      },

      // SKU column
      {
        accessorKey: 'sku',
        header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
        cell: ({ row }) => (
          <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
            {row.getValue('sku')}
          </code>
        ),
        meta: {
          label: 'SKU',
          placeholder: 'Search by SKU...',
          variant: 'text',
          searchable: true,
          exportable: true,
        },
        enableSorting: true,
        enableColumnFilter: true,
        enableGlobalFilter: true,
      },

      // Quantity column
      {
        accessorKey: 'quantity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Quantity" />,
        cell: ({ row }) => {
          const quantity = row.getValue('quantity') as number;

          return (
            <div className="flex items-center gap-2">
              <span className="font-medium tabular-nums">{quantity}</span>
              <span className="text-muted-foreground">units</span>
            </div>
          );
        },
        meta: {
          label: 'Quantity',
          variant: 'number',
          exportable: true,
        },
        enableSorting: true,
      },

      // Stock Status column (computed)
      {
        id: 'status',
        accessorFn: (row) => getStockStatus(row.quantity).label,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Stock Status" />,
        cell: ({ row }) => {
          const quantity = row.original.quantity;
          const status = getStockStatus(quantity);
          const Icon = status.icon;

          return (
            <Badge variant={status.variant} className="capitalize">
              <Icon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
          );
        },
        meta: {
          label: 'Stock Status',
          variant: 'multiSelect',
          options: [
            { label: 'In Stock', value: 'In Stock', icon: CheckCircle2 },
            { label: 'Low Stock', value: 'Low Stock', icon: AlertTriangle },
            { label: 'Out of Stock', value: 'Out of Stock', icon: XCircle },
          ],
          exportable: true,
        },
        enableColumnFilter: true,
        filterFn: (row, id, value) => {
          const status = getStockStatus(row.original.quantity).label;
          return value.includes(status);
        },
      },

      // Created At column
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
        cell: ({ row }) => {
          const date = new Date(row.getValue('createdAt'));
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          );
        },
        meta: {
          label: 'Created Date',
          variant: 'date',
          exportable: true,
        },
        enableSorting: true,
      },

      // Updated At column
      {
        accessorKey: 'updatedAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Last Updated" />,
        cell: ({ row }) => {
          const date = new Date(row.getValue('updatedAt'));
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          );
        },
        meta: {
          label: 'Updated Date',
          variant: 'date',
          exportable: true,
        },
        enableSorting: true,
      },

      // Actions column
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const item = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/inventory/items-catalogue/item/${item.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/inventory/items-catalogue/item/form?id=${item.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Item
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDelete(item.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        enableColumnFilter: false,
        enableGlobalFilter: false,
      },
    ],
    [handleDelete] // Include handleDelete to satisfy react-hooks/exhaustive-deps
  );

  // Bulk delete handler - Memoized separately to prevent recreating bulk actions
  const handleBulkDelete = React.useCallback(
    async (rows: readonly Row<Inventory.Item>[]) => {
      const ids = rows.map((r) => r.original.id);

      try {
        // Delete items sequentially
        for (const id of ids) {
          await bulkDeleteMutation.mutateAsync({ id });
        }

        // Guard: only show toast if component is still mounted
        if (isMountedRef.current) {
          toast.success(`Successfully deleted ${ids.length} item(s)`);
        }

        // Invalidate to refresh the list
        await utils.inventory.listItems.invalidate();
      } catch {
        // Guard: only show toast if component is still mounted
        if (isMountedRef.current) {
          toast.error('Failed to delete some items');
        }
      }
    },
    [bulkDeleteMutation, utils]
  );

  // Bulk actions - Memoized with stable handler reference
  const bulkActions = React.useMemo<BulkAction<Inventory.Item>[]>(
    () => [
      {
        label: 'Delete Selected',
        icon: <Trash className="h-4 w-4" />,
        action: handleBulkDelete,
        variant: 'destructive',
        requiresConfirmation: true,
        confirmationMessage:
          'This will permanently delete the selected inventory items. This action cannot be undone.',
      },
    ],
    [handleBulkDelete]
  );

  // Reload handler - Memoized to prevent table re-initialization
  const handleReload = React.useCallback(async () => {
    // Trigger a network refetch of the items
    await utils.inventory.listItems.refetch();
  }, [utils]);

  // Table setup - Memoized to prevent unnecessary re-initialization
  const { table } = useAdvancedDataTable({
    data: items,
    columns,
    initialPageSize: 25,
    initialSorting: [{ id: 'createdAt', desc: true }], // Sort by newest first
    enableRowSelection: true,
    enableMultiRowSelection: true,
    enableGlobalFilter: true,
    onReload: handleReload,
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
            <p className="text-muted-foreground">
              Manage your inventory items with advanced filtering, sorting, and bulk operations
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading inventory items...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {queryError && !isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold">Failed to load inventory items</h3>
              <p className="text-sm text-muted-foreground">{queryError.message}</p>
            </div>
            <Button onClick={() => utils.inventory.listItems.refetch()}>Try Again</Button>
          </div>
        </div>
      )}

      {/* Advanced Data Table - Only render when data is loaded */}
      {!isLoading && !queryError && (
        <AdvancedDataTable
          table={table}
          data={items}
          enableGlobalSearch
          enableExport
          enableImport={false}
          enableBulkActions
          enableVirtualization
          enableColumnResizing
          enableColumnReordering
          exportFormats={['csv', 'excel', 'json', 'pdf']}
          bulkActions={bulkActions}
          primaryAction={
            <Link
              href="/inventory/items-catalogue/item/form"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Link>
          }
          ariaLabel="Inventory items table"
          ariaDescription="A table of all inventory items with advanced filtering, sorting, and bulk actions"
        />
      )}

      {/* Delete Confirmation */}
      <AlertModal
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
