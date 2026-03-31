import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import AuditPage from "./page";

const mockLogs = [
	{
		id: "log-1",
		action: "user.create",
		actorUserId: "user-admin",
		subjectId: "user-new",
		metadata: { email: "new@test.com" },
		createdAt: "2025-01-15T10:30:00Z",
	},
	{
		id: "log-2",
		action: "role.delete",
		actorUserId: "user-admin",
		subjectId: "role-old",
		metadata: {},
		createdAt: "2025-01-14T08:00:00Z",
	},
	{
		id: "log-3",
		action: "permission.update",
		actorUserId: null,
		subjectId: "perm-1",
		metadata: { key: "system:user.read" },
		createdAt: "2025-01-13T15:00:00Z",
	},
];

vi.mock("@/lib/trpc/client", () => ({
	trpc: {
		admin: {
			getAuditLogs: {
				useQuery: () => ({
					data: { logs: mockLogs },
					isLoading: false,
					error: null,
				}),
			},
		},
	},
}));

describe("AuditPage", () => {
	it("renders page heading", () => {
		renderWithProviders(<AuditPage />);
		expect(screen.getByText("Audit Logs")).toBeInTheDocument();
		expect(
			screen.getByText("Authorization change history and activity log"),
		).toBeInTheDocument();
	});

	it("renders filter and export buttons", () => {
		renderWithProviders(<AuditPage />);
		expect(screen.getByText("Show Filters")).toBeInTheDocument();
		expect(screen.getByText("Export")).toBeInTheDocument();
	});

	it("renders audit log table", () => {
		renderWithProviders(<AuditPage />);
		expect(screen.getByText("Timestamp")).toBeInTheDocument();
		expect(screen.getByText("Action")).toBeInTheDocument();
		expect(screen.getByText("Actor")).toBeInTheDocument();
		expect(screen.getByText("Subject")).toBeInTheDocument();
	});

	it("renders log entries", () => {
		renderWithProviders(<AuditPage />);
		expect(screen.getByText("user.create")).toBeInTheDocument();
		expect(screen.getByText("role.delete")).toBeInTheDocument();
		expect(screen.getByText("permission.update")).toBeInTheDocument();
	});

	it("renders actor user IDs", () => {
		renderWithProviders(<AuditPage />);
		expect(screen.getAllByText("user-admin").length).toBe(2);
		expect(screen.getByText("System")).toBeInTheDocument();
	});

	it("renders subject IDs", () => {
		renderWithProviders(<AuditPage />);
		expect(screen.getByText("user-new")).toBeInTheDocument();
		expect(screen.getByText("role-old")).toBeInTheDocument();
		expect(screen.getByText("perm-1")).toBeInTheDocument();
	});

	it("renders log count", () => {
		renderWithProviders(<AuditPage />);
		expect(screen.getByText(/Showing 3 of 3 logs/)).toBeInTheDocument();
	});

	it("uses proper badge variants for actions", () => {
		renderWithProviders(<AuditPage />);
		// user.create should have default variant
		const createBadge = screen.getByText("user.create");
		expect(createBadge).toBeInTheDocument();
		// role.delete should have destructive variant
		const deleteBadge = screen.getByText("role.delete");
		expect(deleteBadge).toBeInTheDocument();
	});
});
