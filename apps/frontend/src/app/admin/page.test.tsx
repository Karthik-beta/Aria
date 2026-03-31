import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import AdminDashboard from "./page";

// Mock recharts to avoid canvas/SVG rendering issues in JSDOM
vi.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="responsive-container">{children}</div>
	),
	PieChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="pie-chart">{children}</div>
	),
	BarChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="bar-chart">{children}</div>
	),
	Pie: () => <div data-testid="pie" />,
	Bar: () => <div data-testid="bar" />,
	Cell: () => <div data-testid="cell" />,
	XAxis: () => <div data-testid="x-axis" />,
	YAxis: () => <div data-testid="y-axis" />,
	CartesianGrid: () => <div data-testid="cartesian-grid" />,
	Tooltip: () => <div data-testid="tooltip" />,
	Legend: () => <div data-testid="legend" />,
}));

const mockUsers = [
	{
		id: "user-1",
		name: "Admin",
		email: "admin@test.com",
		displayName: "Admin User",
		username: "admin",
		isActive: true,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		department: null,
		userRoles: [{ role: { id: "r1", key: "admin", name: "Admin" } }],
	},
	{
		id: "user-2",
		name: "User",
		email: "user@test.com",
		displayName: "Regular User",
		username: "user",
		isActive: true,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		department: null,
		userRoles: [{ role: { id: "r2", key: "viewer", name: "Viewer" } }],
	},
	{
		id: "user-3",
		name: "Inactive",
		email: "inactive@test.com",
		displayName: "Inactive User",
		username: "inactive",
		isActive: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		department: null,
		userRoles: [],
	},
];

const mockRoles = [
	{
		id: "r1",
		key: "admin",
		name: "Admin",
		description: "Administrator",
		level: 100,
		isSystem: true,
		rolePermissions: [],
	},
	{
		id: "r2",
		key: "viewer",
		name: "Viewer",
		description: "View only",
		level: 1,
		isSystem: false,
		rolePermissions: [],
	},
];

const mockAuditLogs = [
	{
		id: "log-1",
		action: "user.create",
		actorUserId: "user-1",
		subjectId: "user-2",
		metadata: {},
		createdAt: new Date().toISOString(),
	},
	{
		id: "log-2",
		action: "role.update",
		actorUserId: "user-1",
		subjectId: "r1",
		metadata: {},
		createdAt: new Date().toISOString(),
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
				}),
			},
			listRoles: {
				useQuery: () => ({
					data: mockRoles,
					isLoading: false,
					error: null,
				}),
			},
			getAuditLogs: {
				useQuery: () => ({
					data: { logs: mockAuditLogs },
					isLoading: false,
					error: null,
				}),
			},
		},
	},
}));

describe("AdminDashboard", () => {
	it("renders page heading", () => {
		renderWithProviders(<AdminDashboard />);
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Overview of your system's users, roles, and authorization activity",
			),
		).toBeInTheDocument();
	});

	it("renders stats cards with real data", () => {
		renderWithProviders(<AdminDashboard />);
		// Stats are rendered - check descriptive text instead of bare numbers
		expect(screen.getByText("Registered accounts")).toBeInTheDocument();
		expect(screen.getByText("Across all applications")).toBeInTheDocument();
		expect(screen.getByText("Logged in the latest query")).toBeInTheDocument();
	});

	it("renders stat card labels", () => {
		renderWithProviders(<AdminDashboard />);
		expect(screen.getByText("Total Users")).toBeInTheDocument();
		expect(screen.getByText("Active Users")).toBeInTheDocument();
		expect(screen.getByText("Roles")).toBeInTheDocument();
		expect(screen.getByText("Recent Actions")).toBeInTheDocument();
	});

	it("renders active rate percentage", () => {
		renderWithProviders(<AdminDashboard />);
		expect(screen.getByText("66.7%")).toBeInTheDocument();
	});

	it("renders tab triggers", () => {
		renderWithProviders(<AdminDashboard />);
		expect(screen.getByText("Overview")).toBeInTheDocument();
		expect(screen.getByText("Analytics")).toBeInTheDocument();
		expect(screen.getByText("Recent Activity")).toBeInTheDocument();
	});

	it("renders quick action links", () => {
		renderWithProviders(<AdminDashboard />);
		expect(screen.getByText("Manage Users")).toBeInTheDocument();
		expect(screen.getByText("Manage Roles")).toBeInTheDocument();
		expect(screen.getByText("View Audit Logs")).toBeInTheDocument();
	});
});
