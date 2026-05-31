declare const trpcPrismaClientBrand: unique symbol;

export type TrpcRequestLike = {
	headers: Record<string, string | string[] | undefined>;
	[key: string]: unknown;
};

export type TrpcResponseLike = Record<string, unknown>;

export interface TrpcPrismaClient {
	readonly [trpcPrismaClientBrand]?: never;
}

export interface TrpcContextType {
	req?: TrpcRequestLike;
	res?: TrpcResponseLike;
	prisma: TrpcPrismaClient;
}
