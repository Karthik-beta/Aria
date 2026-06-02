import type { Company } from "@aria/types";
import type { Prisma } from "../../generated/prisma/client";

/**
 * Prisma model type for Company with parent relation included.
 */
export type PrismaCompany = Prisma.CompanyGetPayload<{
	select: {
		id: true;
		name: true;
		abbreviation: true;
		country: true;
		currency: true;
		taxId: true;
		domain: true;
		isGroup: true;
		parentCompanyId: true;
		parentCompany: { select: { id: true; name: true } };
		disabled: true;
		createdAt: true;
		updatedAt: true;
	};
}>;

/**
 * Default select shape for Company queries.
 */
export const companySelect = {
	id: true,
	name: true,
	abbreviation: true,
	country: true,
	currency: true,
	taxId: true,
	domain: true,
	isGroup: true,
	parentCompanyId: true,
	parentCompany: { select: { id: true, name: true } },
	disabled: true,
	createdAt: true,
	updatedAt: true,
} as const;

/**
 * Maps a Prisma Company record to the Company.CompanyItem domain type.
 */
export function toCompany(raw: PrismaCompany): Company.CompanyItem {
	return {
		id: raw.id,
		name: raw.name,
		abbreviation: raw.abbreviation ?? null,
		country: raw.country ?? null,
		currency: raw.currency ?? null,
		taxId: raw.taxId ?? null,
		domain: raw.domain ?? null,
		isGroup: raw.isGroup,
		parentCompanyId: raw.parentCompanyId ?? null,
		parentCompanyName: raw.parentCompany?.name ?? null,
		disabled: raw.disabled,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	};
}
