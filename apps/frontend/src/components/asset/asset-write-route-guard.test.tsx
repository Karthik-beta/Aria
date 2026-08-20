import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetWriteRouteGuard } from "./asset-write-route-guard";

const access = vi.hoisted(() => ({ canWrite: false }));

vi.mock("@/hooks/use-asset-write-access", () => ({
	useAssetWriteAccess: () => access.canWrite,
}));

describe("AssetWriteRouteGuard", () => {
	it("shows the read-only gate for organization members", () => {
		access.canWrite = false;
		render(
			<AssetWriteRouteGuard>
				<div>write form</div>
			</AssetWriteRouteGuard>,
		);

		expect(
			screen.getByRole("heading", { name: /Write access required/i }),
		).toBeInTheDocument();
		expect(screen.queryByText("write form")).not.toBeInTheDocument();
	});

	it("renders the direct form for owner/admin/super-admin access", () => {
		access.canWrite = true;
		render(
			<AssetWriteRouteGuard>
				<div>write form</div>
			</AssetWriteRouteGuard>,
		);

		expect(screen.getByText("write form")).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: /Write access required/i }),
		).not.toBeInTheDocument();
	});
});
