/**
 * App-specific sidebar navigation data
 * Each app (Inventory, Asset, CRM, HRMS) has its own navigation structure
 */

import type { NavItem } from '../types';

export type { NavItem };

export const inventoryNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/inventory/dashboard',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: [],
  },
  {
    title: 'Items Catalogue',
    url: '#',
    icon: 'catalogue',
    isActive: false,
    items: [
      {
        title: 'Item',
        url: '/inventory/items',
      },
      {
        title: 'Item Group',
        url: '/inventory/item-groups',
      },
      {
        title: 'Product Bundle',
        url: '/inventory/bundles',
      },
      {
        title: 'Shipping Rule',
        url: '/inventory/shipping-rules',
      },
      {
        title: 'Item Alternative',
        url: '/inventory/item-alternatives',
      },
      {
        title: 'Item Manufacturer',
        url: '/inventory/manufacturers',
      },
    ],
  },
  {
    title: 'Stock Transactions',
    url: '#',
    icon: 'transaction',
    isActive: false,
    items: [
      {
        title: 'Material Request',
        url: '/inventory/material-requests',
      },
      {
        title: 'Stock Entry',
        url: '/inventory/stock-entries',
      },
      {
        title: 'Delivery Note',
        url: '/inventory/delivery-notes',
      },
      {
        title: 'Purchase Receipt',
        url: '/inventory/purchase-receipts',
      },
      {
        title: 'Pick List',
        url: '/inventory/pick-lists',
      },
      {
        title: 'Delivery Trip',
        url: '/inventory/delivery-trips',
      },
    ],
  },
  {
    title: 'Stock Reports',
    url: '#',
    icon: 'report',
    isActive: false,
    items: [
      {
        title: 'Stock Ledger',
        url: '/inventory/reports/stock-ledger',
      },
      {
        title: 'Stock Balance',
        url: '/inventory/reports/stock-balance',
      },
      {
        title: 'Stock Projected Qty',
        url: '/inventory/reports/projected-qty',
      },
      {
        title: 'Stock Summary',
        url: '/inventory/reports/stock-summary',
      },
      {
        title: 'Stock Ageing',
        url: '/inventory/reports/stock-ageing',
      },
    ],
  },
  {
    title: 'Inventory Settings',
    url: '#',
    icon: 'settings',
    isActive: false,
    items: [
      {
        title: 'Stock Settings',
        url: '/inventory/settings/stock',
      },
      {
        title: 'Warehouse',
        url: '/inventory/warehouses',
      },
      {
        title: 'Unit of Measure (UOM)',
        url: '/inventory/uom',
      },
      {
        title: 'Brand',
        url: '/inventory/brands',
      },
    ],
  },
];

export const assetNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/asset/dashboard',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: [],
  },
  {
    title: 'Assets',
    url: '#',
    icon: 'dashboard',
    isActive: false,
    items: [
      {
        title: 'Asset List',
        url: '/asset/assets',
      },
      {
        title: 'Asset Categories',
        url: '/asset/categories',
      },
      {
        title: 'Asset Depreciation',
        url: '/asset/depreciation',
      },
      {
        title: 'Maintenance Schedule',
        url: '/asset/maintenance',
      },
    ],
  },
  {
    title: 'Asset Reports',
    url: '#',
    icon: 'report',
    isActive: false,
    items: [
      {
        title: 'Asset Valuation',
        url: '/asset/reports/valuation',
      },
      {
        title: 'Depreciation Report',
        url: '/asset/reports/depreciation',
      },
      {
        title: 'Asset Location Report',
        url: '/asset/reports/location',
      },
    ],
  },
  {
    title: 'Settings',
    url: '#',
    icon: 'settings',
    isActive: false,
    items: [
      {
        title: 'Asset Settings',
        url: '/asset/settings',
      },
    ],
  },
];

