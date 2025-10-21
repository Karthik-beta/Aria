# Advanced Data Table Component# Advanced Data Table

> Enterprise-grade, type-safe data table component with virtualization, filtering, and advanced features built on TanStack Table v8 and TanStack Virtual v3.Enterprise-grade, reusable data table component for the Aria ERP monorepo. Built with tRPC, TanStack Query, TanStack Table, TanStack Virtual, and shadcn/ui.

## Table of Contents## Features

- [Overview](#overview)### Core Capabilities

- [Features](#features)

- [Installation](#installation)- ✅ **Advanced Sorting & Filtering**: Multi-column sorting, Excel-style filtering with checkboxes

- [Quick Start](#quick-start)- ✅ **Comprehensive Search**: Global search with autocomplete + column-specific search

- [API Reference](#api-reference)- ✅ **CRUD Operations**: Support for Create, Read, Update, Delete operations

- [Type Safety](#type-safety)- ✅ **Data Export/Import**: Export to CSV, Excel, JSON, PDF; Import from CSV, Excel, JSON

- [Error Handling](#error-handling)- ✅ **Bulk Actions**: Select multiple rows and perform batch operations

- [Performance](#performance)- ✅ **Customizable Columns**: Show/hide, reorder, resize, and freeze columns

- [Examples](#examples)- ✅ **Pagination**: Configurable page sizes with server-side support

- [Migration Guide](#migration-guide)- ✅ **Virtual Scrolling**: Efficient rendering of large datasets using @tanstack/react-virtual

- [Best Practices](#best-practices)- ✅ **Asynchronous Loading**: tRPC + TanStack Query for server data fetching

- ✅ **Fixed Headers & Columns**: Sticky headers and pinned columns for large tables

## Overview- ✅ **State Indication**: Clear visual feedback for loading, sorting, filters, and selection

- ✅ **Virtualization**: Row and column virtualization for performance

The Advanced Data Table component provides a production-ready table implementation with enterprise features:- ✅ **Responsive Design**: Fully responsive across desktop, tablet, and mobile

- ✅ **Keyboard Navigation**: Comprehensive keyboard support for accessibility

- ✅ **Type-safe**: Full TypeScript support with strict generic constraints- ✅ **Real-time Updates**: tRPC subscriptions for live data (planned)

- ⚡ **Performant**: Virtual scrolling for large datasets (10,000+ rows)

- 🔍 **Searchable**: Global search with autocomplete suggestions## Installation

- 🎨 **Customizable**: Extensive theming and styling options

- ♿ **Accessible**: WCAG 2.1 AA compliant with keyboard navigationThe component is already integrated into the Aria ERP frontend. Dependencies are pre-installed:

- 📦 **Tree-shakable**: Only include features you need

- 🛡️ **Error-safe**: Comprehensive error handling with typed errors- `@tanstack/react-table` - Table logic and state management

- `@tanstack/react-query` - Data fetching and caching

## Features- `@tanstack/react-virtual` - Virtual scrolling

- `@trpc/client` & `@trpc/react-query` - Type-safe API calls

### Core Features- `@dnd-kit/*` - Drag-and-drop for column reordering

- shadcn/ui components - UI primitives

- **Virtual Scrolling**: Efficiently render 10,000+ rows using TanStack Virtual

- **Global Search**: Real-time search with debounced input and autocomplete## Basic Usage

- **Column Filtering**: Faceted filters with multiple variants (text, select, date, range)

- **Sorting**: Multi-column sorting with configurable directions```tsx

- **Pagination**: Client-side and server-side pagination support'use client';

- **Row Selection**: Single and multi-row selection with keyboard support

import { AdvancedDataTable, useAdvancedDataTable } from '@/components/advanced-data-table';

### Advanced Featuresimport { type ColumnDef } from '@tanstack/react-table';

- **Export/Import**: Export to CSV, Excel, JSON, PDF (with import support)interface Product {

- **Bulk Actions**: Execute operations on multiple selected rows id: string;

- **Column Management**: Show/hide, reorder, resize, and freeze columns name: string;

- **Real-time Updates**: Subscribe to data changes via tRPC (optional) category: string;

- **Inline Editing**: Edit cells directly in the table (coming soon) price: number;

- **Keyboard Navigation**: Full keyboard support (Ctrl+A, Escape, Arrow keys) stock: number;

}

## Installation

const columns: ColumnDef<Product>[] = [

The component is located in the monorepo at `apps/frontend/src/components/advanced-data-table/`. {

    accessorKey: 'name',

### Dependencies header: 'Product Name',

    meta: {

Required dependencies are already installed in the frontend app: label: 'Name',

      variant: 'text',

````json searchable: true,

{    },

  "@tanstack/react-table": "^8.x",  },

  "@tanstack/react-virtual": "^3.x",  {

  "sonner": "^1.x"    accessorKey: 'category',

}    header: 'Category',

```    meta: {

      label: 'Category',

## Quick Start      variant: 'multiSelect',

      options: [

### Basic Usage        { label: 'Electronics', value: 'electronics' },

        { label: 'Furniture', value: 'furniture' },

```tsx      ],

import { useAdvancedDataTable, AdvancedDataTable } from '@/components/advanced-data-table';    },

import type { ColumnDef } from '@tanstack/react-table';  },

  {

interface User {    accessorKey: 'price',

  id: string;    header: 'Price',

  name: string;    meta: {

  email: string;      label: 'Price',

  role: string;      variant: 'number',

}      unit: '$',

    },

const columns: ColumnDef<User>[] = [  },

  {];

    accessorKey: 'name',

    header: 'Name',export function ProductsTable() {

    meta: { label: 'Name', searchable: true },  const { table } = useAdvancedDataTable({

  },    data: products,

  {    columns,

    accessorKey: 'email',    pageCount: 10,

    header: 'Email',    initialPageSize: 25,

    meta: { label: 'Email', searchable: true },  });

  },

  {  return (

    accessorKey: 'role',    <AdvancedDataTable

    header: 'Role',      table={table}

    meta: {       data={products}

      label: 'Role',      enableGlobalSearch

      variant: 'select',      enableExport

      options: [      enableBulkActions

        { label: 'Admin', value: 'admin' },      enableVirtualization

        { label: 'User', value: 'user' },    />

      ],  );

    },}

  },```

];

## Advanced Usage with tRPC

function UsersTable() {

  const [data, setData] = React.useState<User[]>([]);```tsx

'use client';

  const { table } = useAdvancedDataTable({

    data,import { trpc } from '@/lib/trpc';

    columns,import { AdvancedDataTable, useAdvancedDataTable } from '@/components/advanced-data-table';

    enableRowSelection: true,import { useState } from 'react';

  });

export function ProductsTableWithTRPC() {

  return (  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

    <AdvancedDataTable  const [sorting, setSorting] = useState([]);

      table={table}  const [filters, setFilters] = useState([]);

      data={data}

      enableGlobalSearch  // Fetch data with tRPC

      enableExport  const { data, isLoading } = trpc.products.list.useQuery({

      exportFormats={['csv', 'excel', 'json']}    page: pagination.pageIndex + 1,

    />    pageSize: pagination.pageSize,

  );    sorting,

}    filters,

```  });



### With Bulk Actions  const { table } = useAdvancedDataTable({

    data: data?.items || [],

```tsx    columns,

import type { BulkAction } from '@/components/advanced-data-table';    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),

import { Trash2, Download } from 'lucide-react';    onPaginationChange: setPagination,

    onSortingChange: setSorting,

const bulkActions: BulkAction<User>[] = [    onColumnFiltersChange: setFilters,

  {  });

    label: 'Delete Selected',

    icon: <Trash2 className="h-4 w-4" />,  return (

    variant: 'destructive',    <AdvancedDataTable

    requiresConfirmation: true,      table={table}

    confirmationMessage: 'Are you sure you want to delete these users?',      data={data?.items || []}

    action: async (rows) => {      totalItems={data?.total}

      const ids = rows.map((row) => row.original.id);      enableGlobalSearch

      await deleteUsers(ids);      enableExport

    },      enableBulkActions

  },      bulkActions={[

  {        {

    label: 'Export Selected',          label: 'Delete Selected',

    icon: <Download className="h-4 w-4" />,          action: async (rows) => {

    action: async (rows) => {            const ids = rows.map((r) => r.original.id);

      await exportUsers(rows.map((r) => r.original));            await deleteMutation.mutateAsync(ids);

    },          },

  },          variant: 'destructive',

];          requiresConfirmation: true,

        },

<AdvancedDataTable      ]}

  table={table}    />

  data={data}  );

  bulkActions={bulkActions}}

  enableBulkActions```

/>

```## Column Configuration



### Server-Side Pagination### Column Meta Properties



```tsx```tsx

const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });interface ColumnMeta {

const [data, setData] = React.useState<User[]>([]);  label?: string; // Display label for filters

const [totalCount, setTotalCount] = React.useState(0);  placeholder?: string; // Placeholder for search inputs

  variant?: FilterVariant; // Filter type: 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'dateRange'

const { table } = useAdvancedDataTable({  options?: Option[]; // Options for select/multiSelect filters

  data,  range?: [number, number]; // Range for numeric filters

  columns,  unit?: string; // Unit for numeric values (e.g., '$', 'kg')

  pageCount: Math.ceil(totalCount / pagination.pageSize),  icon?: React.FC; // Icon component

  onPaginationChange: setPagination,  exportable?: boolean; // Include in exports

});  searchable?: boolean; // Enable column search

  resizable?: boolean; // Allow column resizing

React.useEffect(() => {  freezable?: boolean; // Allow column pinning

  fetchUsers(pagination).then((result) => {}

    setData(result.data);```

    setTotalCount(result.total);

  });### Example: Complex Column Definition

}, [pagination]);

```tsx

<AdvancedDataTable{

  table={table}  accessorKey: 'status',

  data={data}  header: 'Status',

  totalItems={totalCount}  cell: ({ row }) => (

/>    <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>

```      {row.original.status}

    </Badge>

## API Reference  ),

  meta: {

### `useAdvancedDataTable<TData>`    label: 'Status',

    variant: 'multiSelect',

Hook for creating a table instance with advanced features.    options: [

      { label: 'Active', value: 'active', icon: CheckCircle },

#### Props      { label: 'Inactive', value: 'inactive', icon: XCircle },

    ],

| Prop | Type | Default | Description |    exportable: true,

|------|------|---------|-------------|  },

| `data` | `readonly TData[]` | **required** | Array of row data |  enableSorting: true,

| `columns` | `ColumnDef<TData>[]` | **required** | Column definitions |  enableColumnFilter: true,

| `pageCount` | `number` | `-1` | Total page count (-1 for client-side) |}

| `initialPageSize` | `number` | `10` | Initial rows per page |```

| `initialSorting` | `SortingState` | `[]` | Initial sort state |

| `enableRowSelection` | `boolean` | `true` | Enable row selection |## Bulk Actions

| `enableGlobalFilter` | `boolean` | `true` | Enable global search |

| `onPaginationChange` | `(state) => void` | - | Pagination change callback |```tsx

| `onSortingChange` | `(state) => void` | - | Sorting change callback |const bulkActions: BulkAction<Product>[] = [

| `onReload` | `() => Promise<void>` | - | Reload data callback |  {

    label: 'Export Selected',

#### Returns    icon: <FileDown />,

    action: async (rows) => {

```tsx      await exportData('csv', rows);

{    },

  table: Table<TData>;    variant: 'outline',

  state: {  },

    rowSelection: RowSelectionState;  {

    columnVisibility: VisibilityState;    label: 'Update Status',

    columnFilters: ColumnFiltersState;    icon: <Edit />,

    sorting: SortingState;    action: async (rows) => {

    globalFilter: string;      const ids = rows.map((r) => r.original.id);

    pagination: PaginationState;      await updateStatusMutation.mutateAsync({ ids, status: 'active' });

  };    },

  // ... state setters    variant: 'default',

}  },

```  {

    label: 'Delete Selected',

### `AdvancedDataTable<TData>`    icon: <Trash />,

    action: async (rows) => {

Main table component.      const ids = rows.map((r) => r.original.id);

      await deleteMutation.mutateAsync(ids);

#### Props    },

    variant: 'destructive',

| Prop | Type | Default | Description |    requiresConfirmation: true,

|------|------|---------|-------------|    confirmationMessage: 'This will permanently delete the selected items.',

| `table` | `Table<TData>` | **required** | Table instance from hook |  },

| `data` | `readonly TData[]` | **required** | Array of row data |];

| `enableGlobalSearch` | `boolean` | `true` | Show global search input |

| `enableExport` | `boolean` | `true` | Enable export functionality |<AdvancedDataTable table={table} data={data} bulkActions={bulkActions} />;

| `enableImport` | `boolean` | `true` | Enable import functionality |```

| `enableBulkActions` | `boolean` | `true` | Enable bulk actions |

| `enableVirtualization` | `boolean` | `true` | Enable virtual scrolling |## Export/Import

| `exportFormats` | `ExportFormat[]` | `['csv','excel','json']` | Available export formats |

| `bulkActions` | `BulkAction<TData>[]` | `[]` | Bulk action definitions |### Export Configuration

| `onExport` | `(format, rows) => void` | - | Custom export handler |

| `onImport` | `(data) => void` | - | Custom import handler |```tsx

| `onError` | `(error) => void` | - | Error handler |<AdvancedDataTable

| `primaryAction` | `ReactNode` | - | Primary action button |  table={table}

| `ariaLabel` | `string` | `'Advanced data table'` | ARIA label |  data={data}

  enableExport

## Type Safety  exportFormats={['csv', 'excel', 'json']}

  onExport={async (format, rows) => {

### Generic Constraints    // Custom export logic

    const data = rows.map((r) => r.original);

All components require `TData extends RowData`:    await customExportFunction(format, data);

  }}

```tsx/>

import type { RowData } from '@tanstack/react-table';```



interface User extends RowData {### Import Configuration

  id: string;

  name: string;```tsx

  email: string;<AdvancedDataTable

}  table={table}

  data={data}

// ✅ Correct  enableImport

const { table } = useAdvancedDataTable<User>({ ... });  onImport={async (file) => {

    // Custom import logic

// ❌ Error: Type 'string' does not satisfy constraint 'RowData'    const data = await parseFile(file);

const { table } = useAdvancedDataTable<string>({ ... });    await importMutation.mutateAsync(data);

```  }}

/>

### Column Meta Types```



Extend column metadata for type-safe filter configuration:## Props Reference



```tsx### AdvancedDataTable Props

declare module '@tanstack/react-table' {

  interface ColumnMeta<TData extends RowData, TValue> {| Prop                        | Type                  | Default                    | Description                             |

    label?: string;| --------------------------- | --------------------- | -------------------------- | --------------------------------------- |

    variant?: 'text' | 'number' | 'select' | 'multiSelect' | 'date';| `table`                     | `Table<TData>`        | Required                   | TanStack Table instance                 |

    options?: { label: string; value: string }[];| `data`                      | `TData[]`             | Required                   | Table data array                        |

    searchable?: boolean;| `totalItems`                | `number`              | -                          | Total items for pagination              |

  }| `enableGlobalSearch`        | `boolean`             | `true`                     | Enable global search                    |

}| `enableColumnSearch`        | `boolean`             | `true`                     | Enable column-specific search           |

| `enableExport`              | `boolean`             | `true`                     | Enable data export                      |

const columns: ColumnDef<User>[] = [| `enableImport`              | `boolean`             | `true`                     | Enable data import                      |

  {| `enableBulkActions`         | `boolean`             | `true`                     | Enable bulk operations                  |

    accessorKey: 'role',| `enableVirtualization`      | `boolean`             | `true`                     | Enable row virtualization               |

    meta: {| `enableRealtime`            | `boolean`             | `false`                    | Enable real-time updates                |

      label: 'Role',| `enableColumnResizing`      | `boolean`             | `true`                     | Enable column resizing                  |

      variant: 'select', // Type-safe| `enableColumnReordering`    | `boolean`             | `true`                     | Enable column reordering                |

      options: roleOptions,| `enableColumnFreezing`      | `boolean`             | `true`                     | Enable column pinning                   |

    },| `exportFormats`             | `ExportFormat[]`      | `['csv', 'excel', 'json']` | Available export formats                |

  },| `bulkActions`               | `BulkAction<TData>[]` | -                          | Bulk action configurations              |

];| `onExport`                  | `Function`            | -                          | Custom export handler                   |

```| `onImport`                  | `Function`            | -                          | Custom import handler                   |

| `virtualScrollEstimateSize` | `number`              | `50`                       | Estimated row height for virtualization |

### Error Types| `virtualScrollOverscan`     | `number`              | `5`                        | Overscan rows for virtualization        |



All errors are typed with `AdvancedDataTableError`:## Keyboard Shortcuts



```tsx- **Ctrl/Cmd + A**: Select all rows

type AdvancedDataTableError =- **Escape**: Clear row selection

  | { type: 'export'; message: string; format: ExportFormat; cause?: unknown }- **Tab**: Navigate between interactive elements

  | { type: 'import'; message: string; fileName: string; cause?: unknown }- **Arrow Keys**: Navigate table cells (when focused)

  | { type: 'bulk-action'; message: string; actionLabel: string; cause?: unknown }- **Enter**: Activate focused element

  | { type: 'validation'; message: string; field?: string; cause?: unknown }- **Space**: Toggle row selection (when checkbox focused)

  | { type: 'network'; message: string; cause?: unknown }

  | { type: 'unknown'; message: string; cause?: unknown };## Accessibility



// Usage- ARIA labels and descriptions for screen readers

const handleError = (error: AdvancedDataTableError) => {- Keyboard navigation support

  switch (error.type) {- Focus management

    case 'export':- Clear visual indicators for state changes

      console.error(`Export to ${error.format} failed:`, error.message);- Semantic HTML structure

      break;

    case 'bulk-action':## Performance Considerations

      toast.error(`Action "${error.actionLabel}" failed`);

      break;- Virtual scrolling automatically activates for datasets > 50 rows

    // ... handle other cases- Column virtualization for wide tables

  }- Debounced search inputs (300ms default)

};- Optimized re-renders with React.memo and useMemo

```- Pagination for large datasets

- Lazy loading with tRPC and TanStack Query

## Error Handling

## Styling

### Component-Level Error Handling

The component uses existing shadcn/ui theme variables and Tailwind CSS. All styling is consistent with the Aria ERP design system.

```tsx

<AdvancedDataTable## Examples

  table={table}

  data={data}See the `product-tables` folder in `features/products/components` for a reference implementation.

  onError={(error) => {

    // Log to error tracking service## Troubleshooting

    logError(error);

    ### Virtual scrolling not working

    // Show user-friendly message

    toast.error(error.message);- Ensure dataset has > 50 rows

  }}- Check `enableVirtualization` prop is `true`

/>- Verify scroll container has proper height

````

### Filters not applying

### Bulk Action Error Handling

- Check column `enableColumnFilter` is `true`

```tsx- Verify `meta.variant` is set correctly

const bulkActions: BulkAction<User>[] = [- Ensure filter options are provided for select/multiSelect

{

    label: 'Process Users',### Export not working

    action: async (rows) => {

      try {- Check browser console for errors

        await processUsers(rows.map(r => r.original));- Verify data has exportable values

      } catch (error) {- Ensure proper permissions for file downloads

        // Error is automatically caught and passed to onError

        throw new Error(`Failed to process ${rows.length} users`);## Contributing

      }

    },Follow the Four-Agent Philosophy when contributing:

},

];1. **Simplicity Advocate**: Use framework defaults

````2. **Type Safety Guardian**: Maintain strict TypeScript

3. **Automation Steward**: Test locally before PR

### Export/Import Error Handling4. **Quality Sentinel**: Include tests with features



```tsx## License

<AdvancedDataTable

  table={table}Internal use only - Aria ERP Monorepo

  data={data}
  onExport={async (format, rows) => {
    try {
      await exportData(format, rows);
    } catch (error) {
      if (error.type === 'export') {
        toast.error(`Export to ${error.format} failed`);
      }
    }
  }}
  onImport={async (data) => {
    try {
      await importUsers(data);
    } catch (error) {
      toast.error('Import failed. Please check file format.');
    }
  }}
/>
````

## Performance

### Virtual Scrolling

Virtual scrolling is automatically enabled for datasets with more than 50 rows:

```tsx
<AdvancedDataTable
  table={table}
  data={largeDataset} // 10,000+ rows
  enableVirtualization // default: true
  virtualScrollEstimateSize={50} // estimated row height in px
  virtualScrollOverscan={5} // rows to render outside viewport
/>
```

### Optimization Tips

1. **Memoize Column Definitions**:

```tsx
const columns = React.useMemo<ColumnDef<User>[]>(
  () => [
    { accessorKey: 'name', header: 'Name' },
    // ...
  ],
  []
);
```

2. **Use Stable References**:

```tsx
// ✅ Good: Stable reference
const handleExport = React.useCallback(async (format, rows) => {
  await exportData(format, rows);
}, []);

// ❌ Bad: New reference on every render
const handleExport = async (format, rows) => {
  await exportData(format, rows);
};
```

3. **Debounce Search**:

```tsx
<GlobalSearch
  table={table}
  debounceMs={300} // default: 300ms
/>
```

4. **Lazy Load Data**:

```tsx
// Only fetch data when needed
const { data, isLoading } = useQuery(['users', pagination], () => fetchUsers(pagination));
```

## Examples

See the `example.tsx` file for a comprehensive example with all features enabled.

## Migration Guide

### From Previous Version

If you're migrating from an older version of this component:

1. **Update Type Constraints**: Add `RowData` constraint to all generic types
2. **Update Error Handlers**: Replace `Error` with `AdvancedDataTableError`
3. **Update Callbacks**: Use callback refs for better performance
4. **Remove Stale Dependencies**: Check useEffect dependencies

### Breaking Changes

- **v2.0.0**:
  - All generic types now require `extends RowData`
  - Error types changed from `Error` to `AdvancedDataTableError`
  - `onImport` callback now receives `Record<string, unknown>[]` instead of `any[]`
  - Removed `any` types throughout the codebase

## Best Practices

### Type Safety

1. **Always Extend RowData**:

```tsx
interface User extends RowData {
  id: string;
  name: string;
}
```

2. **Use Const Assertions**:

```tsx
const exportFormats = ['csv', 'excel', 'json'] as const;
```

3. **Avoid `any`**:

```tsx
// ❌ Bad
const columns: ColumnDef<any>[] = [];

// ✅ Good
const columns: ColumnDef<User>[] = [];
```

### Performance

1. **Memoize Expensive Computations**:

```tsx
const filteredData = React.useMemo(() => data.filter(/* ... */), [data]);
```

2. **Use Virtualization for Large Datasets**:

```tsx
// Enable for >50 rows
enableVirtualization={data.length > 50}
```

3. **Implement Server-Side Operations**:

```tsx
// Don't fetch all data at once
const { data } = useQuery(['users', pagination, filters], () =>
  fetchUsers({ pagination, filters })
);
```

### Accessibility

1. **Provide ARIA Labels**:

```tsx
<AdvancedDataTable
  ariaLabel="User management table"
  ariaDescription="List of all users with filtering and sorting"
/>
```

2. **Test Keyboard Navigation**:

- `Ctrl+A`: Select all rows
- `Escape`: Clear selection
- `Tab`: Navigate between focusable elements

3. **Ensure Color Contrast**:

- Use semantic color tokens from the design system
- Test with accessibility tools

### Error Handling

1. **Always Provide Error Handler**:

```tsx
<AdvancedDataTable
  onError={(error) => {
    logError(error);
    toast.error(error.message);
  }}
/>
```

2. **Handle Async Errors**:

```tsx
const bulkAction: BulkAction<User> = {
  action: async (rows) => {
    try {
      await processUsers(rows);
    } catch (error) {
      throw new Error('Processing failed'); // Will be caught by component
    }
  },
};
```

3. **Provide User Feedback**:

```tsx
// Show loading states
const [isLoading, setIsLoading] = React.useState(false);

// Show error states
toast.error('Operation failed. Please try again.');
```

## Contributing

When contributing to this component:

1. **Follow Type Safety Guidelines**: Use strict TypeScript
2. **Add Tests**: Include unit tests for new features
3. **Update Documentation**: Keep this README up-to-date
4. **Follow React Best Practices**: Use official React patterns
5. **Optimize Performance**: Consider large datasets

## License

This component is part of the Aria ERP project.
