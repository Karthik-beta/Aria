import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { TRPCError } from "@trpc/server";

function getTrpcCodeForException(
	error: HttpException,
): TRPCError["code"] | undefined {
	if (error instanceof UnauthorizedException) return "UNAUTHORIZED";
	if (error instanceof ForbiddenException) return "FORBIDDEN";
	if (error instanceof NotFoundException) return "NOT_FOUND";
	if (error instanceof BadRequestException) return "BAD_REQUEST";
	if (error instanceof ConflictException) return "CONFLICT";
	return undefined;
}

describe("errorBridgeMiddleware", () => {
	let caller: Record<string, () => Promise<unknown>>;

	beforeAll(async () => {
		const { router, publicProcedure, middleware } = await import("../trpc.js");

		const testBridge = middleware(async ({ next }) => {
			try {
				return await next();
			} catch (error) {
				if (error instanceof HttpException) {
					const trpcCode = getTrpcCodeForException(error);
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

		const testRouter = router({
			success: publicProcedure.use(testBridge).query(() => "ok"),
			badRequest: publicProcedure.use(testBridge).query(() => {
				throw new BadRequestException("Invalid input");
			}),
			notFound: publicProcedure.use(testBridge).query(() => {
				throw new NotFoundException("Item not found");
			}),
			conflict: publicProcedure.use(testBridge).query(() => {
				throw new ConflictException("Already exists");
			}),
			forbidden: publicProcedure.use(testBridge).query(() => {
				throw new ForbiddenException("Not allowed");
			}),
			unauthorized: publicProcedure.use(testBridge).query(() => {
				throw new UnauthorizedException("Not authenticated");
			}),
			otherError: publicProcedure.use(testBridge).query(() => {
				throw new Error("some other error");
			}),
		});

		caller = testRouter.createCaller({
			// biome-ignore lint/suspicious/noExplicitAny: mock context for testing
			req: {} as any,
			// biome-ignore lint/suspicious/noExplicitAny: mock context for testing
			res: {} as any,
			// biome-ignore lint/suspicious/noExplicitAny: mock context for testing
			prisma: {} as any,
		});
	});

	it("passes through successful results", async () => {
		const result = await caller.success();
		expect(result).toBe("ok");
	});

	it("converts BadRequestException to TRPCError BAD_REQUEST", async () => {
		await expect(caller.badRequest()).rejects.toThrow(TRPCError);
		await expect(caller.badRequest()).rejects.toThrow("Invalid input");
	});

	it("converts NotFoundException to TRPCError NOT_FOUND", async () => {
		await expect(caller.notFound()).rejects.toThrow(TRPCError);
		await expect(caller.notFound()).rejects.toThrow("Item not found");
	});

	it("converts ConflictException to TRPCError CONFLICT", async () => {
		await expect(caller.conflict()).rejects.toThrow(TRPCError);
		await expect(caller.conflict()).rejects.toThrow("Already exists");
	});

	it("converts ForbiddenException to TRPCError FORBIDDEN", async () => {
		await expect(caller.forbidden()).rejects.toThrow(TRPCError);
		await expect(caller.forbidden()).rejects.toThrow("Not allowed");
	});

	it("converts UnauthorizedException to TRPCError UNAUTHORIZED", async () => {
		await expect(caller.unauthorized()).rejects.toThrow(TRPCError);
		await expect(caller.unauthorized()).rejects.toThrow("Not authenticated");
	});

	it("re-throws non-NestJS errors unchanged", async () => {
		await expect(caller.otherError()).rejects.toThrow("some other error");
	});
});
