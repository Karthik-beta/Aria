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
	get itemAttribute() {
		return this.client.itemAttribute;
	}
	get itemAttributeValue() {
		return this.client.itemAttributeValue;
	}
	get inventoryItemAttribute() {
		return this.client.inventoryItemAttribute;
	}
	get warehouse() {
		return this.client.warehouse;
	}
	get itemVariantSettings() {
		return this.client.itemVariantSettings;
	}
	get itemVariantSettingsField() {
		return this.client.itemVariantSettingsField;
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
	get itemManufacturer() {
		return this.client.itemManufacturer;
	}
	get itemBarcode() {
		return this.client.itemBarcode;
	}
	get itemReorder() {
		return this.client.itemReorder;
	}
	get materialRequest() {
		return this.client.materialRequest;
	}
	get materialRequestItem() {
		return this.client.materialRequestItem;
	}
	get stockEntry() {
		return this.client.stockEntry;
	}
	get stockEntryItem() {
		return this.client.stockEntryItem;
	}
	get deliveryNote() {
		return this.client.deliveryNote;
	}
	get deliveryNoteItem() {
		return this.client.deliveryNoteItem;
	}
	get installationNote() {
		return this.client.installationNote;
	}
	get installationNoteItem() {
		return this.client.installationNoteItem;
	}
	get purchaseReceipt() {
		return this.client.purchaseReceipt;
	}
	get purchaseReceiptItem() {
		return this.client.purchaseReceiptItem;
	}
	get purchaseReceiptTax() {
		return this.client.purchaseReceiptTax;
	}
	get salesOrder() {
		return this.client.salesOrder;
	}
	get salesOrderItem() {
		return this.client.salesOrderItem;
	}
	get purchaseOrder() {
		return this.client.purchaseOrder;
	}
	get purchaseOrderItem() {
		return this.client.purchaseOrderItem;
	}
	get pickList() {
		return this.client.pickList;
	}
	get pickListItem() {
		return this.client.pickListItem;
	}
	get serialNo() {
		return this.client.serialNo;
	}
	get serialNoHistory() {
		return this.client.serialNoHistory;
	}
	get deliveryTrip() {
		return this.client.deliveryTrip;
	}
	get deliveryTripStop() {
		return this.client.deliveryTripStop;
	}
	get packingSlip() {
		return this.client.packingSlip;
	}
	get packingSlipItem() {
		return this.client.packingSlipItem;
	}
	get stockSettings() {
		return this.client.stockSettings;
	}
	get qiParameterGroup() {
		return this.client.qiParameterGroup;
	}
	get qiParameter() {
		return this.client.qiParameter;
	}
	get qiTemplate() {
		return this.client.qiTemplate;
	}
	get qiTemplateItem() {
		return this.client.qiTemplateItem;
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
