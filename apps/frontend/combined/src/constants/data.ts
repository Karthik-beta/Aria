import { NavItem } from '@/types';
import { url } from 'inspector';

export type Product = {
  photo_url: string;
  name: string;
  description: string;
  created_at: string;
  price: number;
  id: number;
  category: string;
  updated_at: string;
};

//Info: The following data is used for the sidebar navigation and Cmd K bar.
export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: [], // Empty array as there are no child items for Dashboard
  },
  // {
  //   title: 'Product',
  //   url: '/dashboard/product',
  //   icon: 'product',
  //   shortcut: ['p', 'p'],
  //   isActive: false,
  //   items: [], // No child items
  // },

  {
    title: 'Items Catalogue',
    url: '#', // Placeholder as there is no direct link for the parent
    icon: 'catalogue',
    isActive: false,

    items: [
      {
        title: 'Item',
        url: '/',
      },
      {
        title: 'Item Group',
        url: '/',
      },
      {
        title: 'Product Bundle',
        url: '/',
      },
      {
        title: 'Shipping Rule',
        url: '/',
      },
      {
        title: 'Item Alternative',
        url: '/',
      },
      {
        title: 'Item Manufacturer',
        url: '/',
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
        url: '/',
      },
      {
        title: 'Stock Entry',
        url: '/',
      },
      {
        title: 'Delivery Note',
        url: '/',
      },
      {
        title: 'Purchase Receipt',
        url: '/',
      },
      {
        title: 'Pick List',
        url: '/',
      },
      {
        title: 'Delivery Trip',
        url: '/',
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
        url: '/',
      },
      {
        title: 'Stock Balance',
        url: '/',
      },
      {
        title: 'Stock Projected Qty',
        url: '/',
      },
      {
        title: 'Stock Summary',
        url: '/',
      },
      {
        title: 'Stock Ageing',
        url: '/',
      },
      {
        title: 'Item Price Stock',
        url: '/',
      },
      {
        title: 'Warehouse Wise Stock Balance',
        url: '/',
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
        url: '/',
      },
      {
        title: 'Warehouse',
        url: '/',
      },
      {
        title: 'Unit of Measure (UOM)',
        url: '/',
      },
      {
        title: 'Item Variant Settings',
        url: '/',
      },
      {
        title: 'Brand',
        url: '/',
      },
      {
        title: 'Item Attribute',
        url: '/',
      },
    ],
  },
  {
    title: 'Serial No and Batch',
    url: '#',
    icon: 'serial',
    isActive: false,
    items: [
      {
        title: 'Serial No',
        url: '/',
      },
      {
        title: 'Batch',
        url: '/',
      },
      {
        title: 'Installation Note',
        url: '/',
      },
      {
        title: 'Serial No Service Contract Expiry',
        url: '/',
      },
      {
        title: 'Serial No Status',
        url: '/',
      },
      {
        title: 'Serial No Warranty Expiry',
        url: '/',
      },
    ],
  },
  {
    title: 'Tools',
    url: '#',
    icon: 'tools',
    isActive: false,
    items: [
      {
        title: 'Packing Slip',
        url: '/',
      },
      {
        title: 'Quality Inspection Template',
        url: '/',
      },
      {
        title: 'Quick Stock Balance',
        url: '/',
      },
    ],
  },
  {
    title: 'Key Reports',
    url: '#',
    icon: 'analytics',
    isActive: false,
    items: [
      {
        title: 'Stock Analytics',
        url: '/',
      },
      {
        title: 'Delivery Note Trends',
        url: '/',
      },
      {
        title: 'Purchase Receipt Trends',
        url: '/',
      },
      {
        title: 'Sales Order Analysis',
        url: '/',
      },
      {
        title: 'Purchase Order Analysis',
        url: '/',
      },
      {
        title: 'Item Shortage Report',
        url: '/',
      },
      {
        title: 'Batch-Wise Balance History',
        url: '/',
      },
    ],
  },
  {
    title: 'Other Reports',
    url: '#',
    icon: 'otherReports',
    isActive: false,
    items: [
      {
        title: 'Requested Items To Be Transferred',
        url: '/',
      },
      {
        title: 'Batch Item Expiry Status',
        url: '/',
      },
      {
        title: 'Item Prices',
        url: '/',
      },
      {
        title: 'Itemwise Recommended Reorder Level',
        url: '/',
      },
      {
        title: 'Item Variant Details',
        url: '/',
      },
      {
        title: 'Subcontracted Raw Materials To Be Transferred',
        url: '/',
      },
      {
        title: 'Subcontracted Item To Be Received',
        url: '/',
      },
    ],
  },
  {
    title: 'Account',
    url: '#', // Placeholder as there is no direct link for the parent
    icon: 'billing',
    isActive: false,

    items: [
      {
        title: 'Profile',
        url: '/dashboard/profile',
        icon: 'userPen',
        shortcut: ['m', 'm'],
      },
      {
        title: 'Login',
        shortcut: ['l', 'l'],
        url: '/',
        icon: 'login',
      },
    ],
  },
  // {
  //   title: 'Kanban',
  //   url: '/dashboard/kanban',
  //   icon: 'kanban',
  //   shortcut: ['k', 'k'],
  //   isActive: false,
  //   items: [], // No child items
  // },
];

export interface SaleUser {
  id: number;
  name: string;
  email: string;
  amount: string;
  image: string;
  initials: string;
}

export const recentSalesData: SaleUser[] = [
  {
    id: 1,
    name: 'Olivia Martin',
    email: 'olivia.martin@email.com',
    amount: '+$1,999.00',
    image: 'https://api.slingacademy.com/public/sample-users/1.png',
    initials: 'OM',
  },
  {
    id: 2,
    name: 'Jackson Lee',
    email: 'jackson.lee@email.com',
    amount: '+$39.00',
    image: 'https://api.slingacademy.com/public/sample-users/2.png',
    initials: 'JL',
  },
  {
    id: 3,
    name: 'Isabella Nguyen',
    email: 'isabella.nguyen@email.com',
    amount: '+$299.00',
    image: 'https://api.slingacademy.com/public/sample-users/3.png',
    initials: 'IN',
  },
  {
    id: 4,
    name: 'William Kim',
    email: 'will@email.com',
    amount: '+$99.00',
    image: 'https://api.slingacademy.com/public/sample-users/4.png',
    initials: 'WK',
  },
  {
    id: 5,
    name: 'Sofia Davis',
    email: 'sofia.davis@email.com',
    amount: '+$39.00',
    image: 'https://api.slingacademy.com/public/sample-users/5.png',
    initials: 'SD',
  },
];
