import { Prisma } from '@prisma/client';
import { Inventory } from '@aria/types';

/**
 * Prisma model type for InventoryItem
 */
export type InventoryItem = Prisma.InventoryItemGetPayload<
  Record<string, never>
>;

/**
 * Converts a Prisma InventoryItem to Inventory.Item
 * This ensures type safety when mapping database models to API types
 */
export function toInventoryItem(prismaItem: InventoryItem): Inventory.Item {
  return {
    id: prismaItem.id,
    name: prismaItem.name,
    code: prismaItem.code,
    quantity: prismaItem.quantity,
    description: prismaItem.description,
    disabled: prismaItem.disabled,
    maintainStock: prismaItem.maintainStock,
    allowAlternateItem: prismaItem.allowAlternateItem,
    itemGroupId: prismaItem.itemGroupId,
    defaultUnitOfMeasureId: prismaItem.defaultUnitOfMeasureId,
    createdAt: prismaItem.createdAt,
    updatedAt: prismaItem.updatedAt,
  };
}

/**
 * Type guard to check if a value is a valid InventoryItem
 */
export function isInventoryItem(value: unknown): value is InventoryItem {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    'name' in value &&
    'code' in value &&
    'quantity' in value &&
    'createdAt' in value &&
    'updatedAt' in value
  );
}
