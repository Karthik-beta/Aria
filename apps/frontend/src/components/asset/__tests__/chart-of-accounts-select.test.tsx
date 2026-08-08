import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChartOfAccountsSelect } from "../chart-of-accounts-select";

describe("ChartOfAccountsSelect Component", () => {
	it("renders placeholder when no value is provided", () => {
		render(
			<ChartOfAccountsSelect
				value=""
				onChange={vi.fn()}
				placeholder="Select GL Account..."
			/>,
		);

		expect(screen.getByRole("combobox")).toBeDefined();
		expect(screen.getByText("Select GL Account...")).toBeDefined();
	});

	it("renders selected account name when value is provided", () => {
		render(
			<ChartOfAccountsSelect value="1200 - Fixed Assets" onChange={vi.fn()} />,
		);

		expect(screen.getByText("1200 - Fixed Assets")).toBeDefined();
	});
});
