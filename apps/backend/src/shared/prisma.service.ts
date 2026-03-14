import {
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { prismaClient } from "./prisma-client.js";

/**
 * PrismaService - NestJS Wrapper for Prisma v7 Client
 *
 * This service integrates the Prisma Client singleton with NestJS's dependency
 * injection system and lifecycle management.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                    WHY COMPOSITION OVER INHERITANCE?                        │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ In Prisma v6, it was common to extend PrismaClient:                         │
 * │   class PrismaService extends PrismaClient implements OnModuleInit { ... }  │
 * │                                                                             │
 * │ Prisma v7 requires driver adapters passed to the constructor, making        │
 * │ inheritance problematic. The composition pattern (wrapping) is now          │
 * │ preferred because:                                                          │
 * │   1. Allows adapter configuration in the shared module                      │
 * │   2. Enables the singleton pattern for connection pool management           │
 * │   3. Works seamlessly with Better Auth's database adapter                   │
 * │   4. Provides explicit control over which Prisma methods are exposed        │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * @example
 * // In a service
 * @Injectable()
 * class MyService {
 *   constructor(private readonly prisma: PrismaService) {}
 *
 *   async getUsers() {
 *     return this.prisma.user.findMany();
 *   }
 * }
 *
 * @see https://docs.nestjs.com/recipes/prisma
 * @see https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
	/**
	 * The underlying Prisma Client instance.
	 * Use this for advanced operations not exposed via property accessors.
	 */
	readonly client = prismaClient;

	// ═══════════════════════════════════════════════════════════════════════════
	// Model Accessors - Delegate to underlying client for convenient DI usage
	// ═══════════════════════════════════════════════════════════════════════════

	// Auth & User Management
	get user() {
		return this.client.user;
	}
	get session() {
		return this.client.session;
	}
	get account() {
		return this.client.account;
	}
	get verification() {
		return this.client.verification;
	}

	// Authorization (RBAC)
	get role() {
		return this.client.role;
	}
	get permission() {
		return this.client.permission;
	}
	get rolePermission() {
		return this.client.rolePermission;
	}
	get userRole() {
		return this.client.userRole;
	}

	// Multi-App & Teams
	get app() {
		return this.client.app;
	}
	get appSupervisor() {
		return this.client.appSupervisor;
	}
	get team() {
		return this.client.team;
	}
	get teamMember() {
		return this.client.teamMember;
	}
	get auditLog() {
		return this.client.auditLog;
	}

	// Inventory Domain
	get inventoryItem() {
		return this.client.inventoryItem;
	}
	get itemGroup() {
		return this.client.itemGroup;
	}
	get itemGroupDefault() {
		return this.client.itemGroupDefault;
	}
	get item() {
		return this.client.item;
	}
	get unitOfMeasurement() {
		return this.client.unitOfMeasurement;
	}
	get brand() {
		return this.client.brand;
	}
	get productBundle() {
		return this.client.productBundle;
	}
	get productBundleItem() {
		return this.client.productBundleItem;
	}
	get shippingRule() {
		return this.client.shippingRule;
	}
	get itemAlternate() {
		return this.client.itemAlternate;
	}
	get itemBarcode() {
		return this.client.itemBarcode;
	}
	get itemReorder() {
		return this.client.itemReorder;
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Transaction Support
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Delegate transaction method for multi-operation atomicity.
	 * @example
	 * await this.prisma.$transaction([
	 *   this.prisma.user.create({ data: userData }),
	 *   this.prisma.userRole.create({ data: roleData }),
	 * ]);
	 */
	$transaction = this.client.$transaction.bind(this.client);

	// ═══════════════════════════════════════════════════════════════════════════
	// NestJS Lifecycle Hooks
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Called when the NestJS module initializes.
	 * Establishes the database connection pool.
	 */
	async onModuleInit(): Promise<void> {
		await this.client.$connect();
	}

	/**
	 * Called when the NestJS application shuts down.
	 * Gracefully closes all database connections.
	 */
	async onModuleDestroy(): Promise<void> {
		await this.client.$disconnect();
	}
}
