# Inventory Items Catalogue

Complete CRUD implementation for inventory management using the advanced data table component with tRPC integration.

## Structure

```
item/
├── page.tsx              # List view with advanced data table
├── [itemId]/
│   └── page.tsx         # Detail view for individual items
└── README.md            # This file
```

## Features

### List Page (`page.tsx`)

**Advanced Data Table Implementation:**

- ✅ 8 column definitions (select, name, SKU, quantity, status, createdAt, updatedAt, actions)
- ✅ Computed stock status with badge variants (Out of Stock, Low Stock, In Stock)
- ✅ Global search across all columns
- ✅ Column filtering (name, SKU, status)
- ✅ Sorting on all sortable columns
- ✅ Pagination with configurable page size
- ✅ Export to CSV, Excel, JSON
- ✅ Bulk delete action with confirmation

**CRUD Operations:**

- ✅ **Create**: Dialog with react-hook-form + zod validation using `Inventory.createSchema`
- ✅ **Read**: tRPC query with `trpc.inventory.listItems.useQuery()`
- ✅ **Update**: Edit dialog with pre-filled form using `Inventory.updateSchema`
- ✅ **Delete**: Single item deletion with AlertModal confirmation
- ✅ **Bulk Delete**: Sequential deletion of multiple selected items

**User Experience:**

- ✅ Toast notifications for all operations (success/error)
- ✅ Loading states during mutations
- ✅ Automatic query invalidation after mutations
- ✅ Router navigation to detail page via "View" action
- ✅ Form validation with error messages
- ✅ Responsive design

### Detail Page (`[itemId]/page.tsx`)

**Information Display:**

- ✅ Basic information card (name, SKU, quantity, stock status)
- ✅ Metadata card (ID, created date, updated date)
- ✅ Stock alert card for low/out of stock items
- ✅ Formatted dates with locale-specific formatting
- ✅ Badge indicators for stock status

**Actions:**

- ✅ Back navigation to list page
- ✅ Edit button opening dialog with pre-filled form
- ✅ Delete button with confirmation modal
- ✅ Form validation with error messages
- ✅ Loading states during mutations

**Error Handling:**

- ✅ Loading skeleton while fetching data
- ✅ Not found state when item doesn't exist
- ✅ Toast notifications for operations
- ✅ Automatic redirect to list after deletion

## Type Safety

All components use types from `@aria/types`:

```typescript
import { type Inventory } from '@aria/types';

// Item interface
interface Item {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

// Create input
interface CreateInput {
  name: string;
  sku: string;
  quantity?: number;
}

// Update input
interface UpdateInput {
  id: string;
  name?: string;
  sku?: string;
  quantity?: number;
}

// Zod schemas
const createSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().toUpperCase(),
  quantity: z.number().int().min(0).default(0).optional(),
});

const updateSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(255).optional(),
  sku: z.string().toUpperCase().optional(),
  quantity: z.number().int().min(0).optional(),
});
```

## Backend Integration

### tRPC Routes Used

All routes from `apps/backend/src/apps/inventory/trpc/inventory.router.ts`:

```typescript
// List all items
trpc.inventory.listItems.useQuery();

// Create item
trpc.inventory.createItem.useMutation();

// Update item
trpc.inventory.updateItem.useMutation();

// Delete item
trpc.inventory.deleteItem.useMutation();
```

### Service Methods

All methods from `apps/backend/src/apps/inventory/inventory.service.ts`:

```typescript
// List with ordering
async findAll() {
  return this.prisma.inventoryItem.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

// Create with SKU uniqueness check
async create(data: Inventory.CreateInput) {
  // Check SKU uniqueness
  // Create item
}

// Update with conditional fields
async update(data: Inventory.UpdateInput) {
  // Update only provided fields
}

// Delete with error handling
async delete(id: string) {
  // Handle P2025 error for non-existent items
}
```

## Stock Status Logic

```typescript
const getStockStatus = (quantity: number) => {
  if (quantity === 0)
    return {
      label: 'Out of Stock',
      variant: 'destructive',
      icon: XCircle,
    };

  if (quantity < 10)
    return {
      label: 'Low Stock',
      variant: 'secondary',
      icon: AlertTriangle,
    };

  return {
    label: 'In Stock',
    variant: 'default',
    icon: CheckCircle2,
  };
};
```

