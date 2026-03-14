import type {
	TrpcContextType,
	TrpcPrismaClient,
	TrpcRequestLike,
	TrpcResponseLike,
} from "@aria/api-contract";
import { Injectable } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../shared/prisma.service";

export type { TrpcContextType, TrpcRequestLike, TrpcResponseLike };

declare module "@aria/api-contract" {
	interface TrpcPrismaClient
		extends Pick<
			PrismaService,
			| "role"
			| "user"
			| "userRole"
			| "rolePermission"
			| "teamMember"
			| "appSupervisor"
			| "app"
		> {}
}

@Injectable()
export class TrpcContext {
	constructor(public readonly prisma: PrismaService) {}

	/**
	 * Create context for tRPC Express adapter
	 *
	 * @param opts - Express request and response objects from tRPC adapter
	 * @returns Context object with req, res, and injected services
	 */
	create(opts: CreateExpressContextOptions): TrpcContextType {
		return {
			req: opts.req as unknown as TrpcRequestLike,
			res: opts.res as unknown as TrpcResponseLike,
			prisma: this.prisma satisfies TrpcPrismaClient,
		};
	}
}
