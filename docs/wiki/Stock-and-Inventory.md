# Stock and Inventory

The largest module, ported from ERPNext's **Stock** module. Service code links each DocType to its page in the ERPNext documentation, and the reports mirror ERPNext's.

## What it covers

| Area | Aria entities and pages | ERPNext DocTypes |
|---|---|---|
| Item master | Item, Item Group (tree), Brand, UOM and conversions, Item Attribute and variants, Item Barcode, Item Reorder, Item Alternative, Item Manufacturer, Product Bundle | same names |
| Warehouses and settings | Warehouse, Stock Settings, Shipping Rule | same names |
| Transactions | Material Request, Stock Entry, Purchase Receipt, Delivery Note, Pick List, Delivery Trip, Packing Slip, Installation Note | same names |
| Traceability | Batch, Serial No (with history), serial-no status, warranty and service-contract expiry | Batch, Serial No |
| Quality | Quality Inspection, parameter groups, parameters, templates | Quality Inspection, Quality Inspection Template |
| Linked documents | Sales Order, Purchase Order, Subcontracting Order | Selling, Buying and Subcontracting DocTypes |

**Reports:** stock balance, stock ledger, stock ageing, projected qty, stock summary, warehouse-wise balance, item price stock, stock analytics, batch-wise balance, batch expiry, item shortage, item-wise reorder level, delivery-note and purchase-receipt trends, purchase- and sales-order analysis, subcontracting reports and more.

**UI:** `/inventory`: items catalogue, stock transactions, serial no and batch, tools, settings, stock reports, reports and dashboard.

Document numbers come from a shared naming-series counter, like ERPNext's naming series.