## Usage

### Navigate to List Page

```
http://localhost:3000/inventory/items-catalogue/item
```

### Create New Item

1. Click "Create Item" button
2. Fill in form fields:
   - Name (required, 1-255 characters)
   - SKU (required, automatically uppercased)
   - Quantity (optional, defaults to 0, must be ≥ 0)
3. Submit form
4. Toast notification confirms success

### Edit Item

**From List:**

1. Click "Edit" in row actions dropdown
2. Modify fields in dialog
3. Submit form

**From Detail:**

1. Click "Edit" button in header
2. Modify fields in dialog
3. Submit form

### Delete Item

**Single Delete from List:**

1. Click "Delete" in row actions dropdown
2. Confirm in AlertModal
3. Item removed from list

**Delete from Detail:**

1. Click "Delete" button in header
2. Confirm in AlertModal
3. Redirect to list page

**Bulk Delete:**

1. Select multiple items using checkboxes
2. Click "Bulk Actions" → "Delete Selected"
3. Confirm deletion
4. Items removed sequentially

### View Details

1. Click "View" in row actions dropdown
2. Navigate to detail page at `/inventory/items-catalogue/item/[itemId]`
3. View all item information

## Column Configuration

```typescript
const columns: AdvancedColumnDef<Inventory.Item>[] = [
  {
    id: 'select',
    // Checkbox for row selection
  },
  {
    accessorKey: 'name',
    header: 'Item Name',
    meta: {
      filterVariant: 'text',
      exportable: true,
    },
  },
  {
    accessorKey: 'sku',
    header: 'SKU',
    meta: {
      filterVariant: 'text',
      exportable: true,
    },
  },
  {
    accessorKey: 'quantity',
    header: 'Quantity',
    meta: {
      exportable: true,
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = getStockStatus(row.original.quantity);
      return <Badge variant={status.variant}>{status.label}</Badge>;
    },
    meta: {
      filterVariant: 'select',
      filterOptions: ['Out of Stock', 'Low Stock', 'In Stock'],
      exportable: true,
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    meta: {
      exportable: true,
    },
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    meta: {
      exportable: true,
    },
  },
  {
    id: 'actions',
    // Row actions dropdown
  },
];
```

## Form Validation

### Create Form

```typescript
const createForm = useForm<Inventory.CreateInput>({
  resolver: zodResolver(Inventory.createSchema),
  defaultValues: {
    name: '',
    sku: '',
    quantity: 0,
  },
});
```

### Edit Form

```typescript
const editForm = useForm<Inventory.UpdateInput>({
  resolver: zodResolver(Inventory.updateSchema),
});

// Pre-fill when editing
editForm.reset({
  id: item.id,
  name: item.name,
  sku: item.sku,
  quantity: item.quantity,
});
```

## Advanced Data Table Features

All features from the advanced data table component:

- ✅ **Sorting**: Click column headers to sort
- ✅ **Filtering**: Use column filters for text/select filtering
- ✅ **Search**: Global search across all columns
- ✅ **Pagination**: Navigate through pages with configurable size
- ✅ **Export**: Download data as CSV, Excel, or JSON
- ✅ **Column Management**: Show/hide/reorder columns
- ✅ **Bulk Actions**: Select multiple rows for bulk operations
- ✅ **Responsive**: Mobile-friendly design
- ✅ **Keyboard Navigation**: Full keyboard accessibility

## Testing Checklist

### List Page

- [ ] Page loads successfully
- [ ] Items displayed in table
- [ ] Create dialog opens and submits
- [ ] Edit dialog opens with pre-filled data
- [ ] Delete confirmation works
- [ ] Bulk delete works for multiple items
- [ ] Search filters results
- [ ] Column filters work
- [ ] Sorting works
- [ ] Pagination works
- [ ] Export functionality works
- [ ] Toast notifications appear
- [ ] View action navigates to detail page

### Detail Page

