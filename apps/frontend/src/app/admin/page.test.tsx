import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/utils";
import AdminDashboard from "./page";

vi.mock("@/lib/auth/client", () => {
	const mockUsers = [
		{
			id: "user-1",
			name: "Admin",
			email: "admin@test.com",
			displayName: "Admin User",
			username: "admin",
			banned: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			department: null,
		},
		{
			id: "user-2",
			name: "User",
			email: "user@test.com",
			displayName: "Regular User",
			username: "user",
			banned: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			department: null,
		},
		{
			id: "user-3",
			name: "Inactive",
			email: "inactive@test.com",
			displayName: "Inactive User",
			username: "inactive",
			banned: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			department: null,
		},
	];
	const listUsers = () =>
		Promise.resolve({ data: { users: mockUsers, total: mockUsers.length } });
	return {
		authClient: {
			admin: { listUsers },
		},
	};
});

describe("AdminDashboard", () => {
	it("renders page heading", async () => {
		renderWithProviders(<AdminDashboard />);
		await waitFor(() => {
			expect(screen.getByText("Dashboard")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(
				screen.getByText("Overview of your system's users and authorization"),
			).toBeInTheDocument();
		});
	});

	it("renders stats cards", async () => {
		renderWithProviders(<AdminDashboard />);
		await waitFor(() => {
			expect(screen.getByText("Total Users")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(screen.getByText("Active Users")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(screen.getByText("Disabled Users")).toBeInTheDocument();
		});
	});

	it("renders stats descriptive text", async () => {
		renderWithProviders(<AdminDashboard />);
		await waitFor(() => {
			expect(screen.getByText("Registered accounts")).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(screen.getByText("Awaiting reactivation")).toBeInTheDocument();
		});
	});

	it("renders active rate percentage", async () => {
		renderWithProviders(<AdminDashboard />);
		await waitFor(() => {
			expect(screen.getByText("66.7%")).toBeInTheDocument();
		});
	});

	it("renders quick action links", async () => {
		renderWithProviders(<AdminDashboard />);
		await waitFor(() => {
			expect(screen.getByText("Manage Users")).toBeInTheDocument();
		});
	});
});
