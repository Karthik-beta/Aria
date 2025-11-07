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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all inventory items
   */
  async findAll(): Promise<Inventory.Item[]> {
    const items = await this.prisma.inventoryItem.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return items.map(toInventoryItem);
  }

  /**
   * Create a new inventory item
   */
  async create(data: Inventory.CreateInput): Promise<Inventory.Item> {
    const { name, sku, quantity = 0 } = data;

    // Check if SKU already exists
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { sku },
    });

    if (existing) {
      throw new ConflictException(`Item with SKU ${sku} already exists`);
    }

    // Create the item
    const created = await this.prisma.inventoryItem.create({
      data: { name, sku, quantity },
    });

    return toInventoryItem(created);
  }

  /**
   * Update an inventory item
   */
  async update(data: Inventory.UpdateInput): Promise<Inventory.Item> {
    const { id, name, sku, quantity } = data;

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
        ...(sku !== undefined && { sku }),
        ...(quantity !== undefined && { quantity }),
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
