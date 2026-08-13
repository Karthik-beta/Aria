import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import type { TrpcContextType } from "../trpc.context.js";

type Organization = {
	id: string;
	name: string;
	slug: string;
};

type SessionFixture = {
	user: { id: string };
	session: {
		id: string;
		userId: string;
		expiresAt: Date;
		activeOrganizationId: string | null;
	};
};

type OrganizationFindUniqueArgs = {
	where?: { id?: string };
};

const ORGANIZATION_A: Organization = {
	id: "org-a",
	name: "Organization A",
	slug: "organization-a",
};
const ORGANIZATION_B: Organization = {
	id: "org-b",
	name: "Organization B",
	slug: "organization-b",
};
const USER_ID = "user-1";
const ASSET_CUID = "clh1234567890";
const MISSING_SCOPE_MESSAGE =
	"No active organization selected. Please select a workspace.";

let currentRole = "user";
let currentMember: { id: string; organizationId: string; role: string } | null =
	null;
let currentSession: SessionFixture | null = null;

const mockGetSession = mock(() => Promise.resolve(currentSession));
const mockPrismaOrganizationFindUnique = mock(
	(_args?: unknown): Promise<Organization | null> => Promise.resolve(null),
);
const mockPrismaOrganizationFindFirst = mock(
	(_args?: unknown): Promise<Organization | null> => Promise.resolve(null),
);
const mockPrismaMemberFindUnique = mock(
	(_args?: unknown): Promise<typeof currentMember> => Promise.resolve(null),
);
const mockPrismaUserFindUnique = mock(
	(_args?: unknown): Promise<{ id: string; role: string } | null> =>
		Promise.resolve(null),
);

const mockPrisma = {
	organization: {
		findUnique: mockPrismaOrganizationFindUnique,
		findFirst: mockPrismaOrganizationFindFirst,
	},
	member: {
		findUnique: mockPrismaMemberFindUnique,
	},
	user: {
		findUnique: mockPrismaUserFindUnique,
	},
};

type ProcedureCaller = (input?: unknown) => Promise<unknown>;
type AssetCaller = Record<string, ProcedureCaller>;

let organizationCaller: {
	organization: ProcedureCaller;
	adminOnly: ProcedureCaller;
};
let assetCaller: AssetCaller;
let mockAssetServiceCall: ReturnType<typeof mock>;
const restoreOverrides: Array<() => void> = [];

function overrideMethod(
	target: object,
	property: string,
	replacement: unknown,
): void {
	const originalDescriptor = Object.getOwnPropertyDescriptor(target, property);
	Object.defineProperty(target, property, {
		configurable: true,
		enumerable: originalDescriptor?.enumerable ?? true,
		writable: true,
		value: replacement,
	});

	restoreOverrides.push(() => {
		if (originalDescriptor) {
			Object.defineProperty(target, property, originalDescriptor);
		} else {
			Reflect.deleteProperty(target, property);
		}
	});
}

function createContext(): TrpcContextType {
	return {
		req: { headers: {} },
		res: {},
		prisma: mockPrisma as unknown as TrpcContextType["prisma"],
	};
}

function organizationIdFromArgs(args: unknown): string | undefined {
	if (typeof args !== "object" || args === null) {
		return undefined;
	}

	const where = (args as OrganizationFindUniqueArgs).where;
	return where?.id;
}

function setSession(role: string, activeOrganizationId: string | null): void {
	currentRole = role;
	currentSession = {
		user: { id: USER_ID },
		session: {
			id: "session-1",
			userId: USER_ID,
			expiresAt: new Date("2030-01-01T00:00:00.000Z"),
			activeOrganizationId,
		},
	};
}

function configureOrganizationLookup(organizations: Organization[]): void {
	mockPrismaOrganizationFindUnique.mockImplementation((args?: unknown) => {
		const organizationId = organizationIdFromArgs(args);
		return Promise.resolve(
			organizations.find(({ id }) => id === organizationId) ?? null,
		);
	});
	mockPrismaOrganizationFindFirst.mockImplementation(() =>
		Promise.resolve(organizations[0] ?? null),
	);
}

beforeAll(async () => {
	const { auth } = await import("../../auth/auth.config.js");
	const { prismaClient } = await import("../../shared/prisma-client.js");
	if (!auth.api) {
		Object.assign(auth, { api: { getSession: mockGetSession } });
	}
	if (!("organization" in prismaClient)) {
		Object.assign(prismaClient, mockPrisma);
	}
	overrideMethod(auth.api, "getSession", mockGetSession);
	overrideMethod(
		prismaClient.organization,
		"findUnique",
		mockPrismaOrganizationFindUnique,
	);
	overrideMethod(
		prismaClient.organization,
		"findFirst",
		mockPrismaOrganizationFindFirst,
	);
	overrideMethod(prismaClient.member, "findUnique", mockPrismaMemberFindUnique);
	overrideMethod(prismaClient.user, "findUnique", mockPrismaUserFindUnique);

	const { orgProcedure, router } = await import("../trpc.js");

	const probeRouter = router({
		organization: orgProcedure().query(({ ctx }) => ctx.organization),
		adminOnly: orgProcedure(["admin"]).query(({ ctx }) => ctx.orgMember),
	});
	organizationCaller = probeRouter.createCaller(
		createContext(),
	) as typeof organizationCaller;

	const { AssetRouter } = await import("../../apps/asset/trpc/asset.router.js");
	const eventEmitter = {
		emit: mock(() => undefined),
	} as unknown as ConstructorParameters<typeof AssetRouter>[0];
	mockAssetServiceCall = mock(() => Promise.resolve(null));
	const assetService = new Proxy({} as Record<string, unknown>, {
		get: () => mockAssetServiceCall,
	}) as unknown as ConstructorParameters<typeof AssetRouter>[1];
	const assetRouter = new AssetRouter(eventEmitter, assetService).getRouter();
	assetCaller = assetRouter.createCaller(
		createContext(),
	) as unknown as AssetCaller;
});

