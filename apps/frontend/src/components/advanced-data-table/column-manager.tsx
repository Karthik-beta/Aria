/**
 * Advanced Data Table - Column Manager Component
 * Allows users to show/hide, reorder, resize, and freeze columns
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings2 } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface ColumnManagerProps<TData> {
  table: Table<TData>;
  enableReordering?: boolean;
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

export function ColumnManager<TData>({ table, enableReordering = true }: ColumnManagerProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const columns = table.getAllColumns().filter((column) => column.getCanHide());

  // State for column order
  const [columnOrder, setColumnOrder] = React.useState<string[]>(
    columns.map((column) => column.id)
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update table column order
        table.setColumnOrder(newOrder);
        
        return newOrder;
      });
    }
  };

  const handleResetOrder = () => {
    const defaultOrder = columns.map((column) => column.id);
    setColumnOrder(defaultOrder);
    table.setColumnOrder(defaultOrder);
  };

  const handleResetVisibility = () => {
    table.resetColumnVisibility();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <Settings2 className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px]">
        <DropdownMenuLabel>Manage Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {enableReordering ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
              <div className="max-h-[300px] overflow-y-auto">
                {columnOrder.map((columnId) => {
                  const column = table.getColumn(columnId);
                  if (!column) return null;

                  return (
                    <SortableItem key={columnId} id={columnId}>
                      <DropdownMenuCheckboxItem
                        className="flex-1 capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {typeof column.columnDef.header === 'string'
                          ? column.columnDef.header
                          : columnId.replace(/_/g, ' ')}
                      </DropdownMenuCheckboxItem>
                    </SortableItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {typeof column.columnDef.header === 'string'
                  ? column.columnDef.header
                  : column.id.replace(/_/g, ' ')}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        )}
        
        <DropdownMenuSeparator />
        <div className="flex gap-2 p-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleResetVisibility}>
            Reset Visibility
          </Button>
          {enableReordering && (
            <Button variant="outline" size="sm" className="flex-1" onClick={handleResetOrder}>
              Reset Order
            </Button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
