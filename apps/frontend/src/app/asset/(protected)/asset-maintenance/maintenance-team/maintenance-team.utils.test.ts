import { describe, expect, it } from "vitest";
import {
	buildMaintenanceTeamListInput,
	getRelativeAge,
	toCreateMaintenanceTeamInput,
	toUpdateMaintenanceTeamInput,
} from "./maintenance-team.utils";

describe("maintenance-team.utils", () => {
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

	describe("toCreateMaintenanceTeamInput", () => {
		it("maps form values with all fields to create payload", () => {
			const result = toCreateMaintenanceTeamInput({
				name: "  Alpha Team  ",
				maintenanceManager: "  manager@example.com  ",
				maintenanceManagerName: "  Manager Name  ",
				company: "  ACME Corp  ",
				members: [
					{
						teamMember: "  john@example.com  ",
						fullName: "  John Doe  ",
						maintenanceRole: "  Technician  ",
					},
				],
			});

			expect(result).toEqual({
				name: "Alpha Team",
				maintenanceManager: "manager@example.com",
				maintenanceManagerName: "Manager Name",
				company: "ACME Corp",
				members: [
					{
						teamMember: "john@example.com",
						fullName: "John Doe",
						maintenanceRole: "Technician",
					},
				],
			});
		});

		it("sets maintenanceManager to null when empty string", () => {
			const result = toCreateMaintenanceTeamInput({
				name: "Beta Team",
				maintenanceManager: "",
				maintenanceManagerName: undefined,
				company: "Beta Corp",
				members: [
					{
						teamMember: "jane@example.com",
						fullName: "Jane",
						maintenanceRole: "Engineer",
					},
				],
			});

			expect(result.maintenanceManager).toBeNull();
			expect(result.maintenanceManagerName).toBeNull();
		});

		it("preserves multiple members", () => {
			const result = toCreateMaintenanceTeamInput({
				name: "Gamma Team",
				company: "Gamma Corp",
				members: [
					{
						teamMember: "a@example.com",
						fullName: "A",
						maintenanceRole: "Mechanic",
					},
					{
						teamMember: "b@example.com",
						fullName: "B",
						maintenanceRole: "Inspector",
					},
				],
			});
			expect(result.members).toHaveLength(2);
		});
	});

	describe("toUpdateMaintenanceTeamInput", () => {
		it("maps form values to update payload with id", () => {
			const result = toUpdateMaintenanceTeamInput("team-001", {
				name: "Alpha Team Updated",
				maintenanceManager: "new@example.com",
				maintenanceManagerName: "New Manager",
				company: "NewCorp",
				members: [
					{
						id: "mem-001",
						teamMember: "john@example.com",
						fullName: "John Doe",
						maintenanceRole: "Technician",
					},
				],
			});

			expect(result.id).toBe("team-001");
			expect(result.name).toBe("Alpha Team Updated");
			expect(result.members?.[0]?.id).toBe("mem-001");
		});

		it("omits member id when not present", () => {
			const result = toUpdateMaintenanceTeamInput("team-001", {
				name: "Alpha Team",
				company: "ACME Corp",
				members: [
					{
						teamMember: "new@example.com",
						fullName: "New Person",
						maintenanceRole: "Technician",
					},
				],
			});
			expect(result.members?.[0]?.id).toBeUndefined();
		});
	});

	describe("buildMaintenanceTeamListInput", () => {
		it("builds correct input for first page", () => {
			const result = buildMaintenanceTeamListInput({
				search: "",
				pageIndex: 0,
				pageSize: 20,
			});

			expect(result).toEqual({
				skip: 0,
				take: 20,
				search: undefined,
			});
		});

		it("calculates correct skip for subsequent pages", () => {
			const result = buildMaintenanceTeamListInput({
				search: "",
				pageIndex: 2,
				pageSize: 20,
			});

			expect(result.skip).toBe(40);
			expect(result.take).toBe(20);
		});

		it("includes trimmed search term when non-empty", () => {
			const result = buildMaintenanceTeamListInput({
				search: "  alpha  ",
				pageIndex: 0,
				pageSize: 20,
			});

			expect(result.search).toBe("alpha");
		});

		it("sets search to undefined when empty", () => {
			const result = buildMaintenanceTeamListInput({
				search: "   ",
				pageIndex: 0,
				pageSize: 20,
			});

			expect(result.search).toBeUndefined();
		});
	});
});
