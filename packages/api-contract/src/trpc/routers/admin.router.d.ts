// biome-ignore-all lint/suspicious/noConfusingVoidType: tRPC no-input procedure declarations intentionally use void in this shared contract surface.
export declare const adminRouter: import("@trpc/server").TRPCBuiltRouter<
	{
		ctx: import("../trpc.context").TrpcContextType;
		meta: object;
		errorShape: import("@trpc/server").TRPCDefaultErrorShape;
		transformer: false;
	},
	import("@trpc/server").TRPCDecorateCreateRouterOptions<{
		listUsers: import("@trpc/server").TRPCQueryProcedure<{
			input: {
				page?: number | undefined;
				limit?: number | undefined;
				search?: string | undefined;
				isActive?: boolean | undefined;
			};
			output: {
				users: {
					email: string;
					id: string;
					createdAt: Date;
					name: string;
					username: string | null;
					department: string | null;
					displayName: string | null;
					mustChangePassword: boolean;
					passwordChangedAt: Date | null;
				}[];
				pagination: {
					page: number;
					limit: number;
					total: number;
					totalPages: number;
				};
			};
			meta: object;
		}>;
		getProvisioningContext: import("@trpc/server").TRPCQueryProcedure<{
			input: void;
			output: {
				canManageSystem: boolean;
				manageableAppKeys: string[];
				apps: {
					name: string;
					description: string | null;
					appKey: string;
				}[];
				defaultAppKey: string;
			};
			meta: object;
		}>;
		getUser: import("@trpc/server").TRPCQueryProcedure<{
			input: {
				userId: string;
			};
			output: {
				email: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				emailVerified: boolean;
				name: string;
				image: string | null;
				username: string | null;
				displayUsername: string | null;
				department: string | null;
				displayName: string | null;
				role: string;
				banned: boolean;
				banReason: string | null;
				banExpires: Date | null;
				managerId: string | null;
				mustChangePassword: boolean;
				passwordChangedAt: Date | null;
			};
			meta: object;
		}>;
		createUser: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				email: string;
				username: string;
				name: string;
				displayName?: string | undefined;
				department?: string | undefined;
				managerId?: string | undefined;
				passwordStrategy?: "auto" | "manual" | undefined;
				password?: string | undefined;
				providedPassword?: string | undefined;
				mustChangePassword?: boolean | undefined;
			};
			output: {
				user: {
					email: string;
					id: string;
					createdAt: Date;
					updatedAt: Date;
					emailVerified: boolean;
					name: string;
					image: string | null;
					username: string | null;
					displayUsername: string | null;
					department: string | null;
					displayName: string | null;
					role: string;
					banned: boolean;
					banReason: string | null;
					banExpires: Date | null;
					managerId: string | null;
					mustChangePassword: boolean;
					passwordChangedAt: Date | null;
				};
				generatedPassword: string | undefined;
				mustChangePassword: boolean;
			};
			meta: object;
		}>;
		checkUsernameAvailability: import("@trpc/server").TRPCQueryProcedure<{
			input: {
				username: string;
			};
			output: {
				available: boolean;
			};
			meta: object;
		}>;
		generateSecurePassword: import("@trpc/server").TRPCMutationProcedure<{
			input:
				| {
						length?: number | undefined;
				  }
				| undefined;
			output: {
				password: string;
			};
			meta: object;
		}>;
		sendPasswordReset: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
				redirectTo?: string | undefined;
			};
			output: {
				success: boolean;
			};
			meta: object;
		}>;
		updateUser: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
				name?: string | undefined;
				displayName?: string | undefined;
				department?: string | undefined;
				managerId?: string | undefined;
			};
			output: {
				email: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				emailVerified: boolean;
				name: string;
				image: string | null;
				username: string | null;
				displayUsername: string | null;
				department: string | null;
				displayName: string | null;
				role: string;
				banned: boolean;
				banReason: string | null;
				banExpires: Date | null;
				managerId: string | null;
				mustChangePassword: boolean;
				passwordChangedAt: Date | null;
			};
			meta: object;
		}>;
		disableUser: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
			};
			output: {
				email: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				emailVerified: boolean;
				name: string;
				image: string | null;
				username: string | null;
				displayUsername: string | null;
				department: string | null;
				displayName: string | null;
				role: string;
				banned: boolean;
				banReason: string | null;
				banExpires: Date | null;
				managerId: string | null;
				mustChangePassword: boolean;
				passwordChangedAt: Date | null;
			};
			meta: object;
		}>;
		enableUser: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
			};
			output: {
				email: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				emailVerified: boolean;
				name: string;
				image: string | null;
				username: string | null;
				displayUsername: string | null;
				department: string | null;
				displayName: string | null;
				role: string;
				banned: boolean;
				banReason: string | null;
				banExpires: Date | null;
				managerId: string | null;
				mustChangePassword: boolean;
				passwordChangedAt: Date | null;
			};
			meta: object;
		}>;
		deleteUser: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
			};
			output: {
				success: boolean;
			};
			meta: object;
		}>;
		listRoles: import("@trpc/server").TRPCQueryProcedure<{
			input: void;
			output: {
				key: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				name: string;
				description: string | null;
				level: number;
				isSystem: boolean;
			}[];
			meta: object;
		}>;
		getRole: import("@trpc/server").TRPCQueryProcedure<{
			input: {
				roleKey: string;
			};
			output: {
				key: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				name: string;
				description: string | null;
				level: number;
				isSystem: boolean;
			};
			meta: object;
		}>;
		listPermissions: import("@trpc/server").TRPCQueryProcedure<{
			input:
				| {
						scope?: "system" | "app" | "entity" | undefined;
				  }
				| undefined;
			output: {
				key: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				name: string;
				description: string | null;
			}[];
			meta: object;
		}>;
		getAuditLogs: import("@trpc/server").TRPCQueryProcedure<{
			input: {
				startDate?: Date | undefined;
				endDate?: Date | undefined;
				actorId?: string | undefined;
				userId?: string | undefined;
				action?: string | undefined;
				limit?: number | undefined;
			};
			output: {
				logs: {
					metadata: unknown;
					id: string;
					createdAt: Date;
					appKey: string | null;
					action: string;
					actorUserId: string | null;
					subjectType: string;
					subjectId: string | null;
				}[];
				total: number;
			};
			meta: object;
		}>;
	}>
>;
