import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "../../generated/prisma/client.js";
import { PolicyService } from "../policy.service";
import { PermissionService } from "../role-permission.service";
import { ScopeService } from "../scope.service";

describe("PolicyService", () => {
	let service: PolicyService;
	let mockPrisma: {
		user: { findUnique: jest.Mock };
		userRole: { findMany: jest.Mock };
	};
	let mockPermissionService: { matchesPattern: jest.Mock };
	let mockScopeService: {
		getSupervisedApps: jest.Mock;
		isTeamMember: jest.Mock;
		isTeamManager: jest.Mock;
		isInManagementHierarchy: jest.Mock;
	};
	let intervalHandle: NodeJS.Timeout;
	let setIntervalSpy: jest.SpyInstance;
	let clearIntervalSpy: jest.SpyInstance;
	let unrefMock: jest.Mock;

	beforeEach(async () => {
		mockPrisma = {
			user: {
				findUnique: jest.fn(),
			},
			userRole: {
				findMany: jest.fn(),
			},
		};

		mockPermissionService = {
			matchesPattern: jest.fn(),
		};

		mockScopeService = {
			getSupervisedApps: jest.fn(),
			isTeamMember: jest.fn(),
			isTeamManager: jest.fn(),
			isInManagementHierarchy: jest.fn(),
		};

		unrefMock = jest.fn();
		intervalHandle = { unref: unrefMock } as unknown as NodeJS.Timeout;
		setIntervalSpy = jest
			.spyOn(global, "setInterval")
			.mockReturnValue(intervalHandle);
		clearIntervalSpy = jest
			.spyOn(global, "clearInterval")
			.mockImplementation(jest.fn());

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PolicyService,
				{
					provide: PrismaClient,
					useValue: mockPrisma as unknown as PrismaClient,
				},
				{
					provide: PermissionService,
					useValue: mockPermissionService as unknown as PermissionService,
				},
				{
					provide: ScopeService,
					useValue: mockScopeService as unknown as ScopeService,
				},
			],
		}).compile();

		service = module.get<PolicyService>(PolicyService);
	});

	afterEach(() => {
		jest.clearAllMocks();
		setIntervalSpy.mockRestore();
		clearIntervalSpy.mockRestore();
	});

	describe("resolveUserPolicy", () => {
		it("should resolve user policy with roles and permissions", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				isActive: true,
			});

			mockPrisma.userRole.findMany.mockResolvedValue([
				{
					userId: "user1",
					appKey: "crm",
					role: {
						key: "manager",
						level: 5,
						rolePermissions: [
							{
								permission: {
									key: "entity:crm:lead.read",
								},
							},
							{
								permission: {
									key: "entity:crm:lead.update",
								},
							},
						],
					},
				},
			]);

			mockScopeService.getSupervisedApps.mockResolvedValue([]);

			const policy = await service.resolveUserPolicy("user1");

			expect(policy.userId).toBe("user1");
			expect(policy.isActive).toBe(true);
			expect(policy.roles).toHaveLength(1);
			expect(policy.roles[0].roleKey).toBe("manager");
			expect(policy.roles[0].level).toBe(5);
			expect(policy.permissions).toHaveLength(2);
			expect(policy.apps).toContain("crm");
		});

		it("should cache resolved policies", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
			mockPrisma.userRole.findMany.mockResolvedValue([]);
			mockScopeService.getSupervisedApps.mockResolvedValue([]);

			await service.resolveUserPolicy("user1");
			await service.resolveUserPolicy("user1");

			expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
		});

		it("should invalidate cache when requested", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
			mockPrisma.userRole.findMany.mockResolvedValue([]);
			mockScopeService.getSupervisedApps.mockResolvedValue([]);

			await service.resolveUserPolicy("user1");
			service.invalidateUserCache("user1");
			await service.resolveUserPolicy("user1");

			expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
		});
	});

	describe("can", () => {
		beforeEach(() => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
			mockPrisma.userRole.findMany.mockResolvedValue([
				{
					userId: "user1",
					appKey: "crm",
					role: {
						key: "manager",
						level: 5,
						rolePermissions: [
							{
								permission: { key: "entity:crm:lead.read" },
							},
						],
					},
				},
			]);
			mockScopeService.getSupervisedApps.mockResolvedValue([]);
		});

		it("should allow when user has exact permission", async () => {
			mockPermissionService.matchesPattern.mockReturnValue(true);

			const result = await service.can("user1", "entity:crm:lead.read");

			expect(result.allowed).toBe(true);
			expect(mockPermissionService.matchesPattern).toHaveBeenCalledWith(
				"entity:crm:lead.read",
				"entity:crm:lead.read",
			);
		});

		it("should deny when user lacks permission", async () => {
			mockPermissionService.matchesPattern.mockReturnValue(false);

			const result = await service.can("user1", "entity:crm:lead.delete");

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Missing permission");
		});

		it("should deny when user is inactive", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: false });

			const result = await service.can("user1", "entity:crm:lead.read");

			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("Account is not active");
		});

		it("should check ownership when context provided", async () => {
			mockPermissionService.matchesPattern.mockReturnValue(true);

			const result = await service.can("user1", "entity:crm:lead.update", {
				userId: "user1",
				resourceOwnerId: "user1",
			});

			expect(result.allowed).toBe(true);
		});

		it("should deny when not owner", async () => {
			mockPermissionService.matchesPattern.mockReturnValue(true);
			mockScopeService.isInManagementHierarchy.mockResolvedValue(false);

			const result = await service.can("user1", "entity:crm:lead.update", {
				userId: "user1",
				resourceOwnerId: "user2",
			});

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Not the owner or manager");
		});
	});

	describe("hasRole", () => {
		it("should return true when user has the role", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
			mockPrisma.userRole.findMany.mockResolvedValue([
				{
					userId: "user1",
					appKey: "crm",
					role: {
						key: "manager",
						level: 5,
						rolePermissions: [],
					},
				},
			]);
			mockScopeService.getSupervisedApps.mockResolvedValue([]);

			const result = await service.hasRole("user1", "manager", "crm");

			expect(result).toBe(true);
		});

		it("should return false when user does not have the role", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
			mockPrisma.userRole.findMany.mockResolvedValue([]);
			mockScopeService.getSupervisedApps.mockResolvedValue([]);

			const result = await service.hasRole("user1", "admin");

			expect(result).toBe(false);
		});
	});

	describe("hasAnyRole", () => {
		it("should return true when user has at least one role", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
			mockPrisma.userRole.findMany.mockResolvedValue([
				{
					userId: "user1",
					appKey: null,
					role: {
						key: "viewer",
						level: 1,
						rolePermissions: [],
					},
				},
			]);
			mockScopeService.getSupervisedApps.mockResolvedValue([]);

			const result = await service.hasAnyRole("user1", ["admin", "viewer"]);

			expect(result).toBe(true);
		});
	});

	describe("getUserMaxRoleLevel", () => {
		it("should return highest role level", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
			mockPrisma.userRole.findMany.mockResolvedValue([
				{
					userId: "user1",
					appKey: null,
					role: { key: "viewer", level: 1, rolePermissions: [] },
				},
				{
					userId: "user1",
					appKey: "crm",
					role: { key: "manager", level: 5, rolePermissions: [] },
				},
			]);
			mockScopeService.getSupervisedApps.mockResolvedValue([]);

			const level = await service.getUserMaxRoleLevel("user1");

			expect(level).toBe(5);
		});

		it("should return 0 when user has no roles", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
			mockPrisma.userRole.findMany.mockResolvedValue([]);
			mockScopeService.getSupervisedApps.mockResolvedValue([]);

			const level = await service.getUserMaxRoleLevel("user1");

			expect(level).toBe(0);
		});
	});

	describe("lifecycle", () => {
		it("clears cache cleanup interval on destroy", () => {
			service.onModuleDestroy();

			expect(unrefMock).toHaveBeenCalled();
			expect(clearIntervalSpy).toHaveBeenCalledWith(intervalHandle);
		});
	});
});