afterAll(() => {
	for (const restore of restoreOverrides.reverse()) {
		restore();
	}
});

beforeEach(() => {
	setSession("user", null);
	currentMember = null;
	mockGetSession.mockClear();
	mockPrismaOrganizationFindUnique.mockClear();
	mockPrismaOrganizationFindFirst.mockClear();
	mockPrismaMemberFindUnique.mockClear();
	mockPrismaUserFindUnique.mockClear();
	mockAssetServiceCall.mockClear();

	configureOrganizationLookup([]);
	mockPrismaUserFindUnique.mockImplementation(() =>
		Promise.resolve({ id: USER_ID, role: currentRole }),
	);
	mockPrismaMemberFindUnique.mockImplementation(() =>
		Promise.resolve(currentMember),
	);
});

describe("Organization scoped tRPC middleware", () => {
	it("uses the explicitly active organization for a super-admin", async () => {
		setSession("super_admin", ORGANIZATION_A.id);
		configureOrganizationLookup([ORGANIZATION_B, ORGANIZATION_A]);

		await expect(organizationCaller.organization()).resolves.toEqual(
			ORGANIZATION_A,
		);
		expect(mockPrismaOrganizationFindFirst).not.toHaveBeenCalled();
		expect(mockPrismaMemberFindUnique).not.toHaveBeenCalled();
	});

	it("rejects a super-admin with no active organization when organizations exist", async () => {
		setSession("super_admin", null);
		configureOrganizationLookup([ORGANIZATION_A, ORGANIZATION_B]);

		await expect(organizationCaller.organization()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: MISSING_SCOPE_MESSAGE,
		});
		expect(mockPrismaOrganizationFindUnique).not.toHaveBeenCalled();
		expect(mockPrismaOrganizationFindFirst).not.toHaveBeenCalled();
		expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
	});

	it("rejects a super-admin with no active organization when none exist", async () => {
		setSession("super_admin", null);
		configureOrganizationLookup([]);

		await expect(organizationCaller.organization()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: MISSING_SCOPE_MESSAGE,
		});
		expect(mockPrismaOrganizationFindUnique).not.toHaveBeenCalled();
		expect(mockPrismaOrganizationFindFirst).not.toHaveBeenCalled();
	});

	it("rejects a normal user with no active organization", async () => {
		setSession("user", null);
		configureOrganizationLookup([ORGANIZATION_A]);

		await expect(organizationCaller.organization()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: MISSING_SCOPE_MESSAGE,
		});
		expect(mockPrismaOrganizationFindUnique).not.toHaveBeenCalled();
		expect(mockPrismaMemberFindUnique).not.toHaveBeenCalled();
	});

	it("rejects a super-admin whose active organization no longer exists", async () => {
		setSession("super_admin", "org-missing");
		configureOrganizationLookup([ORGANIZATION_A, ORGANIZATION_B]);

		await expect(organizationCaller.organization()).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Active organization not found",
		});
		expect(mockPrismaOrganizationFindFirst).not.toHaveBeenCalled();
		expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
	});

	it("preserves regular-user membership and required-role checks", async () => {
		setSession("user", ORGANIZATION_A.id);
		configureOrganizationLookup([ORGANIZATION_A]);
		currentMember = {
			id: "member-1",
			organizationId: ORGANIZATION_A.id,
			role: "member",
		};

		await expect(organizationCaller.organization()).resolves.toEqual(
			ORGANIZATION_A,
		);
		await expect(organizationCaller.adminOnly()).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: 'Insufficient role in "organization-a". Required: admin',
		});

		currentMember = { ...currentMember, role: "admin" };
		await expect(organizationCaller.adminOnly()).resolves.toMatchObject({
			organizationId: ORGANIZATION_A.id,
			role: "admin",
		});
	});

	it("rejects representative Asset procedures before any Asset service call without active scope", async () => {
		setSession("super_admin", null);
		configureOrganizationLookup([ORGANIZATION_A, ORGANIZATION_B]);

		const procedures: Array<[string, unknown]> = [
			["listAssets", undefined],
			["onAssetsChanged", undefined],
			["onAssetValueAdjustmentsChanged", undefined],
			["onMaintenanceTeamsChanged", undefined],
			["onAssetMaintenancesChanged", undefined],
			["getAssetById", { id: ASSET_CUID }],
			["createAsset", { assetName: "Unscoped asset", companyId: ASSET_CUID }],
			["updateAsset", { id: ASSET_CUID }],
			["deleteAsset", { id: ASSET_CUID }],
			[
				"listFixedAssetRegisterReport",
				{
					fromDate: "2026-01-01T00:00:00.000Z",
					toDate: "2026-12-31T00:00:00.000Z",
					groupBy: "ASSET_CATEGORY",
				},
			],
			["submitAsset", { id: ASSET_CUID }],
		];

		for (const [procedure, input] of procedures) {
			await expect(assetCaller[procedure]?.(input)).rejects.toMatchObject({
				code: "UNAUTHORIZED",
				message: MISSING_SCOPE_MESSAGE,
			});
		}

		expect(mockAssetServiceCall).not.toHaveBeenCalled();
	});
});
