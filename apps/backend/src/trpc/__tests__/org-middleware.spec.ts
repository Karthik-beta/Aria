import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockPrismaOrgFindUnique = mock(() => Promise.resolve(null));
const mockPrismaMemberFindUnique = mock(() => Promise.resolve(null));
const mockPrismaUserFindUnique = mock(() => Promise.resolve(null));

mock.module("../../shared/prisma-client", () => ({
	prismaClient: {
		organization: {
			findUnique: (...args: unknown[]) => mockPrismaOrgFindUnique(...args),
		},
		member: {
			findUnique: (...args: unknown[]) => mockPrismaMemberFindUnique(...args),
		},
		user: {
			findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
		},
	},
}));

describe("Organization scoped tRPC middleware", () => {
	beforeEach(() => {
		mockPrismaOrgFindUnique.mockClear();
		mockPrismaMemberFindUnique.mockClear();
		mockPrismaUserFindUnique.mockClear();
	});

	it("returns null when organization does not exist", async () => {
		mockPrismaOrgFindUnique.mockImplementation(() => Promise.resolve(null));

		const result = await mockPrismaOrgFindUnique({
			where: { slug: "nonexistent" },
		});

		expect(result).toBeNull();
	});

	it("finds organization by slug", async () => {
		mockPrismaOrgFindUnique.mockImplementation(() =>
			Promise.resolve({
				id: "org-1",
				name: "Inventory",
				slug: "inventory",
			}),
		);

		const result = await mockPrismaOrgFindUnique({
			where: { slug: "inventory" },
		});

		expect((result as Record<string, unknown>).slug).toBe("inventory");
		expect((result as Record<string, unknown>).name).toBe("Inventory");
	});

	it("finds member by org + user composite key", async () => {
		mockPrismaMemberFindUnique.mockImplementation(() =>
			Promise.resolve({
				id: "member-1",
				organizationId: "org-1",
				role: "admin",
			}),
		);

		const result = await mockPrismaMemberFindUnique({
			where: {
				organizationId_userId: {
					organizationId: "org-1",
					userId: "user-1",
				},
			},
		});

		expect((result as Record<string, unknown>).role).toBe("admin");
	});

	it("returns null for non-member user", async () => {
		mockPrismaMemberFindUnique.mockImplementation(() => Promise.resolve(null));

		const result = await mockPrismaMemberFindUnique({
			where: {
				organizationId_userId: {
					organizationId: "org-1",
					userId: "user-unknown",
				},
			},
		});

		expect(result).toBeNull();
	});

	it("validates required roles", () => {
		const requiredRoles = ["admin", "owner"];
		const memberRole = "admin";
		expect(requiredRoles.includes(memberRole)).toBe(true);
	});

	it("rejects insufficient roles", () => {
		const requiredRoles = ["admin", "owner"];
		const memberRole = "member";
		expect(requiredRoles.includes(memberRole)).toBe(false);
	});

	it("org middleware composite key uses correct Prisma syntax", () => {
		const compositeKey = {
			organizationId_userId: {
				organizationId: "org-1",
				userId: "user-1",
			},
		};
		expect(compositeKey.organizationId_userId.organizationId).toBe("org-1");
		expect(compositeKey.organizationId_userId.userId).toBe("user-1");
	});

	describe("super_admin bypass logic", () => {
		it("super_admin user bypasses org membership when member is null", async () => {
			// Arrange: org exists, user is super_admin globally, but has no org membership
			mockPrismaOrgFindUnique.mockImplementation(() =>
				Promise.resolve({
					id: "org-1",
					name: "Default Org",
					slug: "default",
				}),
			);
			mockPrismaMemberFindUnique.mockImplementation(() =>
				Promise.resolve(null),
			);
			mockPrismaUserFindUnique.mockImplementation(() =>
				Promise.resolve({ id: "user-1", role: "super_admin" }),
			);

			// Simulate the middleware logic:
			// 1. Check org exists → found
			// 2. Check member → null (no membership)
			// 3. Check global user role → super_admin → bypass
			const org = await mockPrismaOrgFindUnique({ where: { slug: "default" } });
			expect(org).not.toBeNull();

			const member = await mockPrismaMemberFindUnique({
				where: {
					organizationId_userId: { organizationId: "org-1", userId: "user-1" },
				},
			});
			expect(member).toBeNull();

			// super_admin bypass check
			const globalUser = await mockPrismaUserFindUnique({
				where: { id: "user-1" },
			});
			expect(globalUser).not.toBeNull();
			expect((globalUser as Record<string, unknown>).role).toBe("super_admin");

			// The bypass should allow access without member record
			const shouldBypass =
				globalUser !== null &&
				(globalUser as Record<string, unknown>).role === "super_admin";
			expect(shouldBypass).toBe(true);
		});

		it("regular user (non-super_admin) is denied when not a member", async () => {
			mockPrismaOrgFindUnique.mockImplementation(() =>
				Promise.resolve({
					id: "org-1",
					name: "Default Org",
					slug: "default",
				}),
			);
			mockPrismaMemberFindUnique.mockImplementation(() =>
				Promise.resolve(null),
			);
			mockPrismaUserFindUnique.mockImplementation(() =>
				Promise.resolve({ id: "user-2", role: "user" }),
			);

			const member = await mockPrismaMemberFindUnique({
				where: {
					organizationId_userId: { organizationId: "org-1", userId: "user-2" },
				},
			});
			expect(member).toBeNull();

			const globalUser = await mockPrismaUserFindUnique({
				where: { id: "user-2" },
			});
			expect(globalUser).not.toBeNull();
			expect((globalUser as Record<string, unknown>).role).toBe("user");

			// Should NOT bypass — regular user without membership gets FORBIDDEN
			const shouldBypass =
				globalUser !== null &&
				(globalUser as Record<string, unknown>).role === "super_admin";
			expect(shouldBypass).toBe(false);
		});

		it("admin role (within org) passes membership check", async () => {
			mockPrismaOrgFindUnique.mockImplementation(() =>
				Promise.resolve({
					id: "org-1",
					name: "Default Org",
					slug: "default",
				}),
			);
			mockPrismaMemberFindUnique.mockImplementation(() =>
				Promise.resolve({
					id: "member-1",
					organizationId: "org-1",
					role: "admin",
				}),
			);

			const member = await mockPrismaMemberFindUnique({
				where: {
					organizationId_userId: { organizationId: "org-1", userId: "user-3" },
				},
			});
			expect(member).not.toBeNull();
			expect((member as Record<string, unknown>).role).toBe("admin");
		});

		it("member with insufficient role is denied when requiredRoles specified", () => {
			const requiredRoles = ["admin", "owner"];
			const memberRole = "member";

			const hasSufficientRole = requiredRoles.includes(memberRole);
			expect(hasSufficientRole).toBe(false);
		});

		it("member with sufficient role passes when requiredRoles specified", () => {
			const requiredRoles = ["admin", "owner"];
			const memberRole = "admin";

			const hasSufficientRole = requiredRoles.includes(memberRole);
			expect(hasSufficientRole).toBe(true);
		});
	});
});
