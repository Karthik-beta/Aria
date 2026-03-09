import { Injectable, NotFoundException } from "@nestjs/common";
import type {
	Permission,
	Prisma,
	PrismaClient,
	Role,
} from "../generated/prisma/client.js";

/**
 * RoleService - CRUD operations for roles
 *
 * Responsibilities:
 * - Create, read, update, delete roles
 * - Manage role-permission mappings
 * - Seed and sync default roles
 * - Validate role operations (prevent system role deletion)
 *
 * @see AUTHORIZATION_SPEC.md - Role Model section
 */
@Injectable()
export class RoleService {
	constructor(private readonly prisma: PrismaClient) {}

	/**
	 * Get role by key
	 */
	async getRoleByKey(key: string): Promise<Role | null> {
		return this.prisma.role.findUnique({
			where: { key },
		});
	}

	/**
	 * Get role by ID
	 */
	async getRoleById(id: string): Promise<Role | null> {
		return this.prisma.role.findUnique({
			where: { id },
		});
	}

	/**
	 * List all roles with optional filtering
	 */
	async listRoles(filters?: {
		isSystem?: boolean;
		search?: string;
	}): Promise<Role[]> {
		const where: Prisma.RoleWhereInput = {};

		if (filters?.isSystem !== undefined) {
			where.isSystem = filters.isSystem;
		}

		if (filters?.search) {
			where.OR = [
				{ key: { contains: filters.search, mode: "insensitive" } },
				{ name: { contains: filters.search, mode: "insensitive" } },
			];
		}

		return this.prisma.role.findMany({
			where,
			orderBy: [{ level: "desc" }, { name: "asc" }],
		});
	}

	/**
	 * Create a new role
	 */
	async createRole(data: {
		key: string;
		name: string;
		description?: string;
		level: number;
		isSystem?: boolean;
	}): Promise<Role> {
		return this.prisma.role.create({
			data,
		});
	}

	/**
	 * Update a role
	 * System roles cannot have their key or isSystem flag changed
	 */
	async updateRole(
		id: string,
		data: {
			name?: string;
			description?: string;
			level?: number;
		},
	): Promise<Role> {
		const role = await this.getRoleById(id);
		if (!role) {
			throw new NotFoundException(`Role with ID ${id} not found`);
		}

		return this.prisma.role.update({
			where: { id },
			data,
		});
	}

	/**
	 * Delete a role
	 * System roles cannot be deleted
	 */
	async deleteRole(id: string): Promise<void> {
		const role = await this.getRoleById(id);
		if (!role) {
			throw new NotFoundException(`Role with ID ${id} not found`);
		}

		if (role.isSystem) {
			throw new Error("Cannot delete system roles");
		}

		await this.prisma.role.delete({
			where: { id },
		});
	}

	/**
	 * Get role with its permissions
	 */
	async getRoleWithPermissions(id: string) {
		return this.prisma.role.findUnique({
			where: { id },
			include: {
				rolePermissions: {
					include: {
						permission: true,
					},
				},
			},
		});
	}

	/**
	 * Assign permissions to a role
	 * Replaces existing permissions
	 */
	async assignPermissions(
		roleId: string,
		permissionIds: string[],
	): Promise<void> {
		// Delete existing mappings
		await this.prisma.rolePermission.deleteMany({
			where: { roleId },
		});

		// Create new mappings
		if (permissionIds.length > 0) {
			await this.prisma.rolePermission.createMany({
				data: permissionIds.map((permissionId) => ({
					roleId,
					permissionId,
				})),
			});
		}
	}

	/**
	 * Add permission to role (incremental)
	 */
	async addPermission(roleId: string, permissionId: string): Promise<void> {
		await this.prisma.rolePermission.create({
			data: {
				roleId,
				permissionId,
			},
		});
	}

	/**
	 * Remove permission from role
	 */
	async removePermission(roleId: string, permissionId: string): Promise<void> {
		await this.prisma.rolePermission.delete({
			where: {
				roleId_permissionId: {
					roleId,
					permissionId,
				},
			},
		});
	}

	/**
	 * Get all permissions for a role
	 */
	async getRolePermissions(roleId: string): Promise<Permission[]> {
		const rolePermissions = await this.prisma.rolePermission.findMany({
			where: { roleId },
			include: {
				permission: true,
			},
		});

		return rolePermissions.map((rp) => rp.permission);
	}
}

/**
 * PermissionService - CRUD operations for permissions
 *
 * Responsibilities:
 * - Create, read, update, delete permissions
 * - Permission key validation and normalization
 * - Generate permission types for type-safe guards
 *
 * @see AUTHORIZATION_SPEC.md - Permission taxonomy section
 */
@Injectable()
export class PermissionService {
	constructor(private readonly prisma: PrismaClient) {}

	/**
	 * Get permission by key
	 */
	async getPermissionByKey(key: string): Promise<Permission | null> {
		return this.prisma.permission.findUnique({
			where: { key },
		});
	}

