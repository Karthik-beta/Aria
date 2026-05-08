import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "../auth/auth.config";
import { prismaClient } from "../shared/prisma-client";
import type { TrpcContextType } from "./trpc.context";

const prisma = prismaClient;

/**
 * Initialize tRPC with Express context
 *
 * @remarks
 * Context type includes Express req/res plus injected services (Prisma)
 * This enables access to cookies, headers, and request state in procedures
 */
const t = initTRPC.context<TrpcContextType>().create();

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
 * @param orgSlug - The slug of the organization to check membership in
 * @param requiredRoles - Optional list of roles required for access
 */
function requireOrgMembership(orgSlug: string, requiredRoles?: string[]) {
	return t.middleware(async ({ ctx, next }) => {
		const protectedCtx = ctx as ProtectedContext;
		const userId = protectedCtx.user?.id;

		if (!userId) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "User not authenticated",
			});
		}

		const organization = await prisma.organization.findUnique({
			where: { slug: orgSlug },
			select: { id: true, name: true, slug: true },
		});

		if (!organization) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: `Organization "${orgSlug}" not found`,
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
			// Bypass org membership check for super_admin global role
			const globalUser = await prisma.user.findUnique({
				where: { id: userId },
				select: { role: true },
			});
			if (globalUser?.role === "super_admin") {
				return next({
					ctx: {
						...ctx,
						orgMember: null,
						organization,
					} as unknown as OrgProtectedContext,
				});
			}

			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Not a member of "${orgSlug}"`,
			});
		}

		if (requiredRoles && !requiredRoles.includes(member.role)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Insufficient role in "${orgSlug}". Required: ${requiredRoles.join(" or ")}`,
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
export const protectedProcedure = t.procedure.use(isAuthenticated);

/**
 * Create a procedure that requires org membership.
 *
 * @param orgSlug - The org slug to check
 * @param requiredRoles - Optional roles (defaults to any member)
 */
export function orgProcedure(orgSlug: string, requiredRoles?: string[]) {
	return t.procedure
		.use(isAuthenticated)
		.use(requireOrgMembership(orgSlug, requiredRoles));
}

export const middleware = t.middleware;
