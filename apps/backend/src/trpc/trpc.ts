import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "../auth/auth.config";
import type { TrpcContextType } from "./trpc.context";

/**
 * Initialize tRPC with Express context
 *
 * @remarks
 * Context type includes Express req/res plus injected services (Prisma)
 * This enables access to cookies, headers, and request state in procedures
 */
const t = initTRPC.context<TrpcContextType>().create();

/**
 * Extended context type with authenticated user
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

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const middleware = t.middleware;
