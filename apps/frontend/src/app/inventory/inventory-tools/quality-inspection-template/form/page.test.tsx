import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import QualityInspectionTemplateFormPage from "./page";

// ── Mock state ───────────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockCreateParamMutate = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();

let currentId: string | null = null;

const mockParameters = [
	{
		id: "param-001",
		parameter: "Surface Finish",
		description: "Visual check for surface defects",
		groupId: "group-001",
		groupName: "Visual",
		createdAt: new Date("2026-01-01").toISOString(),
		updatedAt: new Date("2026-01-01").toISOString(),
	},
	{
		id: "param-002",
		parameter: "Hardness (HRC)",
		description: null,
		groupId: null,
		groupName: null,
		createdAt: new Date("2026-01-02").toISOString(),
		updatedAt: new Date("2026-01-02").toISOString(),
	},
];

const mockTemplates = [
	{
		id: "tmpl-001",
		name: "Incoming Raw Material",
		items: [
			{
				id: "item-001",
				templateId: "tmpl-001",
				parameterId: "param-001",
				parameterName: "Surface Finish",
				parameterGroupId: "group-001",
				parameterGroupName: "Visual",
				sortOrder: 0,
				numeric: false,
				formulaBased: false,
				value: "Pass",
				minValue: null,
				maxValue: null,
				acceptanceFormula: null,
			},
		],
		createdAt: new Date("2026-03-01").toISOString(),
		updatedAt: new Date("2026-03-01").toISOString(),
	},
];

const getMockTemplateById = (id: string | null) =>
	mockTemplates.find((t) => t.id === id) ?? null;

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: mockReplace,
		prefetch: vi.fn(),
		back: vi.fn(),
	}),
	useSearchParams: () => ({
		get: (key: string) => (key === "id" ? currentId : null),
	}),
}));

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listQiTemplates: { invalidate: vi.fn().mockResolvedValue(undefined) },
				getQiTemplateById: { invalidate: vi.fn().mockResolvedValue(undefined) },
				listQiParameters: { invalidate: vi.fn().mockResolvedValue(undefined) },
			},
		}),
		inventory: {
			getQiTemplateById: {
				useQuery: (_input: unknown, options?: { enabled?: boolean }) => ({
					data: options?.enabled ? getMockTemplateById(currentId) : undefined,
					isLoading: false,
				}),
			},
			listQiParameters: {
				useQuery: (_input: unknown, options?: { enabled?: boolean }) => ({
					data: options?.enabled === false ? [] : mockParameters,
					isLoading: false,
				}),
			},
			createQiTemplate: {
				useMutation: ({
					onSuccess,
					onError: _onError,
				}: {
					onSuccess?: (d: unknown) => void;
					onError?: (e: unknown) => void;
				}) => ({
					isPending: false,
					mutate: (payload: unknown) => {
						mockCreateMutate(payload);
						onSuccess?.({ id: "tmpl-new", name: "Test" });
					},
				}),
			},
			updateQiTemplate: {
				useMutation: ({
					onSuccess,
					onError: _onError,
				}: {
					onSuccess?: () => void;
					onError?: (e: unknown) => void;
				}) => ({
					isPending: false,
					mutate: (payload: unknown) => {
						mockUpdateMutate(payload);
						onSuccess?.();
					},
				}),
			},
			createQiParameter: {
				useMutation: ({
					onSuccess,
					onError: _onError,
				}: {
					onSuccess?: (d: unknown) => void;
					onError?: (e: unknown) => void;
				}) => ({
					isPending: false,
					mutate: (payload: unknown) => {
						mockCreateParamMutate(payload);
						onSuccess?.({
							id: "param-new",
							parameter: "New Param",
							groupId: null,
							groupName: null,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						});
					},
				}),
			},
		},
	},
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("QualityInspectionTemplateFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockCreateParamMutate.mockClear();
		mockPush.mockClear();
		mockReplace.mockClear();
	});

	it("renders create form with correct heading and button", () => {
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		expect(screen.getByText("New Template")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Create Template/i }),
		).toBeInTheDocument();
	});

	it("renders template name input in create mode", () => {
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		expect(screen.getByLabelText(/Template Name/i)).toBeInTheDocument();
	});

	it("renders Add Parameter button", () => {
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		expect(
			screen.getByRole("button", { name: /Add Parameter/i }),
		).toBeInTheDocument();
	});

	it("shows empty state text when no parameters added", () => {
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		expect(screen.getByText(/No parameters added yet/i)).toBeInTheDocument();
	});

	it("loads edit form with template name prefilled", async () => {
		currentId = "tmpl-001";
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("Incoming Raw Material"),
			).toBeInTheDocument();
		});
	});

	it("shows Save Changes button in edit mode", async () => {
		currentId = "tmpl-001";
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /Save Changes/i }),
			).toBeInTheDocument();
		});
	});

	it("shows Edit Template heading in edit mode", async () => {
		currentId = "tmpl-001";
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await waitFor(() => {
			expect(screen.getByText("Edit Template")).toBeInTheDocument();
		});
	});

	it("displays existing parameter rows in edit mode", async () => {
		currentId = "tmpl-001";
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await waitFor(() => {
			expect(screen.getByText("Surface Finish")).toBeInTheDocument();
		});
	});

	it("redirects to list when template id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith(
				"/inventory/inventory-tools/quality-inspection-template",
			);
		});
	});

	it("calls createQiTemplate when submitting create form", async () => {
		const user = userEvent.setup();
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await user.type(screen.getByLabelText(/Template Name/i), "Test Template");

		await user.click(screen.getByRole("button", { name: /Create Template/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ name: "Test Template" }),
			);
		});
	});

	it("calls updateQiTemplate when submitting edit form", async () => {
		currentId = "tmpl-001";
		const user = userEvent.setup();
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("Incoming Raw Material"),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /Save Changes/i }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: "tmpl-001" }),
			);
		});
	});

	it("opens Add Parameter dialog when button is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await user.click(screen.getByRole("button", { name: /Add Parameter/i }));

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
			// Dialog title appears inside the dialog element
			const dialog = screen.getByRole("dialog");
			expect(dialog).toHaveTextContent("Add Parameter");
		});
	});

	it("opens parameter dialog from empty state link", async () => {
		const user = userEvent.setup();
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await user.click(
			screen.getByRole("button", { name: /Add the first parameter/i }),
		);

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});
	});

	it("closes dialog when Cancel is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<QualityInspectionTemplateFormPage />);

		await user.click(screen.getByRole("button", { name: /Add Parameter/i }));

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});
	});
});
