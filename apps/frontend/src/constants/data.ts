/**
 * Product type and mock data
 * This file contains shared data types used across the application
 */

import type { Product } from '@aria/types';

// Re-export the Product type for convenience
export type { Product };

// Mock product data for product listing components
export const mockProducts: Product[] = [
  {
    id: 1,
    name: 'Sample Product 1',
    description: 'This is a sample product',
    category: 'Electronics',
    price: 99.99,
    photo_url: 'https://via.placeholder.com/300x300',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Sample Product 2',
    description: 'Another sample product',
    category: 'Electronics',
    price: 149.99,
    photo_url: 'https://via.placeholder.com/300x300',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];
