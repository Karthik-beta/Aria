/**
 * Company service — CRUD for Companies.
 *
 * Follows the ERPNext Company DocType core business logic:
 * - Organization-scoped unique name and abbreviation
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
		organizationId: string,
		params?: Company.ListCompaniesInput,
	): Promise<Company.CompanyListResult> {
		this.assertOrganizationId(organizationId);
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = { organizationId };
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

	async findCompanyById(
		organizationId: string,
		id: string,
	): Promise<Company.CompanyItem | null> {
		this.assertOrganizationId(organizationId);
		const company = await this.prisma.company.findFirst({
			where: { id, organizationId },
			select: companySelect,
		});
		return company ? toCompany(company) : null;
	}

	async createCompany(
		organizationId: string,
		input: Company.CreateCompanyInput,
	): Promise<Company.CompanyItem> {
		this.assertOrganizationId(organizationId);
		const name = input.name.trim();
		const abbreviation = input.abbreviation?.trim() || null;

		// Validate unique name
		const existingByName = await this.prisma.company.findFirst({
			where: { organizationId, name },
			select: { id: true },
		});
		if (existingByName) {
			throw new ConflictException(`Company with name "${name}" already exists`);
		}

		// Validate unique abbreviation
		if (abbreviation) {
			const existingByAbbr = await this.prisma.company.findFirst({
				where: { organizationId, abbreviation },
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
			await this.validateParentCompany(
				organizationId,
				input.parentCompanyId,
				null,
			);
		}

		const created = await this.prisma.company.create({
			data: {
				organizationId,
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
		organizationId: string,
		input: Company.UpdateCompanyInput,
	): Promise<Company.CompanyItem> {
		this.assertOrganizationId(organizationId);
		const existing = await this.prisma.company.findFirst({
			where: { id: input.id, organizationId },
			select: { id: true, name: true, abbreviation: true },
		});
		if (!existing) {
			throw new NotFoundException(`Company ${input.id} not found`);
		}

		// Validate unique name
		if (input.name !== undefined) {
			const name = input.name.trim();
			if (name !== existing.name) {
				const duplicate = await this.prisma.company.findFirst({
					where: { organizationId, name, id: { not: input.id } },
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
					where: {
						organizationId,
						abbreviation: abbr,
						id: { not: input.id },
					},
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
				await this.validateParentCompany(
					organizationId,
					input.parentCompanyId,
					input.id,
				);
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

	async deleteCompany(
		organizationId: string,
		id: string,
	): Promise<{ success: boolean; id: string }> {
		this.assertOrganizationId(organizationId);
		const existing = await this.prisma.company.findFirst({
			where: { id, organizationId },
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

	async deleteManyCompanies(
		organizationId: string,
		ids: string[],
	): Promise<{ count: number }> {
		this.assertOrganizationId(organizationId);
		let deleted = 0;
		for (const id of ids) {
			try {
				await this.deleteCompany(organizationId, id);
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
	// Private helpers
	// ============================================================================

	private async validateParentCompany(
		organizationId: string,
		parentId: string,
		selfId: string | null,
	): Promise<void> {
		if (selfId && parentId === selfId) {
			throw new BadRequestException("A company cannot be its own parent");
		}

		const parent = await this.prisma.company.findFirst({
			where: { id: parentId, organizationId },
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

	private assertOrganizationId(organizationId: string): void {
		if (!organizationId || organizationId === "__super_admin__") {
			throw new BadRequestException(
				"Select an organization before accessing company data",
			);
		}
	}
}
