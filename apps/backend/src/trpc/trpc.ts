import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "../auth/auth.config";
import { prismaClient } from "../shared/prisma-client";
import type { TrpcContextType } from "./trpc.context";

const prisma = prismaClient;

/**
 * Mapping from NestJS exception class names to tRPC error codes.
 * Used by the errorFormatter to preserve proper HTTP status codes.
 */
const NESTJS_TO_TRPC_CODE: Record<string, TRPCError["code"]> = {
	BadRequestException: "BAD_REQUEST",
	NotFoundException: "NOT_FOUND",
	ConflictException: "CONFLICT",
	ForbiddenException: "FORBIDDEN",
	UnauthorizedException: "UNAUTHORIZED",
};

/**
 * Initialize tRPC with Express context and error formatting.
 *
 * @remarks
 * The errorFormatter maps NestJS HTTP exceptions (caught by errorBridgeMiddleware)
 * to proper tRPC error codes so the frontend receives correct HTTP status codes
 * instead of generic INTERNAL_SERVER_ERROR.
 *
 * @see https://trpc.io/docs/server/error-formatting
 */
const t = initTRPC.context<TrpcContextType>().create({
	errorFormatter({ shape, error }) {
		if (error.cause instanceof HttpException) {
			const trpcCode = NESTJS_TO_TRPC_CODE[error.cause.constructor.name];
			if (trpcCode) {
				return {
					...shape,
					data: {
						...shape.data,
						code: trpcCode,
						httpStatus: error.cause.getStatus(),
					},
				};
			}
		}
		return shape;
	},
});

/**
 * Extended context type with authenticated user and organization membership
 */
export type ProtectedContext = TrpcContextType & {
	user: {
		id: string;
		email: string;
		emailVerified: boolean;
		name: string;
		createdAt: Date;
		updatedAt: Date;
		image?: string | null;
		username?: string | null;
		displayUsername?: string | null;
		role?: string | null;
		banned?: boolean;
		banReason?: string | null;
		banExpires?: Date | null;
	};
	session: {
		id: string;
		userId: string;
		expiresAt: Date;
		ipAddress?: string;
		userAgent?: string;
		activeOrganizationId?: string | null;
	};
};

/**
 * Organization membership context added by requireOrgMembership middleware
 */
export type OrgProtectedContext = ProtectedContext & {
	orgMember: {
		memberId: string;
		organizationId: string;
		role: string;
	};
	organization: {
		id: string;
		name: string;
		slug: string;
	};
};

/**
 * Middleware that catches NestJS HTTP exceptions thrown by services
 * and wraps them in TRPCError with the correct tRPC error code.
 *
 * Without this middleware, NestJS exceptions bubble up unhandled through tRPC
 * and become generic INTERNAL_SERVER_ERROR (500) responses, losing the original
 * HTTP status code and error category.
 */
const errorBridgeMiddleware = t.middleware(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		if (error instanceof HttpException) {
			const trpcCode = NESTJS_TO_TRPC_CODE[error.constructor.name];
			if (trpcCode) {
				throw new TRPCError({
					code: trpcCode,
					message: error.message,
					cause: error,
				});
			}
		}
		throw error;
	}
});

/**
 * Middleware to verify user is authenticated
 */
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
	const { req } = ctx;

	if (!req) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "No request context",
		});
	}

	// Normalize headers into fetch HeadersInit
	const normalizedHeaders = new Headers();
	for (const [key, value] of Object.entries<string | string[] | undefined>(
		req.headers ?? {},
	)) {
		if (value === undefined) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const headerValue of value) {
				normalizedHeaders.append(key, headerValue);
			}
			continue;
		}

		normalizedHeaders.append(key, value);
	}

	// Get session from better-auth
	const session = await auth.api.getSession({
		headers: normalizedHeaders,
	});

	if (!session) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
	}

	// Add user and session to context at top level
	return next({
		ctx: {
			...ctx,
			user: session.user,
			session: session.session,
		},
	});
});

/**
 * Middleware factory to verify org membership.
 *
 * Resolves the active organization from the session's activeOrganizationId
 * (set via better-auth's setActiveOrganization), then verifies the user is a
 * member of that organization with the required roles.
 *
 * @see https://www.better-auth.com/docs/plugins/organization#active-organization
 *
 * @param requiredRoles - Optional list of roles required for access
 */
function requireOrgMembership(requiredRoles?: string[]) {
	return t.middleware(async ({ ctx, next }) => {
		const protectedCtx = ctx as ProtectedContext;
		const userId = protectedCtx.user?.id;
		const activeOrganizationId = protectedCtx.session?.activeOrganizationId;

		if (!userId) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "User not authenticated",
			});
		}

		// Super admins bypass organization checks entirely. Resolve the first
		// available organization for context consistency; if none exists, inject
		// a minimal placeholder so downstream procedures don't crash.
		const globalUser = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});
		const isSuperAdmin = globalUser?.role === "super_admin";

		if (isSuperAdmin) {
			let organization = activeOrganizationId
				? await prisma.organization.findUnique({
						where: { id: activeOrganizationId },
						select: { id: true, name: true, slug: true },
					})
				: await prisma.organization.findFirst({
						select: { id: true, name: true, slug: true },
						orderBy: { createdAt: "asc" },
					});

			if (!organization) {
				organization = {
					id: "__super_admin__",
					name: "Super Admin",
					slug: "super-admin",
				};
			}

			return next({
				ctx: {
					...ctx,
					orgMember: null,
					organization,
				} as unknown as OrgProtectedContext,
			});
		}

		if (!activeOrganizationId) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "No active organization selected. Please select a workspace.",
			});
		}

		const organization = await prisma.organization.findUnique({
			where: { id: activeOrganizationId },
			select: { id: true, name: true, slug: true },
		});

		if (!organization) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Active organization not found",
			});
		}

		const member = await prisma.member.findUnique({
			where: {
				organizationId_userId: {
					organizationId: organization.id,
					userId,
				},
			},
			select: { id: true, organizationId: true, role: true },
		});

		if (!member) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Not a member of "${organization.slug}"`,
			});
		}

		if (requiredRoles && !requiredRoles.includes(member.role)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Insufficient role in "${organization.slug}". Required: ${requiredRoles.join(" or ")}`,
			});
		}

		return next({
			ctx: {
				...ctx,
				orgMember: member,
				organization,
			} as unknown as OrgProtectedContext,
		});
	});
}

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure
	.use(errorBridgeMiddleware)
	.use(isAuthenticated);

/**
 * Create a procedure that requires org membership.
 *
 * Resolves the active organization from the session's activeOrganizationId
 * (set via better-auth's setActiveOrganization). The caller no longer needs
 * to provide a hardcoded org slug.
 *
 * @see https://www.better-auth.com/docs/plugins/organization#active-organization
 *
 * @param requiredRoles - Optional roles (defaults to any member)
 */
export function orgProcedure(requiredRoles?: string[]) {
	return t.procedure
		.use(errorBridgeMiddleware)
		.use(isAuthenticated)
		.use(requireOrgMembership(requiredRoles));
}

export const middleware = t.middleware;
