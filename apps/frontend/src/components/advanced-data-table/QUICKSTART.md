# Advanced Data Table - Quick Reference

## 🚀 Quick Start (5 minutes)

```tsx
import { AdvancedDataTable, useAdvancedDataTable } from '@/components/advanced-data-table';
import { ColumnDef } from '@tanstack/react-table';

// 1. Define your data type
interface MyData {
  id: string;
  name: string;
  status: string;
}

// 2. Define columns
const columns: ColumnDef<MyData>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    meta: { variant: 'text', label: 'Name' },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { variant: 'multiSelect', label: 'Status', options: [...] },
  },
];

// 3. Create table
const { table } = useAdvancedDataTable({ data, columns });

// 4. Render
return <AdvancedDataTable table={table} data={data} />;
```

## 📦 What You Get Out of the Box

| Feature | Enabled by Default | Prop to Control |
|---------|-------------------|-----------------|
| Global Search | ✅ Yes | `enableGlobalSearch` |
| Column Filters | ✅ Yes | Column `meta.variant` |
| Sorting | ✅ Yes | Column `enableSorting` |
| Pagination | ✅ Yes | Built-in |
| Export | ✅ Yes | `enableExport` |
| Import | ✅ Yes | `enableImport` |
| Bulk Actions | ⚪ Optional | `enableBulkActions` |
| Virtualization | ✅ Auto (>50 rows) | `enableVirtualization` |
| Column Resizing | ✅ Yes | `enableColumnResizing` |
| Column Reordering | ✅ Yes | `enableColumnReordering` |

## 🎨 Common Patterns

### With tRPC

```tsx
const { data } = trpc.items.list.useQuery({ page: 1, pageSize: 25 });
const { table } = useAdvancedDataTable({
  data: data?.items || [],
  columns,
  pageCount: Math.ceil((data?.total || 0) / 25),
});
```

### With Bulk Actions

```tsx
const bulkActions = [
  {
    label: 'Delete',
    action: async (rows) => { await deleteMultiple(rows.map(r => r.original.id)) },
    variant: 'destructive',
    requiresConfirmation: true,
  },
];

<AdvancedDataTable bulkActions={bulkActions} enableBulkActions />
```

### With Custom Export

```tsx
<AdvancedDataTable
  onExport={async (format, rows) => {
    const data = rows.map(r => r.original);
    await myCustomExport(format, data);
  }}
/>
```

## 🔧 Column Configuration Cheat Sheet

```tsx
{
  accessorKey: 'fieldName',
  header: 'Display Name',
  
  // Filter configuration
  meta: {
    variant: 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'dateRange',
    label: 'Filter Label',
    options: [{ label: 'X', value: 'x' }], // For select/multiSelect
    searchable: true,    // Include in global search
    exportable: true,    // Include in exports
  },
  
  // Enable features
  enableSorting: true,
  enableColumnFilter: true,
  enableHiding: true,
  enableResizing: true,
}
```

## ⌨️ Keyboard Shortcuts

- `Ctrl/Cmd + A` → Select all rows
- `Escape` → Clear selection
- `Tab` → Navigate elements
- `Space` → Toggle selection (when focused)

## 🎯 Props Quick Reference

### Most Used Props

```tsx
<AdvancedDataTable
  table={table}                    // Required: TanStack Table instance
  data={data}                      // Required: Your data array
  
  // Features (all optional, defaults shown)
  enableGlobalSearch={true}
  enableExport={true}
  enableImport={true}
  enableBulkActions={false}
  enableVirtualization={true}
  
  // Export/Import
  exportFormats={['csv', 'excel', 'json']}
  onExport={async (format, rows) => {}}
  onImport={async (data) => {}}
  
  // Bulk Actions
  bulkActions={[...]}
  
  // Customization
  className="custom-class"
  ariaLabel="My Table"
/>
```

## 📝 Filter Variants

| Variant | Use For | Example |
|---------|---------|---------|
| `text` | Strings | Names, descriptions |
| `number` | Numbers | Prices, quantities |
| `select` | Single choice | Status (one value) |
| `multiSelect` | Multiple choice | Categories, tags |
| `date` | Single date | Created date |
| `dateRange` | Date range | Date between |
| `boolean` | True/false | Active/inactive |

## 🎭 Common Customizations

### Add Selection Column

```tsx
{
  id: 'select',
  header: ({ table }) => (
    <input type="checkbox" 
      checked={table.getIsAllPageRowsSelected()}
      onChange={e => table.toggleAllPageRowsSelected(e.target.checked)} />
  ),
  cell: ({ row }) => (
    <input type="checkbox"
      checked={row.getIsSelected()}
      onChange={e => row.toggleSelected(e.target.checked)} />
  ),
}
```

### Custom Cell Rendering

```tsx
{
  accessorKey: 'status',
  cell: ({ row }) => (
    <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
      {row.original.status}
    </Badge>
  ),
}
```

### Actions Column

```tsx
{
  id: 'actions',
  header: 'Actions',
  cell: ({ row }) => (
    <Button onClick={() => editRow(row.original)}>Edit</Button>
  ),
}
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| No search results | Check `enableColumnFilter: true` on columns |
| Export button missing | Set `enableExport={true}` |
| Virtualization slow | Adjust `virtualScrollEstimateSize` |
| Filters not showing | Add `meta.variant` to column definition |

## 📚 Files to Reference

- `README.md` - Full documentation
- `example.tsx` - Complete working example
- `MIGRATION.md` - Upgrade from old DataTable
- `types.ts` - All TypeScript definitions

## 🔗 Related Components

- `DataTableColumnHeader` - Sortable column headers
- `DataTablePagination` - Pagination controls
- `DataTableViewOptions` - Column visibility toggle

## 💡 Pro Tips

1. **Performance**: Enable virtualization for datasets > 50 rows
2. **Export**: Only exportable columns (meta.exportable: true) are included
3. **Filters**: Use multiSelect for better UX than multiple single selects
4. **Search**: Global search searches all string columns automatically
5. **Keyboard**: Users expect Ctrl+A to select all - it's built in!

## 🎓 Next Steps

1. Copy `example.tsx` to your feature folder
2. Modify data type and columns for your use case
3. Connect to your tRPC endpoint
4. Add bulk actions if needed
5. Customize styling to match your design

---

**Need Help?** Check the full README.md or the example.tsx file for detailed guidance.
