import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Inventory } from '@aria/types';
import { z } from 'zod';
import { PrismaService } from '../../shared/prisma.service';
import { toInventoryItem, toInventoryItemGroup } from './inventory.types';

/**
 * Simple inventory service with type-safe CRUD operations
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: {
        parentItemGroup: {
          select: { groupName: true },
        },
        defaults: true,
      },
      orderBy: { groupName: 'asc' },
    });

    return groups.map(toInventoryItemGroup);
  }

  /**
   * Get all units of measure
   */
  async findAllUnitsOfMeasure(
    search?: string,
  ): Promise<Inventory.UnitOfMeasure[]> {
    return this.prisma.unitOfMeasurement.findMany({
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
  }

  /**
   * Create a new item group
   */
  async createGroup(data: any): Promise<Inventory.ItemGroup> {
    const created = await this.prisma.itemGroup.create({
      data: {
        groupName: data.groupName,
        parentId: data.parentId,
        isGroup: data.isGroup,
        defaults: data.defaults
          ? {
              create: data.defaults.map((d: any) => ({
                company: d.company,
                defaultWarehouse: d.defaultWarehouse,
                defaultPriceList: d.defaultPriceList,
              })),
            }
          : undefined,
      },
      include: {
        parentItemGroup: {
          select: { groupName: true },
        },
        defaults: true,
      },
    });

    return toInventoryItemGroup(created as any);
  }

  /**
   * Update an item group
   */
  async updateGroup(data: any): Promise<Inventory.ItemGroup> {
    const { defaults, ...rest } = data;

    const updated = await this.prisma.itemGroup.update({
      where: { id: data.id },
      data: {
        ...(rest.groupName !== undefined && { groupName: rest.groupName }),
        ...(rest.parentId !== undefined && { parentId: rest.parentId }),
        ...(rest.isGroup !== undefined && { isGroup: rest.isGroup }),
        ...(defaults !== undefined && {
          defaults: {
            deleteMany: {},
            create: defaults.map((d: any) => ({
              company: d.company,
              defaultWarehouse: d.defaultWarehouse,
              defaultPriceList: d.defaultPriceList,
            })),
          },
        }),
      },
      include: {
        parentItemGroup: {
          select: { groupName: true },
        },
        defaults: true,
      },
    });

    return toInventoryItemGroup(updated as any);
  }

  /**
   * Delete an item group
   */
  async deleteGroup(id: string): Promise<{ success: boolean; id: string }> {
    await this.prisma.itemGroup.delete({
      where: { id },
    });
    return { success: true, id };
  }

  /**
   * Create a new inventory item
   */
  async create(
    data: z.infer<typeof Inventory.createSchema>,
  ): Promise<Inventory.Item> {
    try {
      const created = await this.prisma.inventoryItem.create({
        data,
        include: {
          itemGroup: true,
        },
      });

      return toInventoryItem(created);
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Item with code ${data.code} already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Update an existing inventory item
   */
  async update(
    data: z.infer<typeof Inventory.updateSchema>,
  ): Promise<Inventory.Item> {
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
