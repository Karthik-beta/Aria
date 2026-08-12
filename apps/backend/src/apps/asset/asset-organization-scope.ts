import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";

/**
 * Trusted organization identity supplied by the authenticated tRPC context.
 *
 * Asset ownership is persisted through `Asset.companyId` and
 * `Company.organizationId`; this type deliberately contains no client input.
 */
export type AssetOrganizationId = string;

/**
 * Builds the canonical Asset ownership predicate used at Prisma boundaries.
 */
export function assetWhereForOrganization(
	organizationId: AssetOrganizationId,
	where: Prisma.AssetWhereInput = {},
): Prisma.AssetWhereInput {
	return {
		AND: [{ company: { is: { organizationId } } }, where],
	};
}

/**
 * Builds a Company predicate for records whose ownership is stored directly on
 * the Company row.
 */
export function companyWhereForOrganization(
	organizationId: AssetOrganizationId,
	where: Prisma.CompanyWhereInput = {},
): Prisma.CompanyWhereInput {
	return {
		AND: [{ organizationId }, where],
	};
}

/**
 * Rejects the synthetic super-admin placeholder and missing context before a
 * user-facing Asset service method reaches Prisma.
 */
export function assertAssetOrganizationId(
	organizationId: AssetOrganizationId,
): void {
	if (!organizationId || organizationId === "__super_admin__") {
		throw new BadRequestException(
			"A trusted active organization is required for Asset access",
		);
	}
}
