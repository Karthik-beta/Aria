import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import RolesPage from "./page";

// Mock logger
vi.mock("@aria/utils", () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}));

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock auth hooks – grant full permissions by default
vi.mock("@/hooks/use-auth", () => ({
	usePermission: () => true,
}));

const mockRoles = [
	{
		id: "r1",
		key: "super-admin",
		name: "Super Admin",
		description: "Full system access",
		level: 100,
		isSystem: true,
		rolePermissions: [
			{ permission: { id: "p1", key: "system:user.read", name: "Read Users" } },
			{
				permission: {
					id: "p2",
					key: "system:user.manage",
					name: "Manage Users",
				},
			},
		],
	},
	{
		id: "r2",
		key: "editor",
		name: "Editor",
		description: "Can edit content",
		level: 50,
		isSystem: false,
		rolePermissions: [],
	},
];

const mockPermissions = [
	{
		id: "p1",
		key: "system:user.read",
		name: "Read Users",
		description: "Read user data",
		scope: "system",
	},
	{
		id: "p2",
		key: "system:user.manage",
		name: "Manage Users",
		description: "Manage users",
		scope: "system",
	},
	{
		id: "p3",
		key: "app:inventory.read",
		name: "Read Inventory",
		description: "Read inventory",
		scope: "app",
	},
];

const mockDeleteMutate = vi.fn();
const mockCreateMutate = vi.fn();

vi.mock("@/lib/trpc/client", () => ({
	trpc: {
		admin: {
			listRoles: {
				useQuery: () => ({
					data: mockRoles,
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			listPermissions: {
				useQuery: () => ({
					data: mockPermissions,
					isLoading: false,
					error: null,
				}),
			},
			createRole: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
					mutateAsync: mockCreateMutate.mockResolvedValue({}),
				}),
			},
			updateRole: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
			deleteRole: {
				useMutation: ({
					onSuccess,
				}: {
					onSuccess?: () => void;
					onError?: (e: Error) => void;
				}) => ({
					isPending: false,
					mutate: (input: { roleKey: string }) => {
						mockDeleteMutate(input);
						onSuccess?.();
					},
				}),
			},
			assignPermissionToRole: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
			removePermissionFromRole: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
		},
	},
}));

describe("RolesPage", () => {
	it("renders page heading", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("Roles & Permissions")).toBeInTheDocument();
	});

	it("renders create role button", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("Create Role")).toBeInTheDocument();
	});

	it("renders role cards", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("Super Admin")).toBeInTheDocument();
		expect(screen.getByText("Editor")).toBeInTheDocument();
	});

	it("renders system badge for system roles", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("System")).toBeInTheDocument();
	});

	it("renders role descriptions", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("Full system access")).toBeInTheDocument();
		expect(screen.getByText("Can edit content")).toBeInTheDocument();
	});

	it("renders permission badges on role cards", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("system:user.read")).toBeInTheDocument();
		expect(screen.getByText("system:user.manage")).toBeInTheDocument();
	});

	it("shows no permissions message for role without permissions", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("No permissions assigned")).toBeInTheDocument();
	});

	it("renders tabs for roles and permissions", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("Roles (2)")).toBeInTheDocument();
		expect(screen.getByText("Permissions (3)")).toBeInTheDocument();
	});

	it("renders role level badges", () => {
		renderWithProviders(<RolesPage />);
		expect(screen.getByText("100")).toBeInTheDocument();
		expect(screen.getByText("50")).toBeInTheDocument();
	});
});
