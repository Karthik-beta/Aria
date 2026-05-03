import { Injectable } from "@nestjs/common";
import type { PrismaService } from "../../shared/prisma.service";

export interface CompanyInfo {
	id: string;
	name: string;
	abbreviation: string | null;
	country: string | null;
	currency: string | null;
	disabled: boolean;
}

@Injectable()
export class CompanyService {
	constructor(private readonly prisma: PrismaService) {}

	async getCompany(id: string): Promise<CompanyInfo | null> {
		const company = await this.prisma.company.findUnique({
			where: { id },
		});
		if (!company) return null;
		return {
			id: company.id,
			name: company.name,
			abbreviation: company.abbreviation,
			country: company.country,
			currency: company.currency,
			disabled: company.disabled,
		};
	}

	async getCompanyByName(name: string): Promise<CompanyInfo | null> {
		const company = await this.prisma.company.findUnique({
			where: { name },
		});
		if (!company) return null;
		return {
			id: company.id,
			name: company.name,
			abbreviation: company.abbreviation,
			country: company.country,
			currency: company.currency,
			disabled: company.disabled,
		};
	}
}
