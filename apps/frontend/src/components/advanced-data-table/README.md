# Advanced Data Table

Enterprise-grade, reusable data table component for the Aria ERP monorepo. Built with tRPC, TanStack Query, TanStack Table, TanStack Virtual, and shadcn/ui.

## Features

### Core Capabilities

- ✅ **Advanced Sorting & Filtering**: Multi-column sorting, Excel-style filtering with checkboxes
- ✅ **Comprehensive Search**: Global search with autocomplete + column-specific search
- ✅ **CRUD Operations**: Support for Create, Read, Update, Delete operations
- ✅ **Data Export/Import**: Export to CSV, Excel, JSON, PDF; Import from CSV, Excel, JSON
- ✅ **Bulk Actions**: Select multiple rows and perform batch operations
- ✅ **Customizable Columns**: Show/hide, reorder, resize, and freeze columns
- ✅ **Pagination**: Configurable page sizes with server-side support
- ✅ **Virtual Scrolling**: Efficient rendering of large datasets using @tanstack/react-virtual
- ✅ **Asynchronous Loading**: tRPC + TanStack Query for server data fetching
- ✅ **Fixed Headers & Columns**: Sticky headers and pinned columns for large tables
- ✅ **State Indication**: Clear visual feedback for loading, sorting, filters, and selection
- ✅ **Virtualization**: Row and column virtualization for performance
- ✅ **Responsive Design**: Fully responsive across desktop, tablet, and mobile
- ✅ **Keyboard Navigation**: Comprehensive keyboard support for accessibility
- ✅ **Real-time Updates**: tRPC subscriptions for live data (planned)

## Installation

The component is already integrated into the Aria ERP frontend. Dependencies are pre-installed:

- `@tanstack/react-table` - Table logic and state management
- `@tanstack/react-query` - Data fetching and caching
- `@tanstack/react-virtual` - Virtual scrolling
- `@trpc/client` & `@trpc/react-query` - Type-safe API calls
- `@dnd-kit/*` - Drag-and-drop for column reordering
- shadcn/ui components - UI primitives

## Basic Usage

```tsx
'use client';

import { AdvancedDataTable, useAdvancedDataTable } from '@/components/advanced-data-table';
import { type ColumnDef } from '@tanstack/react-table';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: 'Product Name',
    meta: {
      label: 'Name',
      variant: 'text',
      searchable: true,
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    meta: {
      label: 'Category',
      variant: 'multiSelect',
      options: [
        { label: 'Electronics', value: 'electronics' },
        { label: 'Furniture', value: 'furniture' },
      ],
    },
  },
  {
    accessorKey: 'price',
    header: 'Price',
    meta: {
      label: 'Price',
      variant: 'number',
      unit: '$',
    },
  },
];

export function ProductsTable() {
  const { table } = useAdvancedDataTable({
    data: products,
    columns,
    pageCount: 10,
    initialPageSize: 25,
  });

  return (
    <AdvancedDataTable
      table={table}
      data={products}
      enableGlobalSearch
      enableExport
      enableBulkActions
      enableVirtualization
    />
  );
}
```

## Advanced Usage with tRPC

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { AdvancedDataTable, useAdvancedDataTable } from '@/components/advanced-data-table';
import { useState } from 'react';

export function ProductsTableWithTRPC() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState([]);
  const [filters, setFilters] = useState([]);

  // Fetch data with tRPC
  const { data, isLoading } = trpc.products.list.useQuery({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sorting,
    filters,
  });

  const { table } = useAdvancedDataTable({
    data: data?.items || [],
    columns,
    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
  });

  return (
    <AdvancedDataTable
      table={table}
      data={data?.items || []}
      totalItems={data?.total}
      enableGlobalSearch
      enableExport
      enableBulkActions
      bulkActions={[
        {
          label: 'Delete Selected',
          action: async (rows) => {
            const ids = rows.map((r) => r.original.id);
            await deleteMutation.mutateAsync(ids);
          },
          variant: 'destructive',
          requiresConfirmation: true,
        },
      ]}
    />
  );
}
```

## Column Configuration

### Column Meta Properties

```tsx
interface ColumnMeta {
  label?: string; // Display label for filters
  placeholder?: string; // Placeholder for search inputs
  variant?: FilterVariant; // Filter type: 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'dateRange'
  options?: Option[]; // Options for select/multiSelect filters
  range?: [number, number]; // Range for numeric filters
  unit?: string; // Unit for numeric values (e.g., '$', 'kg')
  icon?: React.FC; // Icon component
  exportable?: boolean; // Include in exports
  searchable?: boolean; // Enable column search
  resizable?: boolean; // Allow column resizing
  freezable?: boolean; // Allow column pinning
}
```

### Example: Complex Column Definition

```tsx
{
  accessorKey: 'status',
  header: 'Status',
  cell: ({ row }) => (
    <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
      {row.original.status}
    </Badge>
  ),
  meta: {
    label: 'Status',
    variant: 'multiSelect',
    options: [
      { label: 'Active', value: 'active', icon: CheckCircle },
      { label: 'Inactive', value: 'inactive', icon: XCircle },
    ],
    exportable: true,
  },
  enableSorting: true,
  enableColumnFilter: true,
}
```

## Bulk Actions

```tsx
const bulkActions: BulkAction<Product>[] = [
  {
    label: 'Export Selected',
    icon: <FileDown />,
    action: async (rows) => {
      await exportData('csv', rows);
    },
    variant: 'outline',
  },
  {
    label: 'Update Status',
    icon: <Edit />,
    action: async (rows) => {
      const ids = rows.map((r) => r.original.id);
      await updateStatusMutation.mutateAsync({ ids, status: 'active' });
    },
    variant: 'default',
  },
  {
    label: 'Delete Selected',
    icon: <Trash />,
    action: async (rows) => {
      const ids = rows.map((r) => r.original.id);
      await deleteMutation.mutateAsync(ids);
    },
    variant: 'destructive',
    requiresConfirmation: true,
    confirmationMessage: 'This will permanently delete the selected items.',
  },
];

