# Migration Guide: From Existing Data Tables to Advanced Data Table

This guide helps you migrate from the existing `DataTable` component to the new `AdvancedDataTable` component.

## Quick Comparison

| Feature           | Existing DataTable | Advanced DataTable        |
| ----------------- | ------------------ | ------------------------- |
| Basic filtering   | ✅                 | ✅ Enhanced               |
| Global search     | ❌                 | ✅ With autocomplete      |
| Export/Import     | ❌                 | ✅ Multiple formats       |
| Bulk actions      | ❌                 | ✅ Configurable           |
| Column reordering | ❌                 | ✅ Drag & drop            |
| Column resizing   | ❌                 | ✅                        |
| Virtualization    | ❌                 | ✅ For large datasets     |
| Real-time updates | ❌                 | ✅ Via tRPC subscriptions |

## Step-by-Step Migration

### 1. Update Imports

**Before:**

```tsx
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
```

**After:**

```tsx
import { AdvancedDataTable, useAdvancedDataTable } from '@/components/advanced-data-table';
```

### 2. Update Hook Usage

**Before:**

```tsx
const { table } = useDataTable({
  data,
  columns,
  pageCount,
  shallow: false,
  debounceMs: 500,
});
```

**After:**

```tsx
const { table } = useAdvancedDataTable({
  data,
  columns,
  pageCount,
  initialPageSize: 10,
  enableRowSelection: true,
  enableMultiRowSelection: true,
});
```

### 3. Update Component Usage

**Before:**

```tsx
<DataTable table={table}>
  <DataTableToolbar table={table} />
</DataTable>
```

**After:**

```tsx
<AdvancedDataTable table={table} data={data} enableGlobalSearch enableExport enableBulkActions />
```

### 4. Update Column Definitions

The column meta structure is mostly compatible, but you can add new features:

**Before:**

```tsx
{
  accessorKey: 'category',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
  meta: {
    label: 'Category',
    variant: 'multiSelect',
    options: CATEGORY_OPTIONS,
  },
  enableColumnFilter: true,
}
```

**After (enhanced):**

```tsx
{
  accessorKey: 'category',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
  meta: {
    label: 'Category',
    variant: 'multiSelect',
    options: CATEGORY_OPTIONS,
    exportable: true,    // NEW: Include in exports
    searchable: true,    // NEW: Enable in global search
    resizable: true,     // NEW: Allow column resizing
  },
  enableColumnFilter: true,
}
```

### 5. Add Selection Column (Optional)

If you want row selection for bulk actions:

```tsx
{
  id: 'select',
  header: ({ table }) => (
    <input
      type="checkbox"
      checked={table.getIsAllPageRowsSelected()}
      onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <input
      type="checkbox"
      checked={row.getIsSelected()}
      onChange={(e) => row.toggleSelected(e.target.checked)}
      aria-label="Select row"
    />
  ),
  enableSorting: false,
  enableHiding: false,
}
```

### 6. Add Bulk Actions (Optional)

Define bulk operations for selected rows:

```tsx
const bulkActions: BulkAction<YourDataType>[] = [
  {
    label: 'Delete Selected',
    icon: <Trash className="h-4 w-4" />,
    action: async (rows) => {
      const ids = rows.map((r) => r.original.id);
      await deleteMultiple(ids);
    },
    variant: 'destructive',
    requiresConfirmation: true,
  },
];

<AdvancedDataTable table={table} data={data} bulkActions={bulkActions} enableBulkActions />;
```

### 7. Add Export/Import (Optional)

Enable data export and import:

```tsx
<AdvancedDataTable
  table={table}
  data={data}
  enableExport
  enableImport
  exportFormats={['csv', 'excel', 'json']}
  onExport={async (format, rows) => {
    // Custom export logic if needed
  }}
  onImport={async (file) => {
    const parsed = await parseFile(file);
    await importData(parsed);
  }}
/>
```

## Example: Complete Migration

### Before (product-tables/index.tsx)

