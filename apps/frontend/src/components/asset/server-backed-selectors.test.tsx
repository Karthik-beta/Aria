import "@testing-library/jest-dom";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
	within,
} from "@/test/utils";
import {
	AssetSearchSelect,
	CompanySearchSelect,
	LocationSearchSelect,
	MaintenanceTeamSearchSelect,
	OrganizationMemberSearchSelect,
} from "./server-backed-selectors";

type AssetQueryInput = {
	skip: number;
	take: number;
	search?: string;
	status?: string;
};

type TeamQueryInput = {
	skip: number;
	take: number;
	search?: string;
	company?: string;
};

type LocationQueryInput = {
	skip: number;
	take: number;
	search?: string;
	isGroup?: boolean;
};

type CompanyQueryInput = {
	skip: number;
	take: number;
	search?: string;
};

const mockState = vi.hoisted(() => ({
	assetCalls: [] as AssetQueryInput[],
	teamCalls: [] as TeamQueryInput[],
	locationCalls: [] as LocationQueryInput[],
	companyCalls: [] as CompanyQueryInput[],
	memberCalls: [] as Array<{ query: { limit: number; offset: number } }>,
	stableAssetMode: false,
	stableAssetData: {
		SUBMITTED: {
			items: [
				{
					id: "stable-submitted-asset",
					series: "AST-STABLE-SUBMITTED",
					assetName: "Submitted cached asset",
					companyId: "company-a",
					company: "Company A",
					status: "SUBMITTED",
					locationId: null,
					locationName: null,
					custodian: null,
					valueAfterDepreciation: 100,
					financeBooks: [],
				},
			],
			totalCount: 1,
		},
		DRAFT: {
			items: [
				{
					id: "stable-draft-asset",
					series: "AST-STABLE-DRAFT",
					assetName: "Draft cached asset",
					companyId: "company-a",
					company: "Company A",
					status: "DRAFT",
					locationId: null,
					locationName: null,
					custodian: null,
					valueAfterDepreciation: 100,
					financeBooks: [],
				},
			],
			totalCount: 1,
		},
	},
}));

function assetItems(input: AssetQueryInput) {
	if (input.search) {
		return [
			{
				id: "searched-asset",
				series: "AST-SEARCH",
				assetName: "Searched Asset",
				companyId: "company-a",
				company: "Company A",
				status: input.status ?? "SUBMITTED",
				locationId: null,
				locationName: null,
				custodian: null,
				valueAfterDepreciation: 100,
				financeBooks: [],
			},
		];
	}

	const indexes = Array.from({ length: input.take }, (_, index) => {
		const globalIndex = input.skip + index;
		return input.skip === 50 && index === 0 ? 0 : globalIndex;
	});

	return indexes.map((index) => ({
		id: `asset-${index}`,
		series: `AST-${index}`,
		assetName: `Asset ${index} ${input.status ?? "SUBMITTED"}`,
		companyId: "company-a",
		company: "Company A",
		status: input.status ?? "SUBMITTED",
		locationId: null,
		locationName: null,
		custodian: null,
		valueAfterDepreciation: 100,
		financeBooks: [],
	}));
}

function teamItems(input: TeamQueryInput) {
	return Array.from({ length: input.take }, (_, index) => {
		const globalIndex = input.skip + index;
		return {
			id: `team-${input.company ?? "all"}-${globalIndex}`,
			name: `Team ${globalIndex} ${input.company ?? "all"}`,
		};
	});
}

function locationItems(input: LocationQueryInput) {
	if (input.search) {
		return [{ id: "searched-location", name: "Searched Location" }];
	}
	return Array.from({ length: input.take }, (_, index) => ({
		id: `location-${input.skip + index}`,
		name: `Location ${input.skip + index}`,
	}));
}

function companyItems(input: CompanyQueryInput) {
	if (input.search) {
		return [{ id: "searched-company", name: "Searched Company" }];
	}
	return Array.from({ length: input.take }, (_, index) => ({
		id: `company-${input.skip + index}`,
		name: `Company ${input.skip + index}`,
	}));
}

