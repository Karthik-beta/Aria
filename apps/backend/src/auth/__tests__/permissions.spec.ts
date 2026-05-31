import { describe, expect, it } from "bun:test";
import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access";

const statement = { ...defaultStatements } as const;
const ac = createAccessControl(statement);

describe("Organization Permissions", () => {
	it("defaultStatements includes organization, member, invitation, team, ac", () => {
		expect(defaultStatements).toHaveProperty("organization");
		expect(defaultStatements).toHaveProperty("member");
		expect(defaultStatements).toHaveProperty("invitation");
		expect(defaultStatements).toHaveProperty("team");
		expect(defaultStatements).toHaveProperty("ac");
	});

	it("owner role has full permissions (update + delete org)", () => {
		const owner = ac.newRole({ ...ownerAc.statements });
		const stats = owner.statements;
		expect(stats.organization).toContain("update");
		expect(stats.organization).toContain("delete");
	});

	it("admin role can update org but NOT delete", () => {
		const admin = ac.newRole({ ...adminAc.statements });
		const stats = admin.statements;
		expect(stats.organization).toContain("update");
		expect(stats.organization).not.toContain("delete");
	});

	it("admin role can manage members (create, update, delete)", () => {
		const admin = ac.newRole({ ...adminAc.statements });
		const stats = admin.statements;
		expect(stats.member).toContain("create");
		expect(stats.member).toContain("update");
		expect(stats.member).toContain("delete");
	});

	it("admin role can manage invitations", () => {
		const admin = ac.newRole({ ...adminAc.statements });
		const stats = admin.statements;
		expect(stats.invitation).toContain("create");
		expect(stats.invitation).toContain("cancel");
	});

	it("member role has no organization permissions", () => {
		const member = ac.newRole({ ...memberAc.statements });
		const stats = member.statements;
		expect(stats.organization).toEqual([]);
		expect(stats.member).toEqual([]);
		expect(stats.invitation).toEqual([]);
	});

	it("member role has read permission on ac", () => {
		const member = ac.newRole({ ...memberAc.statements });
		const stats = member.statements;
		expect(stats.ac).toContain("read");
	});

	it("createAccessControl with custom statement supports extension", () => {
		const customStatement = {
			...defaultStatements,
			inventory: ["create", "read", "update", "delete"],
		} as const;
		const customAc = createAccessControl(customStatement);
		const customAdmin = customAc.newRole({
			...adminAc.statements,
			inventory: ["create", "read"],
		});
		const stats = customAdmin.statements;
		expect(stats.inventory).toContain("create");
		expect(stats.inventory).toContain("read");
		expect(stats.inventory).not.toContain("delete");
	});

	it("access control roles are independent instances", () => {
		const owner = ac.newRole({ ...ownerAc.statements });
		const admin = ac.newRole({ ...adminAc.statements });
		// Modifying owner should not affect admin
		expect(owner.statements.organization).toContain("delete");
		expect(admin.statements.organization).not.toContain("delete");
	});
});