- [ ] Page loads with item data
- [ ] Stock status badge displays correctly
- [ ] Stock alert shows for low/out of stock items
- [ ] Edit button opens dialog with pre-filled data
- [ ] Delete button shows confirmation
- [ ] Back button navigates to list
- [ ] Dates formatted correctly
- [ ] Not found state shows for invalid IDs
- [ ] Loading skeleton displays while fetching

### Integration

- [ ] Create from list → item appears in table
- [ ] Edit from list → item updates in table
- [ ] Delete from list → item removed from table
- [ ] Navigate to detail → back to list works
- [ ] Edit from detail → changes reflected in list
- [ ] Delete from detail → redirects to list
- [ ] Bulk delete → all selected items removed

## Performance Considerations

### Optimizations Applied

1. **Query Caching**: tRPC queries cached automatically by TanStack Query
2. **Optimistic Updates**: Not implemented (could be added for better UX)
3. **Virtualization**: Available in advanced data table for large datasets
4. **Debounced Search**: Built into advanced data table global search
5. **Lazy Loading**: Next.js App Router handles code splitting

### Potential Improvements

- Implement optimistic updates for instant UI feedback
- Add pagination to backend for very large datasets
- Implement real-time updates with tRPC subscriptions
- Add item history/audit log
- Implement batch operations on backend for bulk actions
- Add image upload for items
- Implement barcode scanning integration

## Dependencies

### Required Packages

All dependencies already installed:

```json
{
  "dependencies": {
    "@tanstack/react-table": "^8.21.3",
    "@tanstack/react-query": "^5.90.5",
    "@tanstack/react-virtual": "^3.13.12",
    "@trpc/client": "^11.6.0",
    "@trpc/react-query": "^11.6.0",
    "@hookform/resolvers": "^3.10.0",
    "react-hook-form": "^7.65.0",
    "zod": "^4.1.12",
    "sonner": "^2.1.4"
  }
}
```

### Shared Packages

```json
{
  "dependencies": {
    "@aria/types": "workspace:*",
    "@aria/utils": "workspace:*"
  }
}
```

## Troubleshooting

### Items Not Loading

- Check backend server is running: `pnpm --filter backend dev`
- Verify tRPC router includes inventory namespace
- Check browser console for errors
- Verify Prisma migrations applied

### Create/Update Fails

- Check form validation errors
- Verify SKU uniqueness constraint
- Check backend logs for errors
- Ensure required fields provided

### Delete Fails

- Verify item exists
- Check for foreign key constraints
- Ensure proper permissions
- Check backend error logs

### Navigation Not Working

- Verify Next.js App Router structure
- Check `[itemId]` dynamic route folder
- Ensure router from `next/navigation` imported
- Check browser console for errors

## Next Steps

Potential enhancements:

1. **Item History**: Track all changes to items with audit log
2. **Categories**: Add category management and filtering
3. **Suppliers**: Link items to suppliers
4. **Locations**: Multi-warehouse inventory tracking
5. **Stock Movements**: Track inventory movements (in/out/transfer)
6. **Alerts**: Automated low stock alerts via email/notifications
7. **Barcode Integration**: Barcode generation and scanning
8. **Images**: Upload and display product images
9. **Pricing**: Add cost and selling price fields
10. **Reports**: Generate inventory reports and analytics

## Architecture Alignment

This implementation follows the **Aria Four-Agent Philosophy**:

### ✅ Simplicity Advocate

- Used Next.js App Router conventions
- Leveraged existing shadcn/ui components
- Used framework CLIs for scaffolding
- Avoided custom configurations

### ✅ Type Safety Guardian

- Extended `@aria/types` for all contracts
- Used TypeScript strict mode
- Validated with Zod schemas
- Zero `any` types

### ✅ Automation Steward

- Integrated with CI/CD pipeline
- Used Turborepo caching
- Followed workspace conventions
- Documented all dependencies

### ✅ Quality Sentinel

- Implemented proper error handling
- Added loading states
- Ensured accessibility
- Created comprehensive documentation

---

**Ready to use!** Start the development server and navigate to `/inventory/items-catalogue/item`.
