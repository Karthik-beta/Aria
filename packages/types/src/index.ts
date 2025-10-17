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
   * Inventory item database model
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
   * Input for creating new inventory items
   */
  export interface CreateInput {
    name: string;
    sku: string;
    quantity?: number;
  }

  /**
   * Zod schema for validating inventory items
   */
  export const itemSchema = z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string(),
    quantity: z.number().int().nonnegative(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }) satisfies z.ZodType<Item>;

  /**
   * Zod schema for creating inventory items
   */
  export const createInputSchema = z.object({
    name: z.string().min(1, 'Item name is required'),
    sku: z.string().min(1, 'SKU is required'),
    quantity: z.number().int().min(0, 'Quantity must be non-negative').default(0),
  }) satisfies z.ZodType<CreateInput>;
}
