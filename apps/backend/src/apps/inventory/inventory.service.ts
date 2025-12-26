import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Inventory } from '@aria/types';
import { PrismaService } from '../../shared/prisma.service';
import { toInventoryItem } from './inventory.types';

/**
 * Simple inventory service with type-safe CRUD operations
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get all inventory items
   */
  async findAll(): Promise<Inventory.Item[]> {
    const items = await this.prisma.inventoryItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        itemGroup: true,
      },
    });

    return items.map(toInventoryItem);
  }

  /**
   * Get all item groups with optional search
   */
  async findAllItemGroups(search?: string): Promise<Inventory.ItemGroup[]> {
    const groups = await this.prisma.itemGroup.findMany({
      where: search
        ? {
          groupName: {
            contains: search,
            mode: 'insensitive',
          },
        }
        : undefined,
      orderBy: { groupName: 'asc' },
    });

    return groups.map((group) => ({
      id: group.id,
      groupName: group.groupName,
      parentId: group.parentId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));
  }

  /**
   * Get all units of measure with optional search
   */
  async findAllUnitsOfMeasure(search?: string): Promise<Inventory.UnitOfMeasure[]> {
    const units = await this.prisma.unitOfMeasurement.findMany({
      where: search
        ? {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        }
        : undefined,
      orderBy: { name: 'asc' },
    });

    return units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      isWholeNumber: unit.isWholeNumber,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    }));
  }


  /**
   * Create a new inventory item
   */
  async create(data: Inventory.CreateInput): Promise<Inventory.Item> {
    const {
      name,
      code,
      quantity = 0,
      description,
      disabled,
      maintainStock,
      allowAlternateItem,
      hasVariants,
      openingStock,
      valuationRate,
      standardSellingRate,
      isZeroRated,
      isExempt,
      isFixedAsset,
      taxCode,
      itemGroupId,
      defaultUnitOfMeasureId,
    } = data;

    // Check if Code already exists
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Item with code ${code} already exists`);
    }

    // Create the item
    const created = await this.prisma.inventoryItem.create({
      data: {
        name,
        code,
        quantity,
        description,
        disabled,
        maintainStock,
        allowAlternateItem,
        hasVariants,
        openingStock,
        valuationRate,
        standardSellingRate,
        isZeroRated,
        isExempt,
        isFixedAsset,
        taxCode,
        itemGroupId,
        defaultUnitOfMeasureId,
      },
      include: {
        itemGroup: true,
      },
    });

    return toInventoryItem(created);
  }

  /**
   * Update an inventory item
   */
  async update(data: Inventory.UpdateInput): Promise<Inventory.Item> {
    const {
      id,
      name,
      code,
      quantity,
      description,
      disabled,
      maintainStock,
      allowAlternateItem,
      hasVariants,
      openingStock,
      valuationRate,
      standardSellingRate,
      isZeroRated,
      isExempt,
      isFixedAsset,
      taxCode,
      itemGroupId,
      defaultUnitOfMeasureId,
    } = data;

    // Check if item exists
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    // Update the item
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(quantity !== undefined && { quantity }),
        ...(description !== undefined && { description }),
        ...(disabled !== undefined && { disabled }),
        ...(maintainStock !== undefined && { maintainStock }),
        ...(allowAlternateItem !== undefined && { allowAlternateItem }),
        ...(hasVariants !== undefined && { hasVariants }),
        ...(openingStock !== undefined && { openingStock }),
        ...(valuationRate !== undefined && { valuationRate }),
        ...(standardSellingRate !== undefined && { standardSellingRate }),
        ...(isZeroRated !== undefined && { isZeroRated }),
        ...(isExempt !== undefined && { isExempt }),
        ...(isFixedAsset !== undefined && { isFixedAsset }),
        ...(taxCode !== undefined && { taxCode }),
        ...(itemGroupId !== undefined && { itemGroupId }),
        ...(defaultUnitOfMeasureId !== undefined && { defaultUnitOfMeasureId }),
      },
      include: {
        itemGroup: true,
      },
    });

    return toInventoryItem(updated);
  }

  /**
   * Delete an inventory item
   */
  async delete(id: string): Promise<Inventory.Item> {
    try {
      const deleted = await this.prisma.inventoryItem.delete({
        where: { id },
        include: {
          itemGroup: true,
        },
      });

      return toInventoryItem(deleted);
    } catch (error) {
      // Use Prisma's typed error class for better type safety
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Item with ID ${id} not found`);
      }
      throw error;
    }
  }
}
