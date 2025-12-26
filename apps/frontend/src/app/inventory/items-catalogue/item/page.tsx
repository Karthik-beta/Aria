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

  CheckCircle2,
  XCircle,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertModal } from '@/components/modal/alert-modal';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/ui/error-display';
import { getToastMessage } from '@/lib/errors';

type InventorySubscriptionEvent = {
  type: 'created' | 'updated' | 'deleted';
  data: Inventory.Item | { id: string };
};

function InventoryRealtimeSubscription({
  onStarted,
  onData,
  onError,
}: {
  onStarted?: () => void;
  onData?: (event: InventorySubscriptionEvent) => void;
  onError?: (err: unknown) => void;
}) {
  trpc.inventory.onItemsChanged.useSubscription(undefined, {
    onStarted,
    onData,
    onError,
  });

  return null;
}



export default function InventoryItemsPage() {
  const utils = trpc.useUtils();

  // State for delete confirmation only
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);
  const [isRealtimeReady, setIsRealtimeReady] = React.useState(false);

  React.useEffect(() => {
    setIsRealtimeReady(true);
    return () => {
      setIsRealtimeReady(false);
    };
  }, []);

  // Stable delete handler using ref pattern - prevents columns re-memoization
  const handleDeleteRef = React.useRef<(id: string) => void>(() => {
    // Initial no-op function
  });
  handleDeleteRef.current = (id: string) => {
    setItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  // Wrapped in useCallback for external use
  const handleDelete = React.useCallback((id: string) => {
    handleDeleteRef.current?.(id);
  }, []);

  // Fetch all inventory items with optimized settings
  // Following official TanStack Query v5 patterns to prevent state updates during mount
  const {
    data: rawItems = [],
    isLoading,
    error: queryError,
  } = trpc.inventory.listItems.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Official TanStack Query v5 pattern: prevent refetch on mount
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: Infinity, // Official pattern: never stale since WebSocket updates cache
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
  // Following official tRPC patterns: use subscription callbacks directly
  // https://trpc.io/docs/client/react/useSubscription
  const errorCountRef = React.useRef(0);
  const lastErrorTimeRef = React.useRef(0);

  // Callback to handle subscription data
  // Following official tRPC pattern: no manual mount checks needed with React 18+
  const handleSubscriptionData = React.useCallback(
    (event: InventorySubscriptionEvent) => {
      // Official pattern: Invalidate cache to trigger re-render
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
    errorCountRef.current = 0; // Reset error count on successful connection
  }, []);

  // Official tRPC pattern: subscription runs independently
  // No need to manually enable/disable based on mount state
  const shouldSubscribe = isRealtimeReady;

  // Show error toast if query fails (only once per error)
  // Following official TanStack Query pattern: no manual mount checks needed
  const prevQueryErrorRef = React.useRef<unknown>(null);
  React.useEffect(() => {
    if (queryError && queryError !== prevQueryErrorRef.current) {
      prevQueryErrorRef.current = queryError;
      toast.error(getToastMessage(queryError, 'load'));
    }
  }, [queryError]);

  // Delete mutation with optimistic updates
  // Following official TanStack Query v5 pattern
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
      toast.success('Item deleted successfully');
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousItems) {
        utils.inventory.listItems.setData(undefined, context.previousItems);
      }
      toast.error(getToastMessage(error, 'delete'));
    },
    onSettled: () => {
      // Always refetch after mutation to ensure data consistency
      // Note: invalidate is safe to call even if unmounted (doesn't trigger UI updates)
      utils.inventory.listItems.invalidate();
    },
  });

  // Bulk delete mutation with optimistic updates
  // Following official TanStack Query v5 pattern
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

  // Helper function to get relative time display (1y, 2y, etc.)
  const getRelativeAge = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears >= 1) {
      return `${diffYears}y`;
    } else if (diffMonths >= 1) {
      return `${diffMonths}m`;
    } else if (diffDays >= 1) {
      return `${diffDays}d`;
    } else {
      return 'Today';
    }
  };

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
            className="font-medium text-primary hover:underline"
          >
            {row.getValue('name')}
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

      // Status column (Enabled/Template based on disabled field)
      {
        id: 'status',
        accessorFn: (row) => (row.disabled ? 'Disabled' : row.hasVariants ? 'Template' : 'Enabled'),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const disabled = row.original.disabled;
          const hasVariants = row.original.hasVariants;

          if (disabled) {
            return (
              <span className="text-muted-foreground text-sm">Disabled</span>
            );
          }

          if (hasVariants) {
            return (
              <span className="text-amber-600 text-sm font-medium">Template</span>
            );
          }

          return (
            <span className="text-primary text-sm font-medium">Enabled</span>
          );
        },
        meta: {
          label: 'Status',
          variant: 'multiSelect',
          options: [
            { label: 'Enabled', value: 'Enabled', icon: CheckCircle2 },
            { label: 'Template', value: 'Template', icon: Package },
            { label: 'Disabled', value: 'Disabled', icon: XCircle },
          ],
          exportable: true,
        },
        enableColumnFilter: true,
        filterFn: (row, id, value) => {
          const status = row.original.disabled
            ? 'Disabled'
            : row.original.hasVariants
              ? 'Template'
              : 'Enabled';
          return value.includes(status);
        },
      },

      // Item Group column
      {
        accessorKey: 'itemGroupName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Item Group" />,
        cell: ({ row }) => {
          const groupName = row.original.itemGroupName;
          return (
            <span className="text-sm text-muted-foreground">
              {groupName || '-'}
            </span>
          );
        },
        meta: {
          label: 'Item Group',
          placeholder: 'Search by group...',
          variant: 'text',
          searchable: true,
          exportable: true,
        },
        enableSorting: true,
        enableColumnFilter: true,
        enableGlobalFilter: true,
      },

      // Item Code column
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Item Code" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.getValue('code')}
          </span>
        ),
        meta: {
          label: 'Item Code',
          placeholder: 'Search by code...',
          variant: 'text',
          searchable: true,
          exportable: true,
        },
        enableSorting: true,
        enableColumnFilter: true,
        enableGlobalFilter: true,
      },

      // ID column
      {
        accessorKey: 'id',
        header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.getValue('id')}
          </span>
        ),
        meta: {
          label: 'ID',
          placeholder: 'Search by ID...',
          variant: 'text',
          searchable: true,
          exportable: true,
        },
        enableSorting: true,
        enableColumnFilter: true,
        enableGlobalFilter: true,
      },

      // Age column (relative time since creation)
      {
        id: 'age',
        accessorFn: (row) => row.createdAt,
        header: () => <span className="text-muted-foreground"></span>,
        cell: ({ row }) => {
          const createdAt = new Date(row.original.createdAt);
          return (
            <span className="text-sm text-muted-foreground">
              {getRelativeAge(createdAt)}
            </span>
          );
        },
        meta: {
          label: 'Age',
          variant: 'date',
          exportable: true,
        },
        enableSorting: true,
        size: 50,
      },

      // Count column (placeholder for comments/count)
      {
        id: 'counts',
        header: () => (
          <div className="text-right text-muted-foreground text-sm">
            {items.length} of {items.length}
          </div>
        ),
        cell: () => (
          <div className="flex items-center justify-end gap-2 text-muted-foreground text-sm">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              0
            </span>
            <span>·</span>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        size: 80,
      },

      // Actions column
      {
        id: 'actions',
        header: '',
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
    [handleDelete, items.length] // Include handleDelete to satisfy react-hooks/exhaustive-deps
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

        toast.success(`Successfully deleted ${ids.length} item(s)`);

        // Invalidate to refresh the list
        await utils.inventory.listItems.invalidate();
      } catch {
        toast.error('Failed to delete some items');
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
    <>
      {shouldSubscribe && (
        <InventoryRealtimeSubscription
          onStarted={handleSubscriptionStarted}
          onData={handleSubscriptionData}
          onError={handleSubscriptionError}
        />
      )}

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

        {/* Error State - Shows user-friendly error message */}
        {queryError && !isLoading && (
          <ErrorState
            error={queryError}
            operation="load"
            title="Failed to load inventory items"
            onRetry={() => utils.inventory.listItems.refetch()}
          />
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
    </>
  );
}
