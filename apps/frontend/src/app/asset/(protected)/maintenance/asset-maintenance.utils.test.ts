import { describe, expect, it } from "vitest";
import {
	buildAssetMaintenanceListInput,
	formatMaintenanceStatus,
	formatMaintenanceTaskType,
	formatPeriodicity,
	getRelativeAge,
	toCreateAssetMaintenanceInput,
	toUpdateAssetMaintenanceInput,
} from "./asset-maintenance.utils";

const baseTask = {
	maintenanceTask: "  Lubrication Check  ",
	maintenanceType: "PREVENTIVE_MAINTENANCE" as const,
	maintenanceStatus: "PLANNED" as const,
	startDate: "2026-01-01",
	periodicity: "MONTHLY" as const,
	endDate: null,
	certificateRequired: false,
	assignTo: null,
	assignToName: null,
	description: null,
};

const baseFormValues = {
	assetId: "  clh0001aaabbbccc  ",
	companyId: "  company-acme  ",
	maintenanceTeamId: "  clh0002aaabbbccc  ",
	maintenanceManager: "  manager@example.com  ",
	maintenanceManagerName: "  Manager Name  ",
	tasks: [baseTask],
};

describe("asset-maintenance.utils", () => {
	describe("getRelativeAge", () => {
		it("returns 'Today' for dates within the last 24 hours", () => {
			const now = new Date();
			expect(getRelativeAge(now)).toBe("Today");
		});

		it("returns days for dates 1-29 days ago", () => {
			const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("5 d");
		});

		it("returns months for dates 1-11 months ago", () => {
			const date = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("1 m");
		});

		it("returns years for dates 1+ year ago", () => {
			const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("1 y");
		});
	});

	describe("formatMaintenanceStatus", () => {
		it("formats PLANNED", () => {
			expect(formatMaintenanceStatus("PLANNED")).toBe("Planned");
		});

		it("formats OVERDUE", () => {
			expect(formatMaintenanceStatus("OVERDUE")).toBe("Overdue");
		});

		it("formats CANCELLED", () => {
			expect(formatMaintenanceStatus("CANCELLED")).toBe("Cancelled");
		});
	});

	describe("formatPeriodicity", () => {
		it("formats MONTHLY", () => {
			expect(formatPeriodicity("MONTHLY")).toBe("Monthly");
		});

		it("formats HALF_YEARLY", () => {
			expect(formatPeriodicity("HALF_YEARLY")).toBe("Half-Yearly");
		});

		it("formats TWO_YEARLY", () => {
			expect(formatPeriodicity("TWO_YEARLY")).toBe("2-Yearly");
		});
	});

	describe("formatMaintenanceTaskType", () => {
		it("formats PREVENTIVE_MAINTENANCE", () => {
			expect(formatMaintenanceTaskType("PREVENTIVE_MAINTENANCE")).toBe(
				"Preventive",
			);
		});

		it("formats CALIBRATION", () => {
			expect(formatMaintenanceTaskType("CALIBRATION")).toBe("Calibration");
		});
	});

	describe("toCreateAssetMaintenanceInput", () => {
		it("maps form values with all fields to create payload", () => {
			const result = toCreateAssetMaintenanceInput(baseFormValues);

			expect(result.assetId).toBe("clh0001aaabbbccc");
			expect(result.companyId).toBe("company-acme");
			expect(result.maintenanceTeamId).toBe("clh0002aaabbbccc");
			expect(result.maintenanceManager).toBe("manager@example.com");
			expect(result.maintenanceManagerName).toBe("Manager Name");
			expect(result.tasks).toHaveLength(1);
			expect(result.tasks[0]?.maintenanceTask).toBe("Lubrication Check");
			expect(result.tasks[0]?.startDate).toBe("2026-01-01");
		});

		it("sets maintenanceManager to null when empty string", () => {
			const result = toCreateAssetMaintenanceInput({
				...baseFormValues,
				maintenanceManager: "",
				maintenanceManagerName: undefined,
			});

			expect(result.maintenanceManager).toBeNull();
			expect(result.maintenanceManagerName).toBeNull();
		});

		it("converts endDate string to Date when provided", () => {
			const result = toCreateAssetMaintenanceInput({
				...baseFormValues,
				tasks: [{ ...baseTask, endDate: "2026-12-31" }],
			});

			expect(result.tasks[0]?.endDate).toBe("2026-12-31");
		});

		it("sets endDate to null when not provided", () => {
			const result = toCreateAssetMaintenanceInput(baseFormValues);

			expect(result.tasks[0]?.endDate).toBeNull();
		});
	});

	describe("toUpdateAssetMaintenanceInput", () => {
		it("includes id in update payload", () => {
			const result = toUpdateAssetMaintenanceInput(
				"clhrecord001",
				baseFormValues,
			);

			expect(result.id).toBe("clhrecord001");
			expect(result.companyId).toBe("company-acme");
		});

		it("preserves task id in update payload", () => {
			const result = toUpdateAssetMaintenanceInput("clhrecord001", {
				...baseFormValues,
				tasks: [{ ...baseTask, id: "clhtask001" }],
			});

			expect(result.tasks?.[0]?.id).toBe("clhtask001");
		});

		it("sets task id to undefined when not present", () => {
			const result = toUpdateAssetMaintenanceInput(
				"clhrecord001",
				baseFormValues,
			);

			expect(result.tasks?.[0]?.id).toBeUndefined();
		});
	});

	describe("buildAssetMaintenanceListInput", () => {
		it("builds correct pagination offset from pageIndex", () => {
			const result = buildAssetMaintenanceListInput({
				search: "",
				pageIndex: 2,
				pageSize: 20,
			});

			expect(result.skip).toBe(40);
			expect(result.take).toBe(20);
		});

		it("includes trimmed search string when non-empty", () => {
			const result = buildAssetMaintenanceListInput({
				search: "  pump  ",
				pageIndex: 0,
				pageSize: 20,
			});

			expect(result.search).toBe("pump");
		});

		it("sets search to undefined when empty string", () => {
			const result = buildAssetMaintenanceListInput({
				search: "",
				pageIndex: 0,
				pageSize: 20,
			});

			expect(result.search).toBeUndefined();
		});
	});
});
