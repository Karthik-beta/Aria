import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import {
	DEPRECIATION_METHOD_DOCS,
	DepreciationMethodDocModal,
	DepreciationMethodInlineCard,
	DepreciationMethodLabel,
} from "./depreciation-method-doc-guide";

// Mock recharts ResponsiveContainer for JSDOM compatibility
vi.mock("recharts", async () => {
	const actual = await vi.importActual("recharts");
	return {
		...actual,
		ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
			<div data-testid="responsive-container">{children}</div>
		),
	};
});

describe("DepreciationMethodDocGuide", () => {
	describe("DepreciationMethodInlineCard", () => {
		it("renders nothing when no method is selected", () => {
			const { container } = render(
				<DepreciationMethodInlineCard selectedMethod={null} />,
			);
			expect(container.firstChild).toBeNull();
		});

		it("renders card for STRAIGHT_LINE", () => {
			render(<DepreciationMethodInlineCard selectedMethod="STRAIGHT_LINE" />);

			expect(screen.getByText("Straight Line")).toBeInTheDocument();
			expect(screen.getByText("Linear Decay")).toBeInTheDocument();
			expect(
				screen.getByText(DEPRECIATION_METHOD_DOCS.STRAIGHT_LINE.concept),
			).toBeInTheDocument();
			expect(
				screen.getByText(DEPRECIATION_METHOD_DOCS.STRAIGHT_LINE.formula),
			).toBeInTheDocument();
		});

		it("renders card for WRITTEN_DOWN_VALUE with required fields", () => {
			render(
				<DepreciationMethodInlineCard selectedMethod="WRITTEN_DOWN_VALUE" />,
			);

			expect(screen.getByText("Written Down Value")).toBeInTheDocument();
			expect(screen.getByText("Diminishing Value")).toBeInTheDocument();
			expect(screen.getByText("Rate of Depreciation (%)")).toBeInTheDocument();
		});
	});

	describe("DepreciationMethodLabel", () => {
		it("renders label and help icon button", () => {
			render(<DepreciationMethodLabel />);

			expect(screen.getByText("Depreciation Method")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /Depreciation methods help/i }),
			).toBeInTheDocument();
		});

		it("opens documentation modal when help button is clicked", async () => {
			const user = userEvent.setup();
			render(<DepreciationMethodLabel />);

			const helpButton = screen.getByRole("button", {
				name: /Depreciation methods help/i,
			});
			await user.click(helpButton);

			expect(
				screen.getByText("Depreciation Methods Documentation & Guide"),
			).toBeInTheDocument();
		});
	});

	describe("DepreciationMethodDocModal", () => {
		it("renders tabs and allows switching to simulator and comparison matrix", async () => {
			const user = userEvent.setup();
			const onOpenChange = vi.fn();

			render(
				<DepreciationMethodDocModal open={true} onOpenChange={onOpenChange} />,
			);

			// Default tab: Method Cards
			expect(screen.getByText("Double Declining Balance")).toBeInTheDocument();

			// Switch to Live Simulator tab
			const simTab = screen.getByRole("tab", { name: /Live Simulator/i });
			await user.click(simTab);

			expect(
				screen.getByText("Depreciation Schedule Visual Simulator"),
			).toBeInTheDocument();
			expect(screen.getByTestId("responsive-container")).toBeInTheDocument();

			// Switch to Comparison Matrix tab
			const matrixTab = screen.getByRole("tab", { name: /Comparison Matrix/i });
			await user.click(matrixTab);

			expect(screen.getByText("Depreciation Pace")).toBeInTheDocument();
			expect(
				screen.getByText("Simple, predictable, consistent expense"),
			).toBeInTheDocument();
		});
	});
});
