/**
 * Company service — CRUD for Companies.
 *
 * Follows the ERPNext Company DocType core business logic:
 * - Unique name and abbreviation
 * - Parent company must be a group company
 * - Cannot set parentCompanyId to self
 * - Cannot delete if children exist
 *
 * @module CompanyService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/company | ERPNext Company}
 */
import type { Company } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { companySelect, toCompany } from "./company.types";

const LIST_TAKE_MAX = 250;

@Injectable()
export class CompanyService {
	private readonly logger = new Logger(CompanyService.name);

	constructor(private readonly prisma: PrismaService) {}

	// ============================================================================
	// Company CRUD
	// ============================================================================

	async findAllCompanies(
		params?: Company.ListCompaniesInput,
	): Promise<Company.CompanyListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.isGroup !== undefined) where.isGroup = params.isGroup;
		if (params?.search) {
			where.OR = [
				{ name: { contains: params.search, mode: "insensitive" } },
				{ abbreviation: { contains: params.search, mode: "insensitive" } },
				{ country: { contains: params.search, mode: "insensitive" } },
				{ currency: { contains: params.search, mode: "insensitive" } },
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.company.findMany({
				where,
				select: companySelect,
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.company.count({ where }),
		]);

		return { items: items.map(toCompany), totalCount };
	}

	async findCompanyById(id: string): Promise<Company.CompanyItem | null> {
		const company = await this.prisma.company.findUnique({
			where: { id },
			select: companySelect,
		});
		return company ? toCompany(company) : null;
	}

	async createCompany(
		input: Company.CreateCompanyInput,
	): Promise<Company.CompanyItem> {
		const name = input.name.trim();
		const abbreviation = input.abbreviation?.trim() || null;

		// Validate unique name
		const existingByName = await this.prisma.company.findUnique({
			where: { name },
			select: { id: true },
		});
		if (existingByName) {
			throw new ConflictException(`Company with name "${name}" already exists`);
		}

		// Validate unique abbreviation
		if (abbreviation) {
			const existingByAbbr = await this.prisma.company.findFirst({
				where: { abbreviation },
				select: { id: true },
			});
			if (existingByAbbr) {
				throw new ConflictException(
					`Company with abbreviation "${abbreviation}" already exists`,
				);
			}
		}

		// Validate parent company
		if (input.parentCompanyId) {
			await this.validateParentCompany(input.parentCompanyId, null);
		}

		const created = await this.prisma.company.create({
			data: {
				name,
				abbreviation,
				country: input.country?.trim() || null,
				currency: input.currency?.trim() || null,
				taxId: input.taxId?.trim() || null,
				domain: input.domain?.trim() || null,
				isGroup: input.isGroup ?? false,
				parentCompanyId: input.parentCompanyId || null,
				defaultFinanceBookId: input.defaultFinanceBookId || null,
				depreciationEntrySeries: input.depreciationEntrySeries?.trim() || null,
				defaultCostCenter: input.defaultCostCenter?.trim() || null,
				accumulatedDepreciationAccount:
					input.accumulatedDepreciationAccount?.trim() || null,
				depreciationExpenseAccount:
					input.depreciationExpenseAccount?.trim() || null,
				accountsFrozenThrough: input.accountsFrozenThrough ?? null,
			},
			select: companySelect,
		});

		return toCompany(created);
	}

	async updateCompany(
		input: Company.UpdateCompanyInput,
	): Promise<Company.CompanyItem> {
		const existing = await this.prisma.company.findUnique({
			where: { id: input.id },
			select: { id: true, name: true, abbreviation: true },
		});
		if (!existing) {
			throw new NotFoundException(`Company ${input.id} not found`);
		}

		// Validate unique name
		if (input.name !== undefined) {
			const name = input.name.trim();
			if (name !== existing.name) {
				const duplicate = await this.prisma.company.findUnique({
					where: { name },
					select: { id: true },
				});
				if (duplicate) {
					throw new ConflictException(
						`Company with name "${name}" already exists`,
					);
				}
			}
		}

		// Validate unique abbreviation
		if (input.abbreviation !== undefined) {
			const abbr = input.abbreviation?.trim() || null;
			if (abbr && abbr !== existing.abbreviation) {
				const duplicate = await this.prisma.company.findFirst({
					where: { abbreviation: abbr, id: { not: input.id } },
					select: { id: true },
				});
				if (duplicate) {
					throw new ConflictException(
						`Company with abbreviation "${abbr}" already exists`,
					);
				}
			}
		}

		// Validate parent company
		if (input.parentCompanyId !== undefined) {
			if (input.parentCompanyId) {
				await this.validateParentCompany(input.parentCompanyId, input.id);
			}
		}

		const updated = await this.prisma.company.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined && { name: input.name.trim() }),
				...(input.abbreviation !== undefined && {
					abbreviation: input.abbreviation?.trim() || null,
				}),
				...(input.country !== undefined && {
					country: input.country?.trim() || null,
				}),
				...(input.currency !== undefined && {
					currency: input.currency?.trim() || null,
				}),
				...(input.taxId !== undefined && {
					taxId: input.taxId?.trim() || null,
				}),
				...(input.domain !== undefined && {
					domain: input.domain?.trim() || null,
				}),
				...(input.isGroup !== undefined && { isGroup: input.isGroup }),
				...(input.parentCompanyId !== undefined && {
					parentCompanyId: input.parentCompanyId || null,
				}),
				...(input.disabled !== undefined && { disabled: input.disabled }),
				...(input.defaultFinanceBookId !== undefined && {
					defaultFinanceBookId: input.defaultFinanceBookId || null,
				}),
				...(input.depreciationEntrySeries !== undefined && {
					depreciationEntrySeries:
						input.depreciationEntrySeries?.trim() || null,
				}),
				...(input.defaultCostCenter !== undefined && {
					defaultCostCenter: input.defaultCostCenter?.trim() || null,
				}),
				...(input.accumulatedDepreciationAccount !== undefined && {
					accumulatedDepreciationAccount:
						input.accumulatedDepreciationAccount?.trim() || null,
				}),
				...(input.depreciationExpenseAccount !== undefined && {
					depreciationExpenseAccount:
						input.depreciationExpenseAccount?.trim() || null,
				}),
				...(input.accountsFrozenThrough !== undefined && {
					accountsFrozenThrough: input.accountsFrozenThrough ?? null,
				}),
			},
			select: companySelect,
		});

		return toCompany(updated);
	}

	async deleteCompany(id: string): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.company.findUnique({
			where: { id },
			select: { id: true, name: true },
		});
		if (!existing) {
			throw new NotFoundException(`Company ${id} not found`);
		}

		// Check for children
		const children = await this.prisma.company.count({
			where: { parentCompanyId: id },
		});
		if (children > 0) {
			throw new BadRequestException(
				`Cannot delete company "${existing.name}" because it has ${children} child company(ies). Remove the parent reference from children first.`,
			);
		}

		// Check for fiscal year references
		const fiscalYearRefs = await this.prisma.fiscalYearCompany.count({
			where: { companyId: id },
		});
		if (fiscalYearRefs > 0) {
			throw new BadRequestException(
				`Cannot delete company "${existing.name}" because it is linked to ${fiscalYearRefs} fiscal year(s).`,
			);
		}

		await this.prisma.company.delete({ where: { id } });
		return { success: true, id };
	}

	async deleteManyCompanies(ids: string[]): Promise<{ count: number }> {
		let deleted = 0;
		for (const id of ids) {
			try {
				await this.deleteCompany(id);
				deleted++;
			} catch (error) {
				this.logger.warn(
					`Failed to delete company ${id}: ${(error as Error).message}`,
				);
			}
		}
		return { count: deleted };
	}

	// ============================================================================
	// Legacy methods (used by other modules)
	// ============================================================================

	async getCompany(id: string): Promise<{
		id: string;
		name: string;
		abbreviation: string | null;
		country: string | null;
		currency: string | null;
		disabled: boolean;
	} | null> {
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

	async getCompanyByName(name: string): Promise<{
		id: string;
		name: string;
		abbreviation: string | null;
		country: string | null;
		currency: string | null;
		disabled: boolean;
	} | null> {
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

	// ============================================================================
	// Private helpers
	// ============================================================================

	private async validateParentCompany(
		parentId: string,
		selfId: string | null,
	): Promise<void> {
		if (selfId && parentId === selfId) {
			throw new BadRequestException("A company cannot be its own parent");
		}

		const parent = await this.prisma.company.findUnique({
			where: { id: parentId },
			select: { id: true, isGroup: true, name: true },
		});

		if (!parent) {
			throw new NotFoundException(`Parent company ${parentId} not found`);
		}

		if (!parent.isGroup) {
			throw new BadRequestException(
				`Parent company "${parent.name}" must be a group company (isGroup=true)`,
			);
		}
	}
}
