import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(
	resolve(process.cwd(), "src/apps/asset/trpc/asset.router.ts"),
	"utf8",
);

const writeProcedures = [
	"createLocation",
	"updateLocation",
	"deleteLocation",
	"createMaintenanceTeam",
	"updateMaintenanceTeam",
	"deleteMaintenanceTeam",
	"deleteManyMaintenanceTeams",
	"createAssetMaintenance",
	"updateAssetMaintenance",
	"deleteAssetMaintenance",
	"deleteManyAssetMaintenances",
	"cancelAssetMaintenanceLog",
	"completeAssetMaintenanceLog",
];

describe("Asset router write authorization", () => {
	it.each(
		writeProcedures,
	)("requires the owner/admin procedure for %s", (procedure: string) => {
		const procedureBlock = routerSource.slice(
			routerSource.indexOf(`${procedure}:`),
		);
		expect(procedureBlock).toMatch(
			new RegExp(`${procedure}:\\s*assetWriteProcedure`),
		);
	});

	it("keeps actor identity outside public input schemas", () => {
		expect(routerSource).toContain(
			"svc.createAssetMovement(input, ctx.user.id)",
		);
		expect(routerSource).toContain(
			"svc.createAssetCapitalization(input, ctx.user.id)",
		);
		expect(routerSource).toContain("svc.submitAsset(input.id, ctx.user.id)");
		expect(routerSource).toContain("svc.cancelAsset(input.id, ctx.user.id)");
	});
});