export const crmNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/crm/dashboard',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: [],
  },
  {
    title: 'Sales Analytics',
    url: '/',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: [],
  },
  {
    title: 'Customers',
    url: '#',
    icon: 'dashboard',
    isActive: false,
    items: [
      {
        title: 'Customer List',
        url: '/crm/customers',
      },
      {
        title: 'Customer Groups',
        url: '/crm/customer-groups',
      },
      {
        title: 'Leads',
        url: '/crm/leads',
      },
      {
        title: 'Opportunities',
        url: '/crm/opportunities',
      },
    ],
  },
  {
    title: 'Sales',
    url: '#',
    icon: 'dashboard',
    isActive: false,
    items: [
      {
        title: 'Quotation',
        url: '/crm/quotations',
      },
      {
        title: 'Sales Order',
        url: '/crm/sales-orders',
      },
      {
        title: 'Sales Invoice',
        url: '/crm/invoices',
      },
      {
        title: 'Payment',
        url: '/crm/payments',
      },
    ],
  },
  {
    title: 'CRM Reports',
    url: '#',
    icon: 'report',
    isActive: false,
    items: [
      {
        title: 'Sales Pipeline',
        url: '/crm/reports/pipeline',
      },
      {
        title: 'Revenue Report',
        url: '/crm/reports/revenue',
      },
      {
        title: 'Customer Report',
        url: '/crm/reports/customers',
      },
    ],
  },
];

export const hrmsNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/hrms/dashboard',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: [],
  },
  {
    title: 'Employees',
    url: '#',
    icon: 'dashboard',
    isActive: false,
    items: [
      {
        title: 'Employee List',
        url: '/hrms/employees',
      },
      {
        title: 'Departments',
        url: '/hrms/departments',
      },
      {
        title: 'Designations',
        url: '/hrms/designations',
      },
      {
        title: 'Employee Groups',
        url: '/hrms/employee-groups',
      },
    ],
  },
  {
    title: 'Attendance',
    url: '#',
    icon: 'dashboard',
    isActive: false,
    items: [
      {
        title: 'Attendance',
        url: '/hrms/attendance',
      },
      {
        title: 'Checkin',
        url: '/hrms/checkin',
      },
      {
        title: 'Shift Management',
        url: '/hrms/shifts',
      },
    ],
  },
  {
    title: 'Leave Management',
    url: '#',
    icon: 'dashboard',
    isActive: false,
    items: [
      {
        title: 'Leave Application',
        url: '/hrms/leave-applications',
      },
      {
        title: 'Leave Type',
        url: '/hrms/leave-types',
      },
      {
        title: 'Holiday',
        url: '/hrms/holidays',
      },
    ],
  },
  {
    title: 'Payroll',
    url: '#',
    icon: 'dashboard',
    isActive: false,
    items: [
      {
        title: 'Salary Structure',
        url: '/hrms/salary-structures',
      },
      {
        title: 'Salary Slip',
        url: '/hrms/salary-slips',
      },
      {
        title: 'Payroll Period',
        url: '/hrms/payroll-periods',
      },
    ],
  },
  {
    title: 'HR Reports',
    url: '#',
    icon: 'dashboard',
    isActive: false,
    items: [
      {
        title: 'Employee Report',
        url: '/hrms/reports/employees',
      },
      {
        title: 'Attendance Report',
        url: '/hrms/reports/attendance',
      },
      {
        title: 'Salary Report',
        url: '/hrms/reports/salary',
      },
    ],
  },
];

/**
 * Metadata for each app (used for headers, labels, etc.)
 */
export const appMetadata: Record<
  string,
  {
    label: string;
    description: string;
  }
> = {
  inventory: {
    label: 'Inventory Management',
    description: 'Manage stock, items, and warehouse operations',
  },
  asset: {
    label: 'Asset Management',
    description: 'Track and manage company assets',
  },
  crm: {
    label: 'Customer Relations',
    description: 'Manage customers, leads, and sales',
  },
  hrms: {
    label: 'Human Resources',
    description: 'Manage employees, payroll, and attendance',
  },
};

/**
 * Get navigation items for a specific app
 * @param appName - The app name (e.g., 'inventory', 'asset', 'crm', 'hrms')
 * @returns Array of navigation items for the app
 */
export const getAppNavItems = (appName: string): NavItem[] => {
  const lowerAppName = appName.toLowerCase();

  const navMap: Record<string, NavItem[]> = {
    inventory: inventoryNavItems,
    asset: assetNavItems,
    crm: crmNavItems,
    hrms: hrmsNavItems,
  };

  return navMap[lowerAppName] || inventoryNavItems; // Default to inventory if app not found
};

/**
 * Get metadata for a specific app
 * @param appName - The app name
 * @returns Metadata object for the app
 */
export const getAppMetadata = (appName: string) => {
  const lowerAppName = appName.toLowerCase();
  return appMetadata[lowerAppName] || appMetadata['inventory'];
};
