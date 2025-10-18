import { z } from 'zod';

// ============================================================================
// API Response Contracts
// ============================================================================

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
}

// ============================================================================
// Inventory Domain Types & Schemas
// ============================================================================

export namespace Inventory {
  /**
   * Inventory item - matches Prisma schema
   */
  export interface Item {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
  }

  /**
   * Create inventory item input
   */
  export interface CreateInput {
    name: string;
    sku: string;
    quantity?: number;
  }

  /**
   * Update inventory item input
   */
  export interface UpdateInput {
    id: string;
    name?: string;
    sku?: string;
    quantity?: number;
  }

  // ============================================================================
  // Zod Schemas - Simple validation
  // ============================================================================

  /**
   * Schema for creating inventory items
   */
  export const createSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255).trim(),
    sku: z.string().min(1, 'SKU is required').max(100).trim().toUpperCase(),
    quantity: z.number().int().min(0).default(0),
  });

  /**
   * Schema for updating inventory items
   */
  export const updateSchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1).max(255).trim().optional(),
    sku: z.string().min(1).max(100).trim().toUpperCase().optional(),
    quantity: z.number().int().min(0).optional(),
  });
}
