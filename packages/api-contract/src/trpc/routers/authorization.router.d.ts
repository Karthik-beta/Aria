// biome-ignore-all lint/suspicious/noConfusingVoidType: tRPC no-input procedure declarations intentionally use void in this shared contract surface.
export declare const authorizationRouter: import("@trpc/server").TRPCBuiltRouter<
	{
		ctx: import("../trpc.context").TrpcContextType;
		meta: object;
		errorShape: import("@trpc/server").TRPCDefaultErrorShape;
		transformer: false;
	},
	import("@trpc/server").TRPCDecorateCreateRouterOptions<{
		getUserAuthorization: import("@trpc/server").TRPCQueryProcedure<{
			input: void;
			output: {
				roles: string[];
				permissions: string[];
				apps: Record<
					string,
					{
						roles: string[];
					}
				>;
				supervisedApps: string[];
				isActive: boolean;
			};
			meta: object;
		}>;
	}>
>;
