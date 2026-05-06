import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import UsersPage from "./page";

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
	},
}));

vi.mock("@/hooks/use-auth", () => ({
	usePermission: () => true,
}));

vi.mock("@/lib/auth/client", () => {
	const mockUsers = [
		{
			id: "user-1",
			name: "Admin User",
			email: "admin@test.com",
			displayName: "Admin",
			username: "admin",
			banned: false,
			createdAt: "2025-01-01T00:00:00Z",
			updatedAt: "2025-01-10T00:00:00Z",
			department: "IT",
			passwordChangedAt: "2025-01-01T00:00:00Z",
			mustChangePassword: false,
			role: "admin",
			banReason: null,
			banExpires: null,
		},
		{
			id: "user-2",
			name: "Regular User",
			email: "user@test.com",
			displayName: "User",
			username: "regular",
			banned: false,
			createdAt: "2025-01-05T00:00:00Z",
			updatedAt: "2025-01-10T00:00:00Z",
			department: null,
			passwordChangedAt: null,
			mustChangePassword: true,
			role: null,
			banReason: null,
			banExpires: null,
		},
		{
			id: "user-3",
			name: "Disabled User",
			email: "disabled@test.com",
			displayName: "Disabled",
			username: "disabled",
			banned: true,
			createdAt: "2025-01-02T00:00:00Z",
			updatedAt: "2025-01-08T00:00:00Z",
			department: "HR",
			passwordChangedAt: null,
			mustChangePassword: false,
			role: null,
			banReason: "Policy violation",
			banExpires: null,
		},
	];
	const listUsers = () =>
		Promise.resolve({ data: { users: mockUsers, total: mockUsers.length } });
	const banUser = () => Promise.resolve({ data: {} });
	const unbanUser = () => Promise.resolve({ data: {} });
	const removeUser = () => Promise.resolve({ data: {} });
	const createUser = () => Promise.resolve({ data: { id: "new-user" } });
	const updateUser = () => Promise.resolve({ data: {} });
	return {
		authClient: {
			admin: {
				listUsers,
				banUser,
				unbanUser,
				removeUser,
				createUser,
				updateUser,
			},
		},
	};
});

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

	it("renders user names in the list", async () => {
		renderWithProviders(<UsersPage />);
		await waitFor(() => {
			expect(screen.getByText("Admin User")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(screen.getByText("Regular User")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(screen.getByText("Disabled User")).toBeInTheDocument();
		});
	});

	it("renders user emails", async () => {
		renderWithProviders(<UsersPage />);
		await waitFor(() => {
			expect(screen.getByText("admin@test.com")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(screen.getByText("user@test.com")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(screen.getByText("disabled@test.com")).toBeInTheDocument();
		});
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
