# React State Update Error Fix

## Error Description

```
Can't perform a React state update on a component that hasn't mounted yet. 
This indicates that you have a side-effect in your render function that 
asynchronously tries to update the component. Move this work to useEffect instead.

at SelectAllCheckbox (src/app/inventory/items-catalogue/item/page.tsx:64:39)
```

## Root Cause

The error occurred because we created a **separate component** (`SelectAllCheckbox`) that was called during the `header` render function of a column definition:

```typescript
// ❌ CAUSES ERROR
const SelectAllCheckbox = ({ table }) => {
  const isAllPageRowsSelected = table.getIsAllPageRowsSelected(); // ⚠️ State read during render
  // ...
};

const columns = useMemo(() => [
  {
    id: 'select',
    header: ({ table }) => <SelectAllCheckbox table={table} />, // ❌ Component created during render
  }
]);
```

### Why This Causes the Error

1. **TanStack Table renders headers during table initialization**
2. When `SelectAllCheckbox` calls `table.getIsAllPageRowsSelected()`, it may trigger internal state updates in the table
3. This creates a state update **during render**, which is not allowed in React
4. React throws the error because state updates must happen in event handlers or useEffect, not during render

## The Solution

**Render the checkbox inline in the header function** instead of creating a separate component:

```typescript
// ✅ CORRECT - Inline render
const columns = useMemo(() => [
  {
    id: 'select',
    header: ({ table }) => {
      // Read state inline during render - this is safe
      const isAllPageRowsSelected = table.getIsAllPageRowsSelected();
      const isSomePageRowsSelected = table.getIsSomePageRowsSelected();
      const currentPageRows = table.getRowModel().rows;
      const selectedRowsOnPage = currentPageRows.filter((row) => row.getIsSelected());
      const selectedCount = selectedRowsOnPage.length;
      const totalCount = currentPageRows.length;

      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllPageRowsSelected || (isSomePageRowsSelected ? 'indeterminate' : false)}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label={...}
          />
          {isSomePageRowsSelected && !isAllPageRowsSelected && totalCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {selectedCount}
            </span>
          )}
        </div>
      );
    },
  }
]);
```

## Why This Works

1. **No component boundary** - The checkbox is rendered directly in the header function
2. **Synchronous state reads** - All table methods are called synchronously during render
3. **No mount/unmount lifecycle** - There's no component lifecycle to trigger state updates
4. **TanStack Table expects this pattern** - The library is designed for inline header renders

## Key Takeaways

### ❌ Don't Do This with TanStack Table

```typescript
// Creating components for column headers/cells can cause issues
const MyHeaderComponent = ({ table }) => {
  const value = table.getSomeState(); // May trigger state updates
  return <div>{value}</div>;
};

columns: [
  {
    header: ({ table }) => <MyHeaderComponent table={table} />
  }
]
```

### ✅ Do This Instead

```typescript
// Render inline in the header/cell function
columns: [
  {
    header: ({ table }) => {
      const value = table.getSomeState();
      return <div>{value}</div>;
    }
  }
]
```

### When You CAN Use Separate Components

You can create separate components when they **don't read table state during render**:

```typescript
// ✅ OK - Component receives computed values as props
const CheckboxDisplay = ({ checked, onChange, count }) => (
  <div>
    <Checkbox checked={checked} onCheckedChange={onChange} />
    {count > 0 && <span>{count}</span>}
  </div>
);

columns: [
  {
    header: ({ table }) => {
      // Compute all values first
      const isAllSelected = table.getIsAllPageRowsSelected();
      const count = table.getSelectedRowModel().rows.length;
      
      // Pass as props
      return (
        <CheckboxDisplay
          checked={isAllSelected}
          onChange={(v) => table.toggleAllPageRowsSelected(v)}
          count={count}
        />
      );
    }
  }
]
```

But **inline rendering is simpler and recommended** for table headers/cells.

## Related Patterns

### Inline Cell Rendering (Already Correct)

```typescript
// ✅ This pattern is correct and commonly used
{
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
    />
  )
}
```

### Complex Headers (Use Inline JSX)

```typescript
// ✅ Even complex headers should be inline
{
  header: ({ table, column }) => {
    const isSorted = column.getIsSorted();
    const canSort = column.getCanSort();
    
    return (
      <div className="flex items-center gap-2">
        <span>{column.columnDef.header}</span>
        {canSort && (
          <Button onClick={() => column.toggleSorting()}>
            {isSorted === 'asc' ? '↑' : isSorted === 'desc' ? '↓' : '↕'}
          </Button>
        )}
      </div>
    );
  }
}
```

## Documentation References

- [TanStack Table - Column Defs](https://tanstack.com/table/latest/docs/guide/column-defs)
- [React - Rules of Hooks](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
- [React - You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

---

**Summary**: When working with TanStack Table, always render headers and cells **inline** in the column definition functions. Don't create separate components that read table state during render, as this can cause React state update errors.
