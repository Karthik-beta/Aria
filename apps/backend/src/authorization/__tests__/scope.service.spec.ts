import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../shared/prisma.service";
import { ScopeService } from "../scope.service";

type ScopePrismaMock = {
	appSupervisor: { findFirst: jest.Mock; findMany: jest.Mock };
	teamMember: { findFirst: jest.Mock; findMany: jest.Mock };
	team: { findFirst: jest.Mock; findMany: jest.Mock };
	user: { findUnique: jest.Mock; findMany: jest.Mock };
};

describe("ScopeService", () => {
	let service: ScopeService;
	let prismaMock: ScopePrismaMock;

	beforeEach(async () => {
		prismaMock = {
			appSupervisor: {
				findFirst: jest.fn(),
				findMany: jest.fn(),
			},
			teamMember: {
				findFirst: jest.fn(),
				findMany: jest.fn(),
			},
			team: {
				findFirst: jest.fn(),
				findMany: jest.fn(),
			},
			user: {
				findUnique: jest.fn(),
				findMany: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ScopeService,
				{
					provide: PrismaService,
					useValue: prismaMock as unknown as PrismaService,
				},
			],
		}).compile();

		service = module.get(ScopeService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("returns true when user supervises app", async () => {
		prismaMock.appSupervisor.findFirst.mockResolvedValue({
			id: "supervision-1",
		});

		const result = await service.isSupervisorOf("user-1", "crm");

		expect(result).toBe(true);
		expect(prismaMock.appSupervisor.findFirst).toHaveBeenCalledWith({
			where: { supervisorUserId: "user-1", appKey: "crm" },
		});
	});

	it("returns false when user does not supervise app", async () => {
		prismaMock.appSupervisor.findFirst.mockResolvedValue(null);

		const result = await service.isSupervisorOf("user-1", "crm");

		expect(result).toBe(false);
	});

	it("checks team membership", async () => {
		prismaMock.teamMember.findFirst.mockResolvedValue({ id: "membership-1" });

		const result = await service.isTeamMember("user-1", "team-1");

		expect(result).toBe(true);
		expect(prismaMock.teamMember.findFirst).toHaveBeenCalledWith({
			where: { userId: "user-1", teamId: "team-1" },
		});
	});

	it("checks team manager status", async () => {
		prismaMock.team.findFirst.mockResolvedValue({ id: "team-1" });

		const result = await service.isTeamManager("user-1", "team-1");

		expect(result).toBe(true);
		expect(prismaMock.team.findFirst).toHaveBeenCalledWith({
			where: { id: "team-1", managerUserId: "user-1" },
		});
	});

	it("returns filtered user teams by app context", async () => {
		prismaMock.teamMember.findMany.mockResolvedValue([
			{ teamId: "team-1" },
			{ teamId: "team-2" },
		]);

		const result = await service.getUserTeams("user-1", "crm");

		expect(result).toEqual(["team-1", "team-2"]);
		expect(prismaMock.teamMember.findMany).toHaveBeenCalledWith({
			where: {
				userId: "user-1",
				team: { appKey: "crm" },
			},
			select: { teamId: true },
		});
	});

	it("returns managed teams by app context", async () => {
		prismaMock.team.findMany.mockResolvedValue([{ id: "team-1" }]);

		const result = await service.getManagedTeams("user-1", "crm");

		expect(result).toEqual(["team-1"]);
		expect(prismaMock.team.findMany).toHaveBeenCalledWith({
			where: { managerUserId: "user-1", appKey: "crm" },
			select: { id: true },
		});
	});

	it("detects manager hierarchy relationships", async () => {
		prismaMock.user.findUnique
			.mockResolvedValueOnce({ managerId: "manager-1" })
			.mockResolvedValueOnce({ managerId: "director-1" })
			.mockResolvedValueOnce({ managerId: null });

		const result = await service.isInManagementHierarchy(
			"manager-1",
			"employee-1",
		);

		expect(result).toBe(true);
	});

	it("returns false when hierarchy chain terminates", async () => {
		prismaMock.user.findUnique
			.mockResolvedValueOnce({ managerId: "other-manager" })
			.mockResolvedValueOnce({ managerId: null });

		const result = await service.isInManagementHierarchy(
			"manager-1",
			"employee-1",
		);

		expect(result).toBe(false);
	});

	it("returns direct subordinates when includeIndirect is false", async () => {
		prismaMock.user.findMany.mockResolvedValue([{ id: "employee-1" }]);

		const result = await service.getSubordinates("manager-1");

		expect(result).toEqual(["employee-1"]);
		expect(prismaMock.user.findMany).toHaveBeenCalledWith({
			where: { managerId: "manager-1" },
			select: { id: true },
		});
	});

	it("returns indirect subordinates when includeIndirect is true", async () => {
		prismaMock.user.findMany
			.mockResolvedValueOnce([{ id: "employee-1" }])
			.mockResolvedValueOnce([{ id: "employee-2" }])
			.mockResolvedValueOnce([]);

		const result = await service.getSubordinates("manager-1", true);

		expect(result).toEqual(["employee-1", "employee-2"]);
		expect(prismaMock.user.findMany).toHaveBeenCalledTimes(3);
	});

	it("returns supervised apps", async () => {
		prismaMock.appSupervisor.findMany.mockResolvedValue([
			{ appKey: "crm" },
			{ appKey: "inventory" },
		]);

		const result = await service.getSupervisedApps("user-1");

		expect(result).toEqual(["crm", "inventory"]);
		expect(prismaMock.appSupervisor.findMany).toHaveBeenCalledWith({
			where: { supervisorUserId: "user-1" },
			select: { appKey: true },
		});
	});

	it("computes team scope summary for app", async () => {
		prismaMock.teamMember.findMany.mockResolvedValue([{ teamId: "team-1" }]);
		prismaMock.team.findMany.mockResolvedValue([{ id: "team-2" }]);

		const result = await service.getTeamScopeForApp("user-1", "crm");

		expect(result).toEqual({
			teamIds: ["team-1"],
			managedTeamIds: ["team-2"],
			isManager: true,
		});
	});
});
