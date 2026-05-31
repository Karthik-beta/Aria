import { describe, expect, it, vi } from "vitest";
import { OrganizationGate } from "@/components/auth/organization-gate";
import { render, screen } from "@/test/utils";

const mockUseListOrganizations = vi.fn();

vi.mock("@/lib/auth/client", () => ({
	authClient: {
		useListOrganizations: () => mockUseListOrganizations(),
		signIn: vi.fn(),
		signOut: vi.fn(),
		signUp: vi.fn(),
		useSession: vi.fn(),
		useActiveOrganization: vi.fn(),
		organization: vi.fn(),
		admin: vi.fn(),
	},
}));

describe("OrganizationGate", () => {
	it("renders children when user is a member of the org", () => {
		mockUseListOrganizations.mockReturnValue({
			data: [
				{
					id: "org-1",
					name: "Inventory",
					slug: "inventory",
					logo: null,
					metadata: null,
					createdAt: new Date(),
				},
			],
			isPending: false,
		});

		const { getByText } = render(
			<OrganizationGate orgSlug="inventory">
				<div>Inventory Content</div>
			</OrganizationGate>,
		);

		expect(getByText("Inventory Content")).toBeInTheDocument();
	});

	it("shows access denied when user is not a member", () => {
		mockUseListOrganizations.mockReturnValue({
			data: [
				{
					id: "org-1",
					name: "HRMS",
					slug: "hrms",
					logo: null,
					metadata: null,
					createdAt: new Date(),
				},
			],
			isPending: false,
		});

		render(
			<OrganizationGate orgSlug="inventory">
				<div>Inventory Content</div>
			</OrganizationGate>,
		);

		expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
		expect(screen.queryByText("Inventory Content")).not.toBeInTheDocument();
	});

	it("renders custom fallback when provided and access denied", () => {
		mockUseListOrganizations.mockReturnValue({
			data: [],
			isPending: false,
		});

		render(
			<OrganizationGate
				orgSlug="inventory"
				fallback={<div>Custom: No Access</div>}
			>
				<div>Should not appear</div>
			</OrganizationGate>,
		);

		expect(screen.getByText("Custom: No Access")).toBeInTheDocument();
		expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
	});

	it("shows loading spinner while pending", () => {
		mockUseListOrganizations.mockReturnValue({
			data: null,
			isPending: true,
		});

		const { container } = render(
			<OrganizationGate orgSlug="inventory">
				<div>Content</div>
			</OrganizationGate>,
		);

		expect(container.querySelector(".animate-spin")).toBeTruthy();
	});
});
