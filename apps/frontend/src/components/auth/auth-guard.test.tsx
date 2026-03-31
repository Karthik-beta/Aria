import { render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
	usePathname: () => mockPathname,
}));

const useSessionMock = vi.fn();

vi.mock("@/lib/auth/client", () => ({
	authClient: {
		useSession: () => useSessionMock(),
	},
}));

let mockPathname = "/";

import { AuthGuard } from "@/components/auth/auth-guard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function setEnv(overrides: Record<string, string>) {
	for (const [key, value] of Object.entries(overrides)) {
		vi.stubEnv(key, value);
	}
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AuthGuard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		mockPathname = "/";
	});

	afterAll(() => {
		vi.unstubAllEnvs();
	});

	it("renders children in development bypass mode", () => {
		setEnv({ NODE_ENV: "development", NEXT_PUBLIC_DEV_AUTH_BYPASS: "true" });
		useSessionMock.mockReturnValue({
			data: null,
			isPending: false,
			error: null,
		});

		render(
			<AuthGuard>
				<p>Protected Content</p>
			</AuthGuard>,
		);

		expect(screen.getByText("Protected Content")).toBeInTheDocument();
		expect(pushMock).not.toHaveBeenCalled();
	});

	it("shows loading spinner while session is pending on a protected route", () => {
		useSessionMock.mockReturnValue({
			data: null,
			isPending: true,
			error: null,
		});
		mockPathname = "/inventory/items";

		render(
			<AuthGuard>
				<p>Content</p>
			</AuthGuard>,
		);

		expect(screen.getByText("Loading...")).toBeInTheDocument();
		expect(screen.queryByText("Content")).not.toBeInTheDocument();
	});

	it("renders children on a public auth route regardless of session state", () => {
		useSessionMock.mockReturnValue({
			data: null,
			isPending: false,
			error: null,
		});
		mockPathname = "/auth/sign-in";

		render(
			<AuthGuard>
				<p>Login Page</p>
			</AuthGuard>,
		);

		expect(screen.getByText("Login Page")).toBeInTheDocument();
	});

	it("renders nothing when session is absent on a protected route", () => {
		useSessionMock.mockReturnValue({
			data: null,
			isPending: false,
			error: null,
		});
		mockPathname = "/inventory/items";

		const { container } = render(
			<AuthGuard>
				<p>Protected</p>
			</AuthGuard>,
		);

		expect(container.innerHTML).toBe("");
	});

	it("renders children when an active session exists", () => {
		useSessionMock.mockReturnValue({
			data: {
				user: { id: "u1", mustChangePassword: false },
				session: { id: "s1" },
			},
			isPending: false,
			error: null,
		});
		mockPathname = "/inventory/dashboard";

		render(
			<AuthGuard>
				<p>Dashboard</p>
			</AuthGuard>,
		);

		expect(screen.getByText("Dashboard")).toBeInTheDocument();
	});

	it("redirects to sign-in when session has an error", () => {
		useSessionMock.mockReturnValue({
			data: null,
			isPending: false,
			error: new Error("session expired"),
		});
		mockPathname = "/inventory/items";

		render(
			<AuthGuard>
				<p>Protected</p>
			</AuthGuard>,
		);

		expect(pushMock).toHaveBeenCalledWith("/auth/sign-in");
	});

	it("redirects to change-password when user mustChangePassword", () => {
		useSessionMock.mockReturnValue({
			data: {
				user: { id: "u1", mustChangePassword: true },
				session: { id: "s1" },
			},
			isPending: false,
			error: null,
		});
		mockPathname = "/inventory/dashboard";

		render(
			<AuthGuard>
				<p>Dashboard</p>
			</AuthGuard>,
		);

		expect(pushMock).toHaveBeenCalledWith("/auth/change-password");
	});
});
