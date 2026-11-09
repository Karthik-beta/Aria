import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertModal } from "@/components/modal/alert-modal";

describe("AlertModal", () => {
	it("renders nothing when not open (client mount guard)", () => {
		const { container } = render(
			<AlertModal
				isOpen={false}
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				loading={false}
			/>,
		);

		expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
		expect(container.innerHTML).not.toContain("Continue");
	});

	it("renders title and description when open", () => {
		render(
			<AlertModal
				isOpen={true}
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				loading={false}
			/>,
		);

		expect(screen.getByText("Are you sure?")).toBeInTheDocument();
		expect(
			screen.getByText("This action cannot be undone."),
		).toBeInTheDocument();
	});

	it("renders Cancel and Continue buttons", () => {
		render(
			<AlertModal
				isOpen={true}
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				loading={false}
			/>,
		);

		expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /continue/i }),
		).toBeInTheDocument();
	});

	it("calls onClose when Cancel is clicked", async () => {
		const onClose = vi.fn();
		const user = userEvent.setup();

		render(
			<AlertModal
				isOpen={true}
				onClose={onClose}
				onConfirm={vi.fn()}
				loading={false}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /cancel/i }));
		expect(onClose).toHaveBeenCalled();
	});

	it("calls onConfirm when Continue is clicked", async () => {
		const onConfirm = vi.fn();
		const user = userEvent.setup();

		render(
			<AlertModal
				isOpen={true}
				onClose={vi.fn()}
				onConfirm={onConfirm}
				loading={false}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /continue/i }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("disables buttons when loading", () => {
		render(
			<AlertModal
				isOpen={true}
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				loading={true}
			/>,
		);

		expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
	});
});