function memberItems(offset: number, limit: number) {
	return Array.from({ length: limit }, (_, index) => {
		const globalIndex = offset + index;
		return {
			id: `membership-row-${globalIndex}`,
			userId: `user-${globalIndex}`,
			role: "member",
			user: {
				id: `user-${globalIndex}`,
				name: `Member ${globalIndex}`,
				email: `member-${globalIndex}@example.com`,
			},
		};
	});
}

vi.mock("@/lib/trpc", () => ({
	trpc: {
		asset: {
			listAssets: {
				useQuery: (input: AssetQueryInput) => {
					mockState.assetCalls.push(input);
					const stableData =
						input.status === "SUBMITTED"
							? mockState.stableAssetData.SUBMITTED
							: input.status === "DRAFT"
								? mockState.stableAssetData.DRAFT
								: null;
					if (
						mockState.stableAssetMode &&
						input.skip === 0 &&
						!input.search &&
						stableData
					) {
						return {
							data: stableData,
							isLoading: false,
							isFetching: false,
						};
					}
					return {
						data: { items: assetItems(input), totalCount: 300 },
						isLoading: false,
						isFetching: false,
					};
				},
			},
			listMaintenanceTeams: {
				useQuery: (input: TeamQueryInput) => {
					mockState.teamCalls.push(input);
					return {
						data: { items: teamItems(input), totalCount: 300 },
						isLoading: false,
						isFetching: false,
					};
				},
			},
			listLocations: {
				useQuery: (input: LocationQueryInput) => {
					mockState.locationCalls.push(input);
					return {
						data: { items: locationItems(input), totalCount: 300 },
						isLoading: false,
						isFetching: false,
					};
				},
			},
		},
		company: {
			listCompanies: {
				useQuery: (input: CompanyQueryInput) => {
					mockState.companyCalls.push(input);
					return {
						data: { items: companyItems(input), totalCount: 300 },
						isLoading: false,
						isFetching: false,
					};
				},
			},
		},
	},
}));

vi.mock("@/lib/auth/client", () => ({
	authClient: {
		organization: {
			listMembers: ({
				query,
			}: {
				query: { limit: number; offset: number };
			}) => {
				mockState.memberCalls.push({ query });
				return Promise.resolve({
					data: {
						members: memberItems(query.offset, query.limit),
						total: 300,
					},
					error: null,
				});
			},
		},
	},
}));

function ControlledAssetSelect({
	onValueChange,
	status,
}: {
	onValueChange: (value: string) => void;
	status?: "DRAFT" | "SUBMITTED";
}) {
	const [value, setValue] = useState("");
	return (
		<AssetSearchSelect
			value={value}
			onValueChange={(nextValue) => {
				setValue(nextValue);
				onValueChange(nextValue);
			}}
			status={status}
		/>
	);
}

function ControlledMemberSelect({
	initialValue = "",
	onValueChange,
}: {
	initialValue?: string;
	onValueChange: (value: string) => void;
}) {
	const [value, setValue] = useState(initialValue);
	return (
		<OrganizationMemberSearchSelect
			value={value}
			onValueChange={(nextValue) => {
				setValue(nextValue);
				onValueChange(nextValue);
			}}
			selectedLabel="Stale persisted member"
		/>
	);
}

function last<T>(values: T[]): T {
	const value = values[values.length - 1];
	if (!value) throw new Error("Expected a recorded request");
	return value;
}

