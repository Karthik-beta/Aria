import { z } from 'zod';

// ============================================================================
// API Response Contracts
// ============================================================================

/**
 * Pagination parameters for API requests
 * @example { page: 1, pageSize: 10 }
 */
export interface Pagination {
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
}

/**
 * Standard API response wrapper
 * @template T - The type of data being returned
 * @example ApiResponse<Product[]> for a list of products
 */
export interface ApiResponse<T> {
  /** The actual data payload */
  data: T;
  /** Optional pagination info for list responses */
  pagination?: Pagination;
}

// ============================================================================
// Inventory Domain Types & Schemas
// ============================================================================

/**
 * Inventory namespace - groups all inventory-related types
 * Use: import { Inventory } from '@aria/types'; then Inventory.Item, etc.
 */
export namespace Inventory {
  /**
   * Inventory item entity - matches the database schema
   * All fields are required in the database
   */
  export interface Item {
    /** Unique identifier (CUID) */
    id: string;
    /** Item name/title */
    name: string;
    /** Stock Keeping Unit - unique product code */
    sku: string;
    /** Current quantity in stock */
    quantity: number;
    /** When this item was created */
    createdAt: Date;
    /** When this item was last updated */
    updatedAt: Date;
  }

  /**
   * Input for creating a new inventory item
   * Only name and sku are required; quantity defaults to 0
   */
  export interface CreateInput {
    /** Item name (required) */
    name: string;
    /** Stock Keeping Unit (required) */
    sku: string;
    /** Initial quantity (optional, defaults to 0) */
    quantity?: number;
  }

  /**
   * Input for updating an existing inventory item
   * All fields except id are optional
   */
  export interface UpdateInput {
    /** Item ID to update (required) */
    id: string;
    /** New name (optional) */
    name?: string;
    /** New SKU (optional) */
    sku?: string;
    /** New quantity (optional) */
    quantity?: number;
  }

  // ============================================================================
  // Zod Schemas - Runtime Validation
  // ============================================================================

  /**
   * Validation schema for creating inventory items
   * Use with form validation or API input validation
   * @example
   * const result = Inventory.createSchema.parse(userInput);
   * if (result.success) { ... }
   */
  export const createSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255).trim(),
    sku: z.string().min(1, 'SKU is required').max(100).trim().toUpperCase(),
    quantity: z.number().int().min(0).default(0),
  });

  /**
   * Validation schema for updating inventory items
   * All fields are optional except id
   * @example
   * const result = Inventory.updateSchema.parse(updateData);
   */
  export const updateSchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1).max(255).trim().optional(),
    sku: z.string().min(1).max(100).trim().toUpperCase().optional(),
    quantity: z.number().int().min(0).optional(),
  });
}

// ============================================================================
// Product Domain Types
// ============================================================================

/**
 * Product entity - represents a product in the system
 * Simple, flat structure for easy understanding
 */
export interface Product {
  /** Unique product identifier */
  id: number;
  /** Product name/title */
  name: string;
  /** Product description */
  description: string;
  /** Product category */
  category: string;
  /** Price in currency units */
  price: number;
  /** URL to product photo */
  photo_url: string;
  /** ISO 8601 timestamp when created */
  created_at: string;
  /** ISO 8601 timestamp when last updated */
  updated_at: string;
}
