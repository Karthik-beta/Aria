# 📦 Inventory Management Frontend

The **Inventory Frontend** helps you track stock levels, manage warehouses, and coordinate with suppliers. Built with **Next.js 15**, it gives you real-time visibility into your inventory.

## 📋 What Does This Do?

This application helps you:
- **Track stock levels** - See what's in stock, running low, or out of stock
- **Manage warehouses** - Handle multiple storage locations
- **Process transfers** - Move items between warehouses
- **Coordinate with vendors** - Manage purchase orders and deliveries
- **Generate reports** - Analyze inventory turnover and costs
- **Set reorder points** - Automatic alerts when stock is low

Think of it as your warehouse manager's best friend!

## 🚀 Quick Start

### First Time Setup

```bash
# 1. Install all dependencies (run from project root)
pnpm install

# 2. Start the development server
pnpm --filter inventory dev
```

The app will open at `http://localhost:3004` (or the next available port).

### Common Commands

| What You Want To Do | Command | What Happens |
|---------------------|---------|--------------||
| Start the app | `pnpm --filter inventory dev` | Runs in development mode with hot-reload |
| Build for production | `pnpm --filter inventory build` | Creates optimized production build |
| Run tests | `pnpm --filter inventory test` | Runs component tests |
| Check code style | `pnpm --filter inventory lint` | Finds and fixes formatting issues |

## 📁 Project Structure

```
apps/frontend/inventory/
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── page.tsx               # Home page (inventory dashboard)
│   │   ├── items/                 # Item catalog
│   │   ├── warehouses/            # Warehouse management
│   │   ├── transfers/             # Stock transfers
│   │   ├── vendors/               # Supplier management
│   │   └── layout.tsx             # Shared layout
│   ├── components/                # Reusable UI components
│   │   ├── ItemCard.tsx
│   │   ├── StockTable.tsx
│   │   └── WarehouseSelector.tsx
│   ├── lib/                       # Utilities and helpers
│   └── styles/                    # Global styles
└── public/                        # Static assets
```

## 🔒 Type Safety & Shared Code

### Using Shared Types

```typescript
// Import inventory-specific types
import { Inventory } from '@aria/types';

function ItemList({ items }: { items: Inventory.Item[] }) {
  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          {item.name} - Stock: {item.quantity}
        </div>
      ))}
    </div>
  );
}
```

### Path Aliases

```typescript
// Use @inventory/* for clean imports
import { ItemCard } from '@inventory/components/ItemCard';
import { fetchStock } from '@inventory/lib/api';
```

## 📚 Key Features to Implement

### Item Management
- Add, edit, and archive inventory items
- Store SKU, description, unit of measure
- Track item categories and subcategories
- Set reorder levels and lead times

### Stock Tracking
- Real-time stock levels across warehouses
- Low stock alerts
- Stock history and movements
- Batch and serial number tracking

### Warehouse Management
- Multiple warehouse support
- Location tracking (aisle, rack, bin)
- Warehouse capacity planning
- Physical inventory counts

### Purchase Orders
- Create and manage purchase orders
- Track order status (pending, received, completed)
- Vendor management
- Receiving and quality checks

### Stock Transfers
- Transfer items between warehouses
- Track transfer status
- Handle in-transit inventory
- Transfer history and audit trail

## 💡 Pro Tips for Inventory

- **Barcode Scanning**: Consider integrating barcode scanner support for faster data entry
- **Excel Import**: Allow bulk import of items from Excel/CSV files
- **Charts**: Use charts to visualize stock levels, trends, and forecasts
- **Alerts**: Set up low-stock and expiry date alerts
- **Reports**: Generate reports for stock valuation, aging, and turnover

## 🐛 Common Issues

### Stock Counts Don't Match?
- Implement double-entry system (every transaction has source and destination)
- Add audit logs for all stock changes
- Run regular reconciliation reports

### Performance Issues with Large Inventories?
- Use pagination (50-100 items per page)
- Implement server-side search and filtering
- Add database indexes on frequently queried fields
- Consider caching for frequently accessed data

### Negative Stock Values?
- Add validation to prevent withdrawals exceeding available stock
- Implement reservation system for pending orders
- Run regular data integrity checks

## 🔗 Related Documentation

- [Main Project README](../../../README.md)
- [Backend API README](../../backend/README.md)
- [Shared Types](../../../packages/types/README.md)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Need Help?** Review the `src/components/` directory for component examples!
