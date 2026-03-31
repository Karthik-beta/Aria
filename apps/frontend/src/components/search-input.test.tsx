import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the kbar hook with a trackable toggle function
const toggleMock = vi.fn();

vi.mock("kbar", () => ({
	useKBar: () => ({
		query: { toggle: toggleMock },
	}),
}));

// Must import after mock setup
import SearchInput from "@/components/search-input";

describe("SearchInput", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the search button with placeholder text", () => {
		render(<SearchInput />);

		expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
	});

	it("displays the keyboard shortcut", () => {
		render(<SearchInput />);

		expect(screen.getByText("K")).toBeInTheDocument();
	});

	it("calls query.toggle when clicked", async () => {
		const user = userEvent.setup();
		render(<SearchInput />);

		await user.click(screen.getByRole("button", { name: /search/i }));
		expect(toggleMock).toHaveBeenCalledTimes(1);
	});
});
