/**
 * Advanced Data Table - Bulk Actions Component
 * Provides bulk operations on selected rows
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
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
import type { Table } from '@tanstack/react-table';
import type { BulkAction } from './types';
import { toast } from 'sonner';

interface BulkActionsProps<TData> {
  table: Table<TData>;
  actions: BulkAction<TData>[];
}

export function BulkActions<TData>({ table, actions }: BulkActionsProps<TData>) {
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<BulkAction<TData> | null>(null);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

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
      toast.error(`Failed to perform action: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {selectedCount} row(s) selected
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExecuting}>
              {isExecuting ? 'Processing...' : 'Bulk Actions'}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Bulk Operations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {actions.map((action, index) => (
              <DropdownMenuItem
                key={index}
                onClick={() => handleActionClick(action)}
                disabled={isExecuting}
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
          Clear Selection
        </Button>
      </div>

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