	/**
	 * Get permission by ID
	 */
	async getPermissionById(id: string): Promise<Permission | null> {
		return this.prisma.permission.findUnique({
			where: { id },
		});
	}

	/**
	 * List all permissions with optional filtering
	 */
	async listPermissions(filters?: {
		scope?: "system" | "app" | "entity";
		appKey?: string;
		search?: string;
	}): Promise<Permission[]> {
		const where: Prisma.PermissionWhereInput = {};

		if (filters?.scope) {
			switch (filters.scope) {
				case "system":
					where.key = { startsWith: "system:" };
					break;
				case "app":
					where.key = { startsWith: "app:" };
					break;
				case "entity":
					where.key = { startsWith: "entity:" };
					break;
			}
		}

		if (filters?.appKey && filters.scope === "app") {
			where.key = { startsWith: `app:${filters.appKey}:` };
		}

		if (filters?.appKey && filters.scope === "entity") {
			where.key = { startsWith: `entity:${filters.appKey}:` };
		}

		if (filters?.search) {
			where.OR = [
				{ key: { contains: filters.search, mode: "insensitive" } },
				{ name: { contains: filters.search, mode: "insensitive" } },
			];
		}

		return this.prisma.permission.findMany({
			where,
			orderBy: { key: "asc" },
		});
	}

	/**
	 * Create a new permission
	 */
	async createPermission(data: {
		key: string;
		name: string;
		description?: string;
	}): Promise<Permission> {
		// Validate permission key format
		this.validatePermissionKey(data.key);

		return this.prisma.permission.create({
			data,
		});
	}

	/**
	 * Update a permission
	 */
	async updatePermission(
		id: string,
		data: {
			name?: string;
			description?: string;
		},
	): Promise<Permission> {
		const permission = await this.getPermissionById(id);
		if (!permission) {
			throw new NotFoundException(`Permission with ID ${id} not found`);
		}

		return this.prisma.permission.update({
			where: { id },
			data,
		});
	}

	/**
	 * Delete a permission
	 */
	async deletePermission(id: string): Promise<void> {
		const permission = await this.getPermissionById(id);
		if (!permission) {
			throw new NotFoundException(`Permission with ID ${id} not found`);
		}

		await this.prisma.permission.delete({
			where: { id },
		});
	}

	/**
	 * Validate permission key format
	 * Format: <scope>:<resource>.<action> or <scope>:*
	 *
	 * Examples:
	 * - system:*
	 * - system:user.manage
	 * - app:crm:config.update
	 * - entity:crm:lead.read
	 */
	private validatePermissionKey(key: string): void {
		const patterns = [
			/^system:\*$/,
			/^system:[a-z_]+\.[a-z_]+$/,
			/^app:[a-z_]+:\*$/,
			/^app:[a-z_]+:[a-z_]+\.[a-z_]+$/,
			/^entity:[a-z_]+:[a-z_]+\.[a-z_]+$/,
		];

		const isValid = patterns.some((pattern) => pattern.test(key));

		if (!isValid) {
			throw new Error(
				`Invalid permission key format: ${key}. Must match: system:*, system:resource.action, app:appKey:*, app:appKey:resource.action, or entity:appKey:entity.action`,
			);
		}
	}

	/**
	 * Parse permission key components
	 */
	parsePermissionKey(key: string): {
		scope: "system" | "app" | "entity";
		appKey?: string;
		resource?: string;
		action?: string;
		isWildcard: boolean;
	} {
		if (key === "system:*") {
			return { scope: "system", isWildcard: true };
		}

		if (key.startsWith("system:")) {
			const [, rest] = key.split(":");
			const [resource, action] = rest.split(".");
			return { scope: "system", resource, action, isWildcard: false };
		}

		if (key.startsWith("app:")) {
			const parts = key.split(":");
			const appKey = parts[1];
			const rest = parts[2];

			if (rest === "*") {
				return { scope: "app", appKey, isWildcard: true };
			}

			const [resource, action] = rest.split(".");
			return { scope: "app", appKey, resource, action, isWildcard: false };
		}

		if (key.startsWith("entity:")) {
			const parts = key.split(":");
			const appKey = parts[1];
			const rest = parts[2];
			const [resource, action] = rest.split(".");
			return { scope: "entity", appKey, resource, action, isWildcard: false };
		}

		throw new Error(`Cannot parse permission key: ${key}`);
	}

	/**
	 * Check if permission matches pattern (for wildcard permissions)
	 * e.g., system:* matches system:user.manage
	 */
	matchesPattern(permissionKey: string, pattern: string): boolean {
		if (pattern === "system:*") {
			// Allow super admins to satisfy any permission check with system wildcard
			return true;
		}

		if (pattern === permissionKey) {
			return true;
		}

		// Wildcard matching
		if (pattern.endsWith("*")) {
			const prefix = pattern.slice(0, -1);
			return permissionKey.startsWith(prefix);
		}

		return false;
	}
}