<AdvancedDataTable table={table} data={data} bulkActions={bulkActions} />;
```

## Export/Import

### Export Configuration

```tsx
<AdvancedDataTable
  table={table}
  data={data}
  enableExport
  exportFormats={['csv', 'excel', 'json']}
  onExport={async (format, rows) => {
    // Custom export logic
    const data = rows.map((r) => r.original);
    await customExportFunction(format, data);
  }}
/>
```

### Import Configuration

```tsx
<AdvancedDataTable
  table={table}
  data={data}
  enableImport
  onImport={async (file) => {
    // Custom import logic
    const data = await parseFile(file);
    await importMutation.mutateAsync(data);
  }}
/>
```

## Props Reference

### AdvancedDataTable Props

| Prop                        | Type                  | Default                    | Description                             |
| --------------------------- | --------------------- | -------------------------- | --------------------------------------- |
| `table`                     | `Table<TData>`        | Required                   | TanStack Table instance                 |
| `data`                      | `TData[]`             | Required                   | Table data array                        |
| `totalItems`                | `number`              | -                          | Total items for pagination              |
| `enableGlobalSearch`        | `boolean`             | `true`                     | Enable global search                    |
| `enableColumnSearch`        | `boolean`             | `true`                     | Enable column-specific search           |
| `enableExport`              | `boolean`             | `true`                     | Enable data export                      |
| `enableImport`              | `boolean`             | `true`                     | Enable data import                      |
| `enableBulkActions`         | `boolean`             | `true`                     | Enable bulk operations                  |
| `enableVirtualization`      | `boolean`             | `true`                     | Enable row virtualization               |
| `enableRealtime`            | `boolean`             | `false`                    | Enable real-time updates                |
| `enableColumnResizing`      | `boolean`             | `true`                     | Enable column resizing                  |
| `enableColumnReordering`    | `boolean`             | `true`                     | Enable column reordering                |
| `enableColumnFreezing`      | `boolean`             | `true`                     | Enable column pinning                   |
| `exportFormats`             | `ExportFormat[]`      | `['csv', 'excel', 'json']` | Available export formats                |
| `bulkActions`               | `BulkAction<TData>[]` | -                          | Bulk action configurations              |
| `onExport`                  | `Function`            | -                          | Custom export handler                   |
| `onImport`                  | `Function`            | -                          | Custom import handler                   |
| `virtualScrollEstimateSize` | `number`              | `50`                       | Estimated row height for virtualization |
| `virtualScrollOverscan`     | `number`              | `5`                        | Overscan rows for virtualization        |

## Keyboard Shortcuts

- **Ctrl/Cmd + A**: Select all rows
- **Escape**: Clear row selection
- **Tab**: Navigate between interactive elements
- **Arrow Keys**: Navigate table cells (when focused)
- **Enter**: Activate focused element
- **Space**: Toggle row selection (when checkbox focused)

## Accessibility

- ARIA labels and descriptions for screen readers
- Keyboard navigation support
- Focus management
- Clear visual indicators for state changes
- Semantic HTML structure

## Performance Considerations

- Virtual scrolling automatically activates for datasets > 50 rows
- Column virtualization for wide tables
- Debounced search inputs (300ms default)
- Optimized re-renders with React.memo and useMemo
- Pagination for large datasets
- Lazy loading with tRPC and TanStack Query

## Styling

The component uses existing shadcn/ui theme variables and Tailwind CSS. All styling is consistent with the Aria ERP design system.

## Examples

See the `product-tables` folder in `features/products/components` for a reference implementation.

## Troubleshooting

### Virtual scrolling not working

- Ensure dataset has > 50 rows
- Check `enableVirtualization` prop is `true`
- Verify scroll container has proper height

### Filters not applying

- Check column `enableColumnFilter` is `true`
- Verify `meta.variant` is set correctly
- Ensure filter options are provided for select/multiSelect

### Export not working

- Check browser console for errors
- Verify data has exportable values
- Ensure proper permissions for file downloads

## Contributing

Follow the Four-Agent Philosophy when contributing:

1. **Simplicity Advocate**: Use framework defaults
2. **Type Safety Guardian**: Maintain strict TypeScript
3. **Automation Steward**: Test locally before PR
4. **Quality Sentinel**: Include tests with features

## License

Internal use only - Aria ERP Monorepo
