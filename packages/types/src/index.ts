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
   * Item Group entity - for categorizing items
   */
  export interface ItemGroup {
    /** Unique identifier (CUID) */
    id: string;
    /** Group name */
    groupName: string;
    /** Parent item group ID for hierarchy */
    parentId?: string | null;
    /** When this group was created */
    createdAt: Date;
    /** When this group was last updated */
    updatedAt: Date;
  }

  /**
   * Unit of Measurement entity
   */
  export interface UnitOfMeasure {
    /** Unique identifier (CUID) */
    id: string;
    /** Unit name (e.g., "Nos", "Kg", "Pcs") */
    name: string;
    /** Whether the unit represents whole numbers only */
    isWholeNumber: boolean;
    /** When this unit was created */
    createdAt: Date;
    /** When this unit was last updated */
    updatedAt: Date;
  }

  /**
   * Inventory item entity - matches the database schema
   * All fields are required in the database
   */
  export interface Item {
    /** Unique identifier (CUID) */
    id: string;
    /** Item name/title */
    name: string;
    /** Unique product code (formerly SKU) */
    code: string;
    /** Current quantity in stock */
    quantity: number;
    /** Item description */
    description?: string | null;
    /** Whether the item is disabled */
    disabled: boolean;
    /** Whether to maintain stock levels for this item */
    maintainStock: boolean;
    /** Whether alternate items are allowed */
    allowAlternateItem: boolean;
    /** Whether this item has variants */
    hasVariants: boolean;
    /** Opening stock quantity */
    openingStock: number;
    /** Valuation rate for inventory costing */
    valuationRate?: number | null;
    /** Standard selling rate */
    standardSellingRate?: number | null;
    /** Whether item is zero-rated for tax */
    isZeroRated: boolean;
    /** Whether item is tax exempt */
    isExempt: boolean;
    /** Whether item is a fixed asset */
    isFixedAsset: boolean;
    /** Tax code reference */
    taxCode?: string | null;
    /** Reference to item group */
    itemGroupId?: string | null;
    /** Item group name (populated from relation) */
    itemGroupName?: string | null;
    /** Reference to default unit of measure */
    defaultUnitOfMeasureId?: string | null;
    /** When this item was created */
    createdAt: Date;
    /** When this item was last updated */
    updatedAt: Date;
  }

  /**
   * Input for creating a new inventory item
   */
  export interface CreateInput {
    name: string;
    code: string;
    quantity?: number;
    description?: string;
    disabled?: boolean;
    maintainStock?: boolean;
    allowAlternateItem?: boolean;
    hasVariants?: boolean;
    openingStock?: number;
    valuationRate?: number;
    standardSellingRate?: number;
    isZeroRated?: boolean;
    isExempt?: boolean;
    isFixedAsset?: boolean;
    taxCode?: string;
    itemGroupId?: string;
    defaultUnitOfMeasureId?: string;
  }

  /**
   * Input for updating an existing inventory item
   */
  export interface UpdateInput {
    id: string;
    name?: string;
    code?: string;
    quantity?: number;
    description?: string;
    disabled?: boolean;
    maintainStock?: boolean;
    allowAlternateItem?: boolean;
    hasVariants?: boolean;
    openingStock?: number;
    valuationRate?: number;
    standardSellingRate?: number;
    isZeroRated?: boolean;
    isExempt?: boolean;
    isFixedAsset?: boolean;
    taxCode?: string;
    itemGroupId?: string;
    defaultUnitOfMeasureId?: string;
  }

  // ============================================================================
  // Zod Schemas - Runtime Validation
  // ============================================================================

  /**
   * Validation schema for creating inventory items
   */
  export const createSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255).trim(),
    code: z.string().min(1, 'Code is required').max(100).trim().toUpperCase(),
    quantity: z.number().int().min(0).default(0),
    description: z.string().max(1000).optional(),
    disabled: z.boolean().default(false),
    maintainStock: z.boolean().default(true),
    allowAlternateItem: z.boolean().default(false),
    hasVariants: z.boolean().default(false),
    openingStock: z.number().int().min(0).default(0),
    valuationRate: z.number().min(0).optional(),
    standardSellingRate: z.number().min(0).optional(),
    isZeroRated: z.boolean().default(false),
    isExempt: z.boolean().default(false),
    isFixedAsset: z.boolean().default(false),
    taxCode: z.string().max(50).optional(),
    itemGroupId: z.string().cuid().optional(),
    defaultUnitOfMeasureId: z.string().cuid().optional(),
  });

  /**
   * Validation schema for updating inventory items
   */
  export const updateSchema = z.object({
    id: z.cuid(),
    name: z.string().min(1).max(255).trim().optional(),
    code: z.string().min(1).max(100).trim().toUpperCase().optional(),
    quantity: z.number().int().min(0).optional(),
    description: z.string().max(1000).optional(),
    disabled: z.boolean().optional(),
    maintainStock: z.boolean().optional(),
    allowAlternateItem: z.boolean().optional(),
    hasVariants: z.boolean().optional(),
    openingStock: z.number().int().min(0).optional(),
    valuationRate: z.number().min(0).optional(),
    standardSellingRate: z.number().min(0).optional(),
    isZeroRated: z.boolean().optional(),
    isExempt: z.boolean().optional(),
    isFixedAsset: z.boolean().optional(),
    taxCode: z.string().max(50).optional(),
    itemGroupId: z.string().cuid().optional(),
    defaultUnitOfMeasureId: z.string().cuid().optional(),
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
