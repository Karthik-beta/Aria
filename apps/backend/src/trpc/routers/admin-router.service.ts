import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

@Injectable()
export class AdminRouter {
	getRouter() {
		return router({
			listUsers: publicProcedure
				.input(
					z.object({
						page: z.number().optional(),
						limit: z.number().optional(),
						search: z.string().optional(),
						isActive: z.boolean().optional(),
					}),
				)
				.query(() => {
					return {
						users: [],
						pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
					};
				}),
			getUser: publicProcedure
				.input(z.object({ userId: z.string() }))
				.query(() => {
					throw new Error("Not implemented");
				}),
			createUser: publicProcedure
				.input(
					z.object({
						email: z.string(),
						username: z.string(),
						name: z.string(),
					}),
				)
				.mutation(() => {
					throw new Error("Not implemented");
				}),
			checkUsernameAvailability: publicProcedure
				.input(z.object({ username: z.string() }))
				.query(() => {
					return { available: true };
				}),
			generateSecurePassword: publicProcedure
				.input(z.object({ length: z.number().optional() }).optional())
				.mutation(() => {
					return { password: "" };
				}),
			sendPasswordReset: publicProcedure
				.input(
					z.object({ userId: z.string(), redirectTo: z.string().optional() }),
				)
				.mutation(() => {
					return { success: false };
				}),
			updateUser: publicProcedure
				.input(
					z.object({
						userId: z.string(),
						name: z.string().optional(),
						displayName: z.string().optional(),
						department: z.string().optional(),
						managerId: z.string().optional(),
					}),
				)
				.mutation(() => {
					throw new Error("Not implemented");
				}),
			disableUser: publicProcedure
				.input(z.object({ userId: z.string() }))
				.mutation(() => {
					throw new Error("Not implemented");
				}),
			enableUser: publicProcedure
				.input(z.object({ userId: z.string() }))
				.mutation(() => {
					throw new Error("Not implemented");
				}),
			deleteUser: publicProcedure
				.input(z.object({ userId: z.string() }))
				.mutation(() => {
					return { success: false };
				}),
			listRoles: publicProcedure.query(() => {
				return [];
			}),
			getRole: publicProcedure
				.input(z.object({ roleKey: z.string() }))
				.query(() => {
					throw new Error("Not implemented");
				}),
			listPermissions: publicProcedure
				.input(
					z
						.object({ scope: z.enum(["system", "app", "entity"]).optional() })
						.optional(),
				)
				.query(() => {
					return [];
				}),
			getAuditLogs: publicProcedure
				.input(
					z.object({
						startDate: z.date().optional(),
						endDate: z.date().optional(),
						actorId: z.string().optional(),
						userId: z.string().optional(),
						action: z.string().optional(),
						limit: z.number().optional(),
					}),
				)
				.query(() => {
					return { logs: [], total: 0 };
				}),
			getProvisioningContext: publicProcedure.query(() => {
				return {
					canManageSystem: false,
					manageableAppKeys: [],
					apps: [],
					defaultAppKey: "",
				};
			}),
		});
	}
}
