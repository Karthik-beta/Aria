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
				appKey?: string | undefined;
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
					isActive: boolean;
					mustChangePassword: boolean;
					passwordChangedAt: Date | null;
					supervisedApps: ({
						app: {
							createdAt: Date;
							updatedAt: Date;
							name: string;
							isActive: boolean;
							description: string | null;
							appKey: string;
						};
					} & {
						id: string;
						createdAt: Date;
						appKey: string;
						supervisorUserId: string;
						createdBy: string | null;
					})[];
					userRoles: ({
						role: {
							key: string;
							id: string;
							createdAt: Date;
							updatedAt: Date;
							name: string;
							description: string | null;
							level: number;
							isSystem: boolean;
						};
					} & {
						id: string;
						createdAt: Date;
						userId: string;
						appKey: string | null;
						roleId: string;
						assignedBy: string | null;
					})[];
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
				supervisedApps: ({
					app: {
						createdAt: Date;
						updatedAt: Date;
						name: string;
						isActive: boolean;
						description: string | null;
						appKey: string;
					};
				} & {
					id: string;
					createdAt: Date;
					appKey: string;
					supervisorUserId: string;
					createdBy: string | null;
				})[];
				teamMemberships: ({
					team: {
						id: string;
						createdAt: Date;
						updatedAt: Date;
						name: string;
						appKey: string;
						managerUserId: string | null;
					};
				} & {
					id: string;
					createdAt: Date;
					userId: string;
					teamId: string;
				})[];
				managedTeams: {
					id: string;
					name: string;
				}[];
				userRoles: ({
					role: {
						rolePermissions: ({
							permission: {
								key: string;
								id: string;
								createdAt: Date;
								updatedAt: Date;
								name: string;
								description: string | null;
							};
						} & {
							roleId: string;
							permissionId: string;
						})[];
					} & {
						key: string;
						id: string;
						createdAt: Date;
						updatedAt: Date;
						name: string;
						description: string | null;
						level: number;
						isSystem: boolean;
					};
				} & {
					id: string;
					createdAt: Date;
					userId: string;
					appKey: string | null;
					roleId: string;
					assignedBy: string | null;
				})[];
				manager: {
					email: string;
					id: string;
					name: string;
					displayName: string | null;
				} | null;
				subordinates: {
					email: string;
					id: string;
					name: string;
					displayName: string | null;
				}[];
			} & {
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
				isActive: boolean;
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
				roleKeys?: string[] | undefined;
				appKey?: string | undefined;
				passwordStrategy?: "auto" | "manual" | undefined;
				password?: string | undefined;
				providedPassword?: string | undefined;
				mustChangePassword?: boolean | undefined;
			};
			output: {
				user: {
					userRoles: ({
						role: {
							key: string;
							id: string;
							createdAt: Date;
							updatedAt: Date;
							name: string;
							description: string | null;
							level: number;
							isSystem: boolean;
						};
					} & {
						id: string;
						createdAt: Date;
						userId: string;
						appKey: string | null;
						roleId: string;
						assignedBy: string | null;
					})[];
				} & {
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
					isActive: boolean;
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
				appKey?: string | undefined;
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
				appKey?: string | undefined;
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
				isActive: boolean;
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
				isActive: boolean;
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
				isActive: boolean;
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
		assignRole: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
				roleKey: string;
				appKey?: string | undefined;
			};
			output: {
				id: string;
				createdAt: Date;
				userId: string;
				appKey: string | null;
				roleId: string;
				assignedBy: string | null;
			};
			meta: object;
		}>;
		revokeRole: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
				roleKey: string;
				appKey?: string | undefined;
			};
			output: {
				success: boolean;
			};
			meta: object;
		}>;
		assignSupervisor: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
				appKey: string;
			};
			output: {
				id: string;
				createdAt: Date;
				appKey: string;
				supervisorUserId: string;
				createdBy: string | null;
			};
			meta: object;
		}>;
		revokeSupervisor: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				userId: string;
				appKey: string;
			};
			output: {
				success: boolean;
			};
			meta: object;
		}>;
		listRoles: import("@trpc/server").TRPCQueryProcedure<{
			input: void;
			output: ({
				rolePermissions: ({
					permission: {
						key: string;
						id: string;
						createdAt: Date;
						updatedAt: Date;
						name: string;
						description: string | null;
					};
				} & {
					roleId: string;
					permissionId: string;
				})[];
			} & {
				key: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				name: string;
				description: string | null;
				level: number;
				isSystem: boolean;
			})[];
			meta: object;
		}>;
		getRole: import("@trpc/server").TRPCQueryProcedure<{
			input: {
				roleKey: string;
			};
			output: {
				rolePermissions: ({
					permission: {
						key: string;
						id: string;
						createdAt: Date;
						updatedAt: Date;
						name: string;
						description: string | null;
					};
				} & {
					roleId: string;
					permissionId: string;
				})[];
			} & {
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
		createRole: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				key: string;
				name: string;
				level: number;
				description?: string | undefined;
				isSystem?: boolean | undefined;
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
		updateRole: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				roleKey: string;
				name?: string | undefined;
				description?: string | undefined;
				level?: number | undefined;
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
		deleteRole: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				roleKey: string;
			};
			output: {
				success: boolean;
			};
			meta: object;
		}>;
		assignPermissionToRole: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				roleKey: string;
				permissionKey: string;
			};
			output: {
				success: boolean;
			};
			meta: object;
		}>;
		removePermissionFromRole: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				roleKey: string;
				permissionKey: string;
			};
			output: {
				success: boolean;
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
				scope: "system" | "app" | "entity";
				key: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				name: string;
				description: string | null;
			}[];
			meta: object;
		}>;
		getPermission: import("@trpc/server").TRPCQueryProcedure<{
			input: {
				permissionKey: string;
			};
			output: {
				key: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				name: string;
				description: string | null;
			};
			meta: object;
		}>;
		createPermission: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				key: string;
				name: string;
				scope: "system" | "app" | "entity";
				description?: string | undefined;
			};
			output: {
				key: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				name: string;
				description: string | null;
			};
			meta: object;
		}>;
		updatePermission: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				permissionKey: string;
				name?: string | undefined;
				description?: string | undefined;
			};
			output: {
				key: string;
				id: string;
				createdAt: Date;
				updatedAt: Date;
				name: string;
				description: string | null;
			};
			meta: object;
		}>;
		deletePermission: import("@trpc/server").TRPCMutationProcedure<{
			input: {
				permissionKey: string;
			};
			output: {
				success: boolean;
			};
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
				limit: number;
				offset: number;
			};
			meta: object;
		}>;
	}>
>;
