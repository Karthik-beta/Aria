import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import type { PrismaService } from "../shared/prisma.service";

/**
 * AuditService - Tamper-evident logging for authorization changes
 *
 * Responsibilities:
 * - Log all user lifecycle events (create, update, disable, delete)
 * - Log role/permission assignments and revocations
 * - Log supervisor assignments
 * - Append-only write pattern (no updates or deletes)
 *
 * @see AUTHORIZATION_SPEC.md - Audit & Logging section
 */
@Injectable()
export class AuditService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Generic audit log creation method
	 *
	 * @param params - Audit log parameters
	 * @param params.actorUserId - User who performed the action
	 * @param params.action - Action type (e.g., user.created, role.assigned)
	 * @param params.subjectType - Entity type affected (user, role, permission, etc.)
	 * @param params.subjectId - ID of the affected entity
	 * @param params.appKey - Related app context (optional)
	 * @param params.metadata - Additional context (old values, new values, etc.)
	 */
	async log({
		actorUserId,
		action,
		subjectType,
		subjectId,
		appKey,
		metadata,
	}: {
		actorUserId?: string;
		action: string;
		subjectType: string;
		subjectId?: string;
		appKey?: string;
		metadata?: Record<string, unknown>;
	}): Promise<void> {
		const normalizedMetadata = metadata as Prisma.InputJsonValue | undefined;

		await this.prisma.auditLog.create({
			data: {
				actorUserId,
				action,
				subjectType,
				subjectId,
				appKey,
				metadata: normalizedMetadata,
			},
		});
	}

	/**
	 * Log user creation event
	 */
	async logUserCreated(
		actorUserId: string,
		createdUserId: string,
		metadata?: Record<string, unknown>,
	): Promise<void> {
		await this.log({
			actorUserId,
			action: "user.created",
			subjectType: "user",
			subjectId: createdUserId,
			metadata,
		});
	}

	/**
	 * Log user update event
	 */
	async logUserUpdated(
		actorUserId: string,
		updatedUserId: string,
		changes: Record<string, unknown>,
	): Promise<void> {
		await this.log({
			actorUserId,
			action: "user.updated",
			subjectType: "user",
			subjectId: updatedUserId,
			metadata: { changes },
		});
	}

	/**
	 * Log user disable/enable event
	 */
	async logUserStatusChanged(
		actorUserId: string,
		targetUserId: string,
		isActive: boolean,
		reason?: string,
	): Promise<void> {
		await this.log({
			actorUserId,
			action: isActive ? "user.enabled" : "user.disabled",
			subjectType: "user",
			subjectId: targetUserId,
			metadata: { isActive, reason },
		});
	}

	/**
	 * Log user deletion event
	 */
	async logUserDeleted(
		actorUserId: string,
		deletedUserId: string,
		reason?: string,
	): Promise<void> {
		await this.log({
			actorUserId,
			action: "user.deleted",
			subjectType: "user",
			subjectId: deletedUserId,
			metadata: { reason },
		});
	}

	/**
	 * Log role assignment event
	 */
	async logRoleAssigned(
		actorUserId: string,
		targetUserId: string,
		roleKey: string,
		appKey?: string,
	): Promise<void> {
		await this.log({
			actorUserId,
			action: "role.assigned",
			subjectType: "user_role",
			subjectId: targetUserId,
			appKey,
			metadata: { roleKey, appKey },
		});
	}

	/**
	 * Log role revocation event
	 */
	async logRoleRevoked(
		actorUserId: string,
		targetUserId: string,
		roleKey: string,
		appKey?: string,
	): Promise<void> {
		await this.log({
			actorUserId,
			action: "role.revoked",
			subjectType: "user_role",
			subjectId: targetUserId,
			appKey,
			metadata: { roleKey, appKey },
		});
	}

	/**
	 * Log supervisor assignment event
	 */
	async logSupervisorAssigned(
		actorUserId: string,
		supervisorUserId: string,
		appKey: string,
	): Promise<void> {
		await this.log({
			actorUserId,
			action: "supervisor.assigned",
			subjectType: "app_supervisor",
			subjectId: supervisorUserId,
			appKey,
			metadata: { appKey },
		});
	}

	/**
	 * Log supervisor revocation event
	 */
	async logSupervisorRevoked(
		actorUserId: string,
		supervisorUserId: string,
		appKey: string,
	): Promise<void> {
		await this.log({
			actorUserId,
			action: "supervisor.revoked",
			subjectType: "app_supervisor",
			subjectId: supervisorUserId,
			appKey,
			metadata: { appKey },
		});
	}

	/**
	 * Query audit logs with filtering
	 */
	async queryLogs(filters: {
		actorUserId?: string;
		action?: string;
		subjectType?: string;
		subjectId?: string;
		appKey?: string;
		fromDate?: Date;
		toDate?: Date;
		limit?: number;
		offset?: number;
	}) {
		const {
			actorUserId,
			action,
			subjectType,
			subjectId,
			appKey,
			fromDate,
			toDate,
			limit = 50,
			offset = 0,
		} = filters;

		const where: Prisma.AuditLogWhereInput = {};
		if (actorUserId) where.actorUserId = actorUserId;
		if (action) where.action = action;
		if (subjectType) where.subjectType = subjectType;
		if (subjectId) where.subjectId = subjectId;
		if (appKey) where.appKey = appKey;
		if (fromDate || toDate) {
			where.createdAt = {};
			if (fromDate) where.createdAt.gte = fromDate;
			if (toDate) where.createdAt.lte = toDate;
		}

		const [logs, total] = await Promise.all([
			this.prisma.auditLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				take: limit,
				skip: offset,
			}),
			this.prisma.auditLog.count({ where }),
		]);

		return {
			logs,
			total,
			limit,
			offset,
		};
	}
}
