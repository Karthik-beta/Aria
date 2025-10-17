import { Injectable } from '@nestjs/common';
import { Inventory } from '@aria/types';
import { PrismaService } from '../../shared/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.inventoryItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: Inventory.CreateInput) {
    return this.prisma.inventoryItem.create({ data });
  }
}