```tsx
'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';

interface ProductTableParams<TData, TValue> {
  data: TData[];
  totalItems: number;
  columns: ColumnDef<TData, TValue>[];
}

export function ProductTable<TData, TValue>({
  data,
  totalItems,
  columns,
}: ProductTableParams<TData, TValue>) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));
  const pageCount = Math.ceil(totalItems / pageSize);

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500,
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
```

### After (with AdvancedDataTable)

```tsx
'use client';

import {
  AdvancedDataTable,
  useAdvancedDataTable,
  BulkAction,
} from '@/components/advanced-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import { Trash, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface ProductTableParams<TData, TValue> {
  data: TData[];
  totalItems: number;
  columns: ColumnDef<TData, TValue>[];
}

export function ProductTable<TData, TValue>({
  data,
  totalItems,
  columns,
}: ProductTableParams<TData, TValue>) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));
  const pageCount = Math.ceil(totalItems / pageSize);

  const { table } = useAdvancedDataTable({
    data,
    columns,
    pageCount,
    initialPageSize: pageSize,
  });

  const bulkActions: BulkAction<TData>[] = [
    {
      label: 'Delete Selected',
      icon: <Trash className="h-4 w-4" />,
      action: async (rows) => {
        toast.success(`Deleting ${rows.length} items`);
        // Add your delete logic here
      },
      variant: 'destructive',
      requiresConfirmation: true,
    },
  ];

  return (
    <AdvancedDataTable
      table={table}
      data={data}
      totalItems={totalItems}
      enableGlobalSearch
      enableExport
      enableBulkActions
      enableVirtualization
      bulkActions={bulkActions}
      exportFormats={['csv', 'excel', 'json']}
    />
  );
}
```

## Common Issues & Solutions

### Issue: "Type errors with column definitions"

**Solution:** Ensure your column meta types are properly defined. The AdvancedDataTable extends the existing ColumnMeta interface.

### Issue: "Virtualization not working"

**Solution:**

- Ensure dataset has > 50 rows
- Check that `enableVirtualization` is `true`
- Verify the table container has proper height

### Issue: "Bulk actions not appearing"

**Solution:**

- Enable row selection in your columns (add selection column)
- Set `enableBulkActions={true}`
- Define `bulkActions` array
- Select some rows to see the bulk actions menu

### Issue: "Export button not showing"

**Solution:**

- Set `enableExport={true}`
- Optionally provide `exportFormats` array
- Check that columns have `meta.exportable: true`

## Backward Compatibility

The AdvancedDataTable is designed to be mostly backward compatible:

1. Existing column definitions work without changes
2. Existing meta properties are preserved
3. The `useDataTable` hook can still be used (though `useAdvancedDataTable` is recommended)
4. All existing UI components (DataTableColumnHeader, etc.) remain compatible

## Gradual Migration Strategy

You don't have to migrate all tables at once:

1. **Phase 1**: Migrate simple tables without custom features
2. **Phase 2**: Add export/import to critical tables
3. **Phase 3**: Add bulk actions where needed
4. **Phase 4**: Enable virtualization for large datasets
5. **Phase 5**: Implement real-time updates with tRPC subscriptions

## Testing Your Migration

After migration, verify:

- ✅ Sorting works on all sortable columns
- ✅ Filters apply correctly
- ✅ Pagination navigates properly
- ✅ Global search returns expected results
- ✅ Export downloads correct data
- ✅ Import processes files successfully
- ✅ Bulk actions execute properly
- ✅ Column visibility toggle works
- ✅ Column reordering functions (if enabled)
- ✅ Column resizing works (if enabled)
- ✅ Keyboard navigation is functional
- ✅ Mobile responsive layout works

## Need Help?

- Check the README.md for full documentation
- See example.tsx for complete implementation
- Review the product-tables folder for reference implementation
- Refer to the types.ts for available options

## Rollback Plan

If you encounter issues, you can easily roll back:

```tsx
// Simply change the import back
import { DataTable } from '@/components/ui/table/data-table';
import { useDataTable } from '@/hooks/use-data-table';

// And use the old component
const { table } = useDataTable({ data, columns, pageCount });
return (
  <DataTable table={table}>
    <DataTableToolbar table={table} />
  </DataTable>
);
```

Both components can coexist in the codebase during the migration period.
