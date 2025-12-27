import { Prisma } from '@prisma/client';
import { Inventory } from '@aria/types';

/**
 * Prisma model type for InventoryItem with optional relations
 */
export type InventoryItem = Prisma.InventoryItemGetPayload<{
  include: {
    itemGroup: true;
  };
}>;

/**
 * Prisma model type for ItemGroup with relations
 */
export type InventoryItemGroup = Prisma.ItemGroupGetPayload<{
  include: {
    parentItemGroup: {
      select: { groupName: true };
    };
    defaults: true;
  };
}>;

/**
 * Converts a Prisma ItemGroup to Inventory.ItemGroup
 */
export function toInventoryItemGroup(
  prismaGroup: InventoryItemGroup,
): Inventory.ItemGroup {
  return {
    id: prismaGroup.id,
    groupName: prismaGroup.groupName,
    parentId: prismaGroup.parentId,
    parentGroupName: prismaGroup.parentItemGroup?.groupName ?? null,
    isGroup: prismaGroup.isGroup,
    defaults: prismaGroup.defaults.map((d: any) => ({
      id: d.id,
      company: d.company,
      defaultWarehouse: d.defaultWarehouse,
      defaultPriceList: d.defaultPriceList,
    })),
    createdAt: prismaGroup.createdAt,
    updatedAt: prismaGroup.updatedAt,
  };
}

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
    hasVariants: prismaItem.hasVariants,
    openingStock: prismaItem.openingStock,
    valuationRate: prismaItem.valuationRate,
    standardSellingRate: prismaItem.standardSellingRate,
    isZeroRated: prismaItem.isZeroRated,
    isExempt: prismaItem.isExempt,
    isFixedAsset: prismaItem.isFixedAsset,
    taxCode: prismaItem.taxCode,
    itemGroupId: prismaItem.itemGroupId,
    itemGroupName: prismaItem.itemGroup?.groupName ?? null,
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
