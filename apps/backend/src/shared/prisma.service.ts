import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prismaClient } from './prisma-client.js';

/**
 * PrismaService for NestJS dependency injection
 * 
 * Wraps the shared PrismaClient singleton to provide:
 * - NestJS lifecycle hooks (OnModuleInit, OnModuleDestroy)
 * - Convenient property accessors for all Prisma models
 * - Proper connection management
 * 
 * Uses composition pattern (wrapping) instead of inheritance
 * to work with Prisma 7's adapter-based initialization.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  // Expose the underlying Prisma client for direct access
  readonly client = prismaClient;

  // Delegate common Prisma methods for convenience
  get user() { return this.client.user; }
  get session() { return this.client.session; }
  get account() { return this.client.account; }
  get verification() { return this.client.verification; }
  get role() { return this.client.role; }
  get permission() { return this.client.permission; }
  get rolePermission() { return this.client.rolePermission; }
  get userRole() { return this.client.userRole; }
  get app() { return this.client.app; }
  get appSupervisor() { return this.client.appSupervisor; }
  get team() { return this.client.team; }
  get teamMember() { return this.client.teamMember; }
  get auditLog() { return this.client.auditLog; }
  get inventoryItem() { return this.client.inventoryItem; }
  get itemGroup() { return this.client.itemGroup; }
  get itemGroupDefault() { return this.client.itemGroupDefault; }
  get item() { return this.client.item; }
  get unitOfMeasurement() { return this.client.unitOfMeasurement; }
  get brand() { return this.client.brand; }
  get productBundle() { return this.client.productBundle; }
  get productBundleItem() { return this.client.productBundleItem; }
  get shippingRule() { return this.client.shippingRule; }
  get itemAlternate() { return this.client.itemAlternate; }

  // Delegate transaction method
  $transaction = this.client.$transaction.bind(this.client);

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