describe("real server-backed asset selectors", () => {
	beforeEach(() => {
		mockState.assetCalls.length = 0;
		mockState.teamCalls.length = 0;
		mockState.locationCalls.length = 0;
		mockState.companyCalls.length = 0;
		mockState.memberCalls.length = 0;
		mockState.stableAssetMode = false;
	});

	it("loads page zero, dedupes later pages through page five, and preserves selected values", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderWithProviders(
			<ControlledAssetSelect onValueChange={onValueChange} />,
		);

		await waitFor(() => {
			expect(last(mockState.assetCalls)).toMatchObject({ skip: 0, take: 50 });
		});
		await user.click(screen.getByRole("button", { name: "Select asset" }));
		expect(screen.getByText(/AST-0 — Asset 0/)).toBeInTheDocument();

		for (const expectedSkip of [50, 100, 150, 200, 250]) {
			await user.click(screen.getByRole("button", { name: "Load more" }));
			await waitFor(() => {
				expect(last(mockState.assetCalls)).toMatchObject({
					skip: expectedSkip,
					take: 50,
				});
			});
		}

		expect(screen.getByText(/AST-250 — Asset 250/)).toBeInTheDocument();
		expect(screen.getAllByText(/AST-0 — Asset 0/)).toHaveLength(1);

		await user.click(screen.getByText(/AST-250 — Asset 250/));
		expect(onValueChange).toHaveBeenLastCalledWith("asset-250");
		expect(
			screen.getByRole("button", { name: "Select asset" }),
		).toHaveTextContent("AST-250 — Asset 250");
	});

	it("debounces search, resets to page zero, replaces prior results, and keeps the selected label", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderWithProviders(
			<ControlledAssetSelect onValueChange={onValueChange} />,
		);

		await user.click(screen.getByRole("button", { name: "Select asset" }));
		await user.click(screen.getByText(/AST-0 — Asset 0/));
		await user.click(screen.getByRole("button", { name: "Select asset" }));

		const searchInput = screen.getByPlaceholderText("Search assets…");
		await user.type(searchInput, "needle");
		await new Promise((resolve) => setTimeout(resolve, 300));
		await waitFor(() => {
			expect(last(mockState.assetCalls)).toMatchObject({
				skip: 0,
				take: 50,
				search: "needle",
			});
		});

		expect(screen.getByText(/AST-SEARCH — Searched Asset/)).toBeInTheDocument();
		expect(
			within(screen.getByRole("listbox")).queryByText(/AST-0 — Asset 0/),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Select asset" }),
		).toHaveTextContent("AST-0 — Asset 0");
	});

	it("resets accumulated asset pages when the status filter changes", async () => {
		const user = userEvent.setup();
		const { rerender } = renderWithProviders(
			<ControlledAssetSelect onValueChange={vi.fn()} status="SUBMITTED" />,
		);

		await user.click(screen.getByRole("button", { name: "Select asset" }));
		await user.click(screen.getByRole("button", { name: "Load more" }));
		await waitFor(() => expect(last(mockState.assetCalls).skip).toBe(50));

		rerender(<ControlledAssetSelect onValueChange={vi.fn()} status="DRAFT" />);
		await waitFor(() => {
			expect(last(mockState.assetCalls)).toMatchObject({
				skip: 0,
				status: "DRAFT",
			});
			expect(screen.getByText(/Asset 0 DRAFT/)).toBeInTheDocument();
		});
		expect(screen.queryByText(/Asset 51 SUBMITTED/)).not.toBeInTheDocument();
	});

	it("hydrates a page-zero scope from a stable cached result", async () => {
		mockState.stableAssetMode = true;
		const user = userEvent.setup();
		function StableStatusHarness() {
			const [status, setStatus] = useState<"DRAFT" | "SUBMITTED">("SUBMITTED");
			return (
				<>
					<button type="button" onClick={() => setStatus("DRAFT")}>
						Switch cached status
					</button>
					<AssetSearchSelect value="" onValueChange={vi.fn()} status={status} />
				</>
			);
		}

		renderWithProviders(<StableStatusHarness />);
		await user.click(screen.getByRole("button", { name: "Select asset" }));
		await waitFor(() =>
			expect(screen.getByText(/AST-STABLE-SUBMITTED/)).toBeInTheDocument(),
		);

		await user.click(
			screen.getByRole("button", { name: "Switch cached status" }),
		);
		await user.click(screen.getByRole("button", { name: "Select asset" }));
		await waitFor(() =>
			expect(screen.getByText(/AST-STABLE-DRAFT/)).toBeInTheDocument(),
		);
		expect(screen.queryByText(/AST-STABLE-SUBMITTED/)).not.toBeInTheDocument();
	});

	it("resets accumulated team pages when the company filter changes", async () => {
		const user = userEvent.setup();
		const { rerender } = renderWithProviders(
			<MaintenanceTeamSearchSelect
				value=""
				onValueChange={vi.fn()}
				company="company-a"
			/>,
		);

		await user.click(
			screen.getByRole("button", { name: "Select maintenance team" }),
		);
		await user.click(screen.getByRole("button", { name: "Load more" }));
		await waitFor(() => expect(last(mockState.teamCalls).skip).toBe(50));

		rerender(
			<MaintenanceTeamSearchSelect
				value=""
				onValueChange={vi.fn()}
				company="company-b"
			/>,
		);
		await waitFor(() => {
			expect(last(mockState.teamCalls)).toMatchObject({
				skip: 0,
				company: "company-b",
			});
			expect(screen.getByText(/Team 0 company-b/)).toBeInTheDocument();
		});
		expect(screen.queryByText(/Team 51 company-a/)).not.toBeInTheDocument();
	});

	it("loads authorized locations through page five and sends the group filter", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<LocationSearchSelect value="" onValueChange={vi.fn()} isGroup={true} />,
		);

		await user.click(screen.getByRole("button", { name: "Select location" }));
		await waitFor(() => {
			expect(last(mockState.locationCalls)).toMatchObject({
				skip: 0,
				take: 50,
				isGroup: true,
			});
		});
		for (const expectedSkip of [50, 100, 150, 200, 250]) {
			await user.click(screen.getByRole("button", { name: "Load more" }));
			await waitFor(() =>
				expect(last(mockState.locationCalls).skip).toBe(expectedSkip),
			);
		}
		expect(screen.getByText("Location 250")).toBeInTheDocument();
	});

	it("loads companies through page five and resets search to page zero", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<CompanySearchSelect value="" onValueChange={vi.fn()} />,
		);

		await user.click(screen.getByRole("button", { name: "Select company" }));
		await waitFor(() =>
			expect(last(mockState.companyCalls)).toMatchObject({
				skip: 0,
				take: 50,
			}),
		);
		for (const expectedSkip of [50, 100, 150, 200, 250]) {
			await user.click(screen.getByRole("button", { name: "Load more" }));
			await waitFor(() =>
				expect(last(mockState.companyCalls).skip).toBe(expectedSkip),
			);
		}
		expect(screen.getByText("Company 250")).toBeInTheDocument();

		await user.type(screen.getByPlaceholderText("Search companies…"), "vendor");
		await new Promise((resolve) => setTimeout(resolve, 300));
		await waitFor(() => {
			expect(last(mockState.companyCalls)).toMatchObject({
				skip: 0,
				search: "vendor",
			});
		});
		expect(screen.getByText("Searched Company")).toBeInTheDocument();
	});

	it("persists member userId when membership id differs and loads beyond the first page", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderWithProviders(
			<ControlledMemberSelect
				initialValue="user-0"
				onValueChange={onValueChange}
			/>,
		);

		const trigger = screen.getByRole("button", {
			name: "Select organization member",
		});
		expect(trigger).toHaveTextContent("Stale persisted member");
		await user.click(trigger);
		await waitFor(() => {
			expect(last(mockState.memberCalls)).toEqual({
				query: { limit: 50, offset: 0 },
			});
		});
		await waitFor(() => expect(trigger).toHaveTextContent("Member 0"));

		for (const expectedOffset of [50, 100, 150, 200, 250]) {
			await user.click(
				screen.getByRole("button", { name: "Load more members" }),
			);
			await waitFor(() => {
				expect(last(mockState.memberCalls)).toEqual({
					query: { limit: 50, offset: expectedOffset },
				});
			});
		}

		await user.click(screen.getByText(/Member 250/));
		expect(onValueChange).toHaveBeenLastCalledWith("user-250");
		expect(trigger).toHaveTextContent("Member 250");
	});
});
