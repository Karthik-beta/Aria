// biome-ignore-all lint/suspicious/noConfusingVoidType: tRPC no-input procedure declarations intentionally use void in this shared contract surface.
export declare const accountRouter: import("@trpc/server").TRPCBuiltRouter<
	{
		ctx: import("../trpc.context").TrpcContextType;
		meta: object;
		errorShape: import("@trpc/server").TRPCDefaultErrorShape;
		transformer: false;
	},
	import("@trpc/server").TRPCDecorateCreateRouterOptions<{
		markPasswordUpdated: import("@trpc/server").TRPCMutationProcedure<{
			input: void;
			output: {
				success: boolean;
			};
			meta: object;
		}>;
	}>
>;
