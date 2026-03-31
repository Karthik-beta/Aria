import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		prefetch: vi.fn(),
		refresh: vi.fn(),
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
		info: vi.fn(),
	},
}));

vi.mock("@/lib/auth/client", () => ({
	authClient: {
		signIn: {
			email: vi.fn(),
			username: vi.fn(),
		},
	},
}));

import { LoginForm } from "@/components/auth/login-form";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LoginForm", () => {
	it("renders sign-in title and form fields", () => {
		render(<LoginForm />);

		// CardTitle renders as a div, so use getAllByText and verify the heading exists
		const signInElements = screen.getAllByText(/sign in/i);
		expect(signInElements.length).toBeGreaterThanOrEqual(1);
		expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /sign in/i }),
		).toBeInTheDocument();
	});

	it("has a forgot password link", () => {
		render(<LoginForm />);

		expect(
			screen.getByRole("button", { name: /forgot password/i }),
		).toBeInTheDocument();
	});

	it("has a need help link", () => {
		render(<LoginForm />);

		expect(
			screen.getByRole("button", { name: /need help/i }),
		).toBeInTheDocument();
	});

	it("toggles password visibility", async () => {
		const user = userEvent.setup();
		render(<LoginForm />);

		const passwordInput = screen.getByLabelText(/password/i);
		expect(passwordInput).toHaveAttribute("type", "password");

		const toggleButton = screen.getByRole("button", {
			name: /show password/i,
		});
		await user.click(toggleButton);

		expect(passwordInput).toHaveAttribute("type", "text");
	});

	it("marks identifier and password fields as required", () => {
		render(<LoginForm />);

		expect(screen.getByLabelText(/email or username/i)).toBeRequired();
		expect(screen.getByLabelText(/password/i)).toBeRequired();
	});
});
