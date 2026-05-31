/**
 * Tests for the AuthStateProvider context wrapper.
 */
import { describe, expect, it } from "vitest";
import type { AuthState } from "@/components/auth/auth-state-provider";
import {
	AuthStateProvider,
	useAuthStateContext,
} from "@/components/auth/auth-state-provider";
import { render } from "@/test/utils";

const mockAuthState: AuthState = {
	session: {
		user: {
			id: "user-1",
			email: "test@example.com",
			emailVerified: true,
			name: "Test User",
			createdAt: new Date(),
			updatedAt: new Date(),
			mustChangePassword: false,
			role: "super_admin",
		},
		session: {
			id: "session-1",
			userId: "user-1",
			expiresAt: new Date(),
		},
	},
	role: "super_admin",
	isActive: true,
	activeOrganization: null,
	memberRole: null,
};

function TestConsumer() {
	const authState = useAuthStateContext();
	return <div data-testid="auth-state">{JSON.stringify(authState?.role)}</div>;
}

describe("AuthStateProvider", () => {
	it("provides auth state to children via context", () => {
		const { getByTestId } = render(
			<AuthStateProvider value={mockAuthState}>
				<TestConsumer />
			</AuthStateProvider>,
		);

		expect(getByTestId("auth-state")).toHaveTextContent("super_admin");
	});

	it("returns null context when no provider wraps component", () => {
		const { getByTestId } = render(<TestConsumer />);

		expect(getByTestId("auth-state")).toHaveTextContent("");
	});

	it("renders children when no auth state is provided (empty session)", () => {
		const emptyState: AuthState = {
			session: null,
			role: null,
			isActive: false,
			activeOrganization: null,
			memberRole: null,
		};

		const { getByTestId } = render(
			<AuthStateProvider value={emptyState}>
				<div data-testid="child">Still renders</div>
			</AuthStateProvider>,
		);

		expect(getByTestId("child")).toHaveTextContent("Still renders");
	});
});
