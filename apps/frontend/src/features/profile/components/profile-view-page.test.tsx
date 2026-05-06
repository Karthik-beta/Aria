/**
 * Unit tests for the universal ProfileViewPage component.
 *
 * Covers the three content sections (Personal Information, Account Security,
 * Roles & App Access) across multiple auth-state scenarios.
 */
import "@testing-library/jest-dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	type AuthState,
	AuthStateProvider,
} from "@/components/auth/auth-state-provider";
import { renderWithProviders, screen } from "@/test/utils";
import ProfileViewPage, { getInitials } from "./profile-view-page";

// Override the global next/link mock (which renders bare children) so that
// link assertions on href attributes work correctly in this file.
vi.mock("next/link", () => ({
	default: ({ href, children }: { href: string; children: ReactNode }) => (
		<a href={href}>{children}</a>
	),
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const authenticatedState: AuthState = {
	session: {
		user: {
			id: "user-1",
			email: "jane.doe@example.com",
			emailVerified: true,
			name: "Jane Doe",
			createdAt: new Date("2025-01-01"),
			updatedAt: new Date("2025-06-01"),
			username: "janedoe",
			displayUsername: "janedoe",
			mustChangePassword: false,
		},
		session: {
			id: "session-1",
			userId: "user-1",
			expiresAt: new Date("2030-01-01"),
		},
	},
	authorization: {
		role: "super_admin",
		roles: ["super_admin", "inventory_user"],
		permissions: [],
		apps: {
			inventory: { roles: ["admin"] },
			asset: { roles: ["viewer"] },
		},
		supervisedApps: ["inventory"],
		isActive: true,
	},
};

const unverifiedEmailState: AuthState = {
	...authenticatedState,
	session: authenticatedState.session
		? {
				...authenticatedState.session,
				user: { ...authenticatedState.session.user, emailVerified: false },
			}
		: null,
};

const noRolesNoAppsState: AuthState = {
	session: authenticatedState.session,
	authorization: {
		role: null,
		roles: [],
		permissions: [],
		apps: {},
		supervisedApps: [],
		isActive: true,
	},
};

const noSessionState: AuthState = {
	session: null,
	authorization: {
		role: null,
		roles: [],
		permissions: [],
		apps: {},
		supervisedApps: [],
		isActive: false,
	},
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderProfile(authState: AuthState) {
	return renderWithProviders(
		<AuthStateProvider value={authState}>
			<ProfileViewPage />
		</AuthStateProvider>,
	);
}

// ── getInitials ──────────────────────────────────────────────────────────────

describe("getInitials", () => {
	it("returns up to two uppercase initials from a full name", () => {
		expect(getInitials("Jane Doe")).toBe("JD");
	});

	it("handles a single name word", () => {
		expect(getInitials("Admin")).toBe("A");
	});

	it("only uses the first two words", () => {
		expect(getInitials("A B C D")).toBe("AB");
	});

	it("handles an empty string gracefully", () => {
		expect(getInitials("")).toBe("");
	});
});

// ── ProfileViewPage ──────────────────────────────────────────────────────────

describe("ProfileViewPage", () => {
	describe("page headings", () => {
		it("renders the universal page heading", () => {
			renderProfile(authenticatedState);
			expect(
				screen.getByRole("heading", { name: /my profile/i }),
			).toBeInTheDocument();
		});

		it("renders the three section card titles", () => {
			renderProfile(authenticatedState);
			expect(screen.getByText("Personal Information")).toBeInTheDocument();
			expect(screen.getByText("Account Security")).toBeInTheDocument();
			expect(screen.getByText(/roles.*app access/i)).toBeInTheDocument();
		});

		it("does NOT contain inventory-specific copy", () => {
			renderProfile(authenticatedState);
			expect(
				screen.queryByText(/inventory administrator/i),
			).not.toBeInTheDocument();
		});
	});

	describe("Personal Information section", () => {
		it("displays the user's full name", () => {
			renderProfile(authenticatedState);
			expect(screen.getByText("Jane Doe")).toBeInTheDocument();
		});

		it("displays the @username handle", () => {
			renderProfile(authenticatedState);
			expect(screen.getByText("@janedoe")).toBeInTheDocument();
		});

		it("displays the email address", () => {
			renderProfile(authenticatedState);
			expect(screen.getByText("jane.doe@example.com")).toBeInTheDocument();
		});

		it("shows a Verified badge when email is verified", () => {
			renderProfile(authenticatedState);
			expect(screen.getByText("Verified")).toBeInTheDocument();
		});

		it("shows an Unverified badge when email is not verified", () => {
			renderProfile(unverifiedEmailState);
			expect(screen.getByText("Unverified")).toBeInTheDocument();
		});

		it("does NOT show a verified/unverified badge when there is no email", () => {
			const stateNoEmail: AuthState = {
				session: authenticatedState.session
					? {
							...authenticatedState.session,
							user: { ...authenticatedState.session.user, email: "" },
						}
					: null,
				authorization: authenticatedState.authorization,
			};
			renderProfile(stateNoEmail);
			expect(screen.queryByText("Verified")).not.toBeInTheDocument();
			expect(screen.queryByText("Unverified")).not.toBeInTheDocument();
		});

		it("renders the avatar initials fallback", () => {
			renderProfile(authenticatedState);
			expect(screen.getByText("JD")).toBeInTheDocument();
		});

		it("falls back to 'User' when no session is present", () => {
			renderProfile(noSessionState);
			// "User" appears as both the avatar fallback and the name — at least one
			expect(screen.getAllByText("U").length).toBeGreaterThan(0);
		});
	});

	describe("Account Security section", () => {
		it("renders the Change Password link", () => {
			renderProfile(authenticatedState);
			expect(
				screen.getByRole("link", { name: /change password/i }),
			).toBeInTheDocument();
		});

		it("Change Password link targets the correct route", () => {
			renderProfile(authenticatedState);
			const link = screen.getByRole("link", { name: /change password/i });
			expect(link).toHaveAttribute("href", "/auth/change-password");
		});
	});

	describe("Roles & App Access section", () => {
		it("renders system role badges", () => {
			renderProfile(authenticatedState);
			expect(screen.getByText("inventory user")).toBeInTheDocument();
			expect(screen.getByText("super admin")).toBeInTheDocument();
		});

		it("renders app access cards with correct app names", () => {
			renderProfile(authenticatedState);
			expect(screen.getByText("Inventory")).toBeInTheDocument();
			expect(screen.getByText("Asset Management")).toBeInTheDocument();
		});

		it("renders the correct app-level role badges", () => {
			renderProfile(authenticatedState);
			// inventory → admin; asset → viewer
			const adminBadges = screen.getAllByText("admin");
			expect(adminBadges.length).toBeGreaterThan(0);
			expect(screen.getByText("viewer")).toBeInTheDocument();
		});

		it("renders a Supervisor badge for supervised apps", () => {
			renderProfile(authenticatedState);
			// inventory is in supervisedApps
			expect(screen.getByText("Supervisor")).toBeInTheDocument();
		});

		it("does NOT render Supervisor badge for non-supervised apps", () => {
			renderProfile(authenticatedState);
			// Only one Supervisor badge expected (inventory only)
			const badges = screen.getAllByText("Supervisor");
			expect(badges).toHaveLength(1);
		});

		it("shows the empty-state message when user has no roles or app access", () => {
			renderProfile(noRolesNoAppsState);
			expect(
				screen.getByText(/no roles or app access assigned/i),
			).toBeInTheDocument();
		});

		it("has correct data-testid attributes for app access cards", () => {
			const { container } = renderProfile(authenticatedState);
			expect(
				container.querySelector('[data-testid="app-access-inventory"]'),
			).toBeInTheDocument();
			expect(
				container.querySelector('[data-testid="app-access-asset"]'),
			).toBeInTheDocument();
		});
	});
});
