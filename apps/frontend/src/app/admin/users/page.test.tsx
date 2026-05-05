import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import UsersPage from "./page";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
	},
}));

// Mock auth hooks – grant full permissions by default
vi.mock("@/hooks/use-auth", () => ({
	usePermission: () => true,
}));

const mockUsers = [
	{
		id: "user-1",
		name: "Admin User",
		email: "admin@test.com",
		displayName: "Admin",
		username: "admin",
		isActive: true,
		createdAt: "2025-01-01T00:00:00Z",
		updatedAt: "2025-01-10T00:00:00Z",
		department: "IT",
		passwordChangedAt: "2025-01-01T00:00:00Z",
		mustChangePassword: false,
	},
	{
		id: "user-2",
		name: "Regular User",
		email: "user@test.com",
		displayName: "User",
		username: "regular",
		isActive: true,
		createdAt: "2025-01-05T00:00:00Z",
		updatedAt: "2025-01-10T00:00:00Z",
		department: null,
		passwordChangedAt: null,
		mustChangePassword: true,
	},
	{
		id: "user-3",
		name: "Disabled User",
		email: "disabled@test.com",
		displayName: "Disabled",
		username: "disabled",
		isActive: false,
		createdAt: "2025-01-02T00:00:00Z",
		updatedAt: "2025-01-08T00:00:00Z",
		department: "HR",
		passwordChangedAt: null,
		mustChangePassword: false,
	},
];

const mockRoles = [
	{
		id: "r1",
		key: "admin",
		name: "Admin",
		description: "Full access",
		level: 100,
		isSystem: true,
	},
	{
		id: "r2",
		key: "viewer",
		name: "Viewer",
		description: "Read only",
		level: 1,
		isSystem: false,
	},
];

vi.mock("@/lib/trpc/client", () => ({
	trpc: {
		admin: {
			listUsers: {
				useQuery: () => ({
					data: { users: mockUsers, total: mockUsers.length },
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			listRoles: {
				useQuery: () => ({
					data: mockRoles,
					isLoading: false,
					error: null,
				}),
			},
			getProvisioningContext: {
				useQuery: () => ({
					data: {
						canManageSystem: true,
						manageableAppKeys: [],
						defaultAppKey: "__global__",
						apps: [],
					},
					isLoading: false,
					error: null,
				}),
			},
			disableUser: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
			enableUser: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
			deleteUser: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
			sendPasswordReset: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
			checkUsernameAvailability: {
				useQuery: () => ({
					data: { available: true },
					isLoading: false,
				}),
			},
			generateSecurePassword: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({ password: "SecureP@ss1" }),
				}),
			},
			createUser: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({ id: "new-user" }),
				}),
			},
			assignRole: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
			updateUser: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
			revokeRole: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
					mutateAsync: vi.fn().mockResolvedValue({}),
				}),
			},
		},
	},
}));

describe("UsersPage", () => {
	it("renders page heading", () => {
		renderWithProviders(<UsersPage />);
		expect(screen.getByText("User directory & access")).toBeInTheDocument();
	});

	it("renders create user button", () => {
		renderWithProviders(<UsersPage />);
		expect(screen.getByText("Create user")).toBeInTheDocument();
	});

	it("renders stats cards", () => {
		renderWithProviders(<UsersPage />);
		expect(screen.getByText("Total accounts")).toBeInTheDocument();
		expect(screen.getByText("Pending password resets")).toBeInTheDocument();
		expect(screen.getByText("Disabled users")).toBeInTheDocument();
	});

	it("renders user names in the list", () => {
		renderWithProviders(<UsersPage />);
		expect(screen.getByText("Admin User")).toBeInTheDocument();
		expect(screen.getByText("Regular User")).toBeInTheDocument();
		expect(screen.getByText("Disabled User")).toBeInTheDocument();
	});

	it("renders user emails", () => {
		renderWithProviders(<UsersPage />);
		expect(screen.getByText("admin@test.com")).toBeInTheDocument();
		expect(screen.getByText("user@test.com")).toBeInTheDocument();
		expect(screen.getByText("disabled@test.com")).toBeInTheDocument();
	});

	it("renders search input", () => {
		renderWithProviders(<UsersPage />);
		expect(screen.getByPlaceholderText("Search users...")).toBeInTheDocument();
	});

	it("renders users sidebar heading", () => {
		renderWithProviders(<UsersPage />);
		expect(screen.getByText("Users")).toBeInTheDocument();
	});
});
