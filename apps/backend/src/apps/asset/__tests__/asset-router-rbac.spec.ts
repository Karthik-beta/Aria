import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import { TRPCError } from "@trpc/server";
import { auth } from "../../../auth/auth.config";
import { prismaClient } from "../../../shared/prisma-client";
import { AssetRouter } from "../trpc/asset.router";

let memberRole = "member";

const delegateStubs = {
	user: { findUnique: () => Promise.resolve({ role: "user" }) },
	organization: {
		findUnique: () =>
			Promise.resolve({ id: "org-1", name: "Org", slug: "org" }),
	},
	member: {
		findUnique: () =>
			Promise.resolve({
				id: "member-1",
				organizationId: "org-1",
				role: memberRole,
			}),
	},
};

const svc = new Proxy(
	{},
	{ get: () => mock(() => Promise.resolve({ data: [], total: 0 })) },
);
const eventEmitter = { emit: mock(() => true) };
const cancellationPreview = {
	canCancel: true,
	blockers: [],
	postedEntryCount: 0,
	postedDepreciationTotal: 0,
	latestPostingDate: null,
	entries: [],
};
const assetCore = {
	getAssetCancellationPreview: mock(() => Promise.resolve(cancellationPreview)),
};

function caller() {
	return new AssetRouter(
		eventEmitter as never,
		svc as never,
		assetCore as never,
	)
		.getRouter()
		.createCaller({ req: { headers: {} } } as never);
}

async function expectForbidden(promise: Promise<unknown>) {
	const error = await promise.then(
		() => null,
		(caught: unknown) => caught,
	);
	expect(error).toBeInstanceOf(TRPCError);
	expect((error as TRPCError).code).toBe("FORBIDDEN");
}

const newAsset = { assetName: "Laptop" } as never;
const assetId = { id: "ckxxxxxxxxxxxxxxxxxxxxxxx" } as never;

describe("Asset router role-based access", () => {
	// The org middleware reads the shared auth and Prisma singletons, so stub
	// them in place instead of replacing modules other spec files also load.
	// Prisma 7 model delegates ignore spies on their methods, so the delegates
	// themselves are swapped for the duration of this suite. The client's own
	// property descriptors don't hold the delegates, so the values read through
	// the client are what get put back.
	let getSessionSpy: ReturnType<typeof spyOn>;
	const originalDelegates = new Map<string, unknown>();

	function setDelegate(key: string, value: unknown) {
		Object.defineProperty(prismaClient, key, {
			value,
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}

	beforeAll(() => {
		getSessionSpy = spyOn(auth.api, "getSession").mockImplementation((() =>
			Promise.resolve({
				user: { id: "user-1" },
				session: { id: "session-1", activeOrganizationId: "org-1" },
			})) as never);
		for (const [key, stub] of Object.entries(delegateStubs)) {
			originalDelegates.set(
				key,
				prismaClient[key as keyof typeof delegateStubs],
			);
			setDelegate(key, stub);
		}
	});

	afterAll(() => {
		getSessionSpy.mockRestore();
		for (const [key, delegate] of originalDelegates) {
			setDelegate(key, delegate);
		}
	});

	beforeEach(() => {
		memberRole = "member";
	});

	it("lets a member read assets", async () => {
		await caller().listAssets({} as never);
	});

	it("blocks a member from creating an asset", async () => {
		await expectForbidden(caller().createAsset(newAsset));
	});

	it("blocks a member from submitting or deleting an asset", async () => {
		await expectForbidden(caller().submitAsset(assetId));
		await expectForbidden(caller().deleteAsset(assetId));
	});

	it("lets a member read the asset cancellation preview", async () => {
		await expect(
			caller().getAssetCancellationPreview(assetId),
		).resolves.toEqual(cancellationPreview);
		expect(assetCore.getAssetCancellationPreview).toHaveBeenCalledWith(
			(assetId as { id: string }).id,
		);
	});

	it("blocks a member from cancelling an asset", async () => {
		await expectForbidden(caller().cancelAsset(assetId));
	});

	for (const role of ["admin", "owner", "member,admin"]) {
		it(`lets ${role} pass the role check on createAsset`, async () => {
			memberRole = role;
			// Input validation may still reject the sample payload; only a role
			// failure would surface as FORBIDDEN.
			const error = await caller()
				.createAsset(newAsset)
				.then(
					() => null,
					(caught: unknown) => caught,
				);
			expect((error as TRPCError | null)?.code).not.toBe("FORBIDDEN");
		});
	}
});

// ---------------------------------------------------------------------------
// Finance book procedures (issue #142)
// ---------------------------------------------------------------------------
describe("Asset router role-based access: finance books", () => {
	let financeBookSessionSpy: ReturnType<typeof spyOn>;
	const financeBookOriginalDelegates = new Map<string, unknown>();

	function setFinanceBookDelegate(key: string, value: unknown) {
		Object.defineProperty(prismaClient, key, {
			value,
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}

	const financeBookId = "ckxxxxxxxxxxxxxxxxxxxxxxx";
	const financeBookCalls = {
		create: () => caller().createFinanceBook({ name: "IFRS" }),
		update: () =>
			caller().updateFinanceBook({ id: financeBookId, name: "IFRS" }),
		delete: () => caller().deleteFinanceBook({ id: financeBookId }),
	};

	beforeAll(() => {
		financeBookSessionSpy = spyOn(auth.api, "getSession").mockImplementation(
			(() =>
				Promise.resolve({
					user: { id: "user-1" },
					session: { id: "session-1", activeOrganizationId: "org-1" },
				})) as never,
		);
		for (const [key, stub] of Object.entries(delegateStubs)) {
			financeBookOriginalDelegates.set(
				key,
				prismaClient[key as keyof typeof delegateStubs],
			);
			setFinanceBookDelegate(key, stub);
		}
	});

	afterAll(() => {
		financeBookSessionSpy.mockRestore();
		for (const [key, delegate] of financeBookOriginalDelegates) {
			setFinanceBookDelegate(key, delegate);
		}
	});

	beforeEach(() => {
		memberRole = "member";
	});

	it("lets a member list finance books", async () => {
		await caller().listFinanceBooks({});
	});

	it("blocks a member from creating, updating or deleting finance books", async () => {
		await expectForbidden(financeBookCalls.create());
		await expectForbidden(financeBookCalls.update());
		await expectForbidden(financeBookCalls.delete());
	});

	for (const role of ["admin", "owner"]) {
		it(`lets ${role} create, update and delete finance books`, async () => {
			memberRole = role;
			await financeBookCalls.create();
			await financeBookCalls.update();
			await financeBookCalls.delete();
		});
	}
});
