import { Company } from "@aria/types";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { EventEmitter2 } from "@nestjs/event-emitter";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { orgProcedure, router } from "../../../trpc/trpc";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { CompanyService } from "../company.service";

type CompaniesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Company.CompanyItem | { id: string };
};

@Injectable()
export class CompanyRouter {
	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly companyService: CompanyService,
	) {}

	getRouter() {
		const svc = this.companyService;
		const companyProcedure = orgProcedure();

		return router({
			listCompanies: companyProcedure
				.input(Company.listCompaniesSchema)
				.query(async ({ input, ctx }) =>
					svc.findAllCompanies(ctx.organization.id, input),
				),

			getCompanyById: companyProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input, ctx }) =>
					svc.findCompanyById(ctx.organization.id, input.id),
				),

			createCompany: companyProcedure
				.input(Company.createCompanySchema)
				.mutation(async ({ input, ctx }) => {
					const company = await svc.createCompany(ctx.organization.id, input);
					this.eventEmitter.emit("companiesChanged", {
						type: "created",
						data: company,
					} satisfies CompaniesChangedEvent);
					return company;
				}),

			updateCompany: companyProcedure
				.input(Company.updateCompanySchema)
				.mutation(async ({ input, ctx }) => {
					const company = await svc.updateCompany(ctx.organization.id, input);
					this.eventEmitter.emit("companiesChanged", {
						type: "updated",
						data: company,
					} satisfies CompaniesChangedEvent);
					return company;
				}),

			deleteCompany: companyProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteCompany(ctx.organization.id, input.id);
					this.eventEmitter.emit("companiesChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies CompaniesChangedEvent);
					return result;
				}),

			deleteManyCompanies: companyProcedure
				.input(Company.bulkDeleteCompaniesSchema)
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteManyCompanies(
						ctx.organization.id,
						input.ids,
					);
					for (const id of input.ids) {
						this.eventEmitter.emit("companiesChanged", {
							type: "deleted",
							data: { id },
						} satisfies CompaniesChangedEvent);
					}
					return result;
				}),

			onCompaniesChanged: companyProcedure.subscription(() =>
				observable<CompaniesChangedEvent>((emit) => {
					const handler = (event: CompaniesChangedEvent) => emit.next(event);
					this.eventEmitter.on("companiesChanged", handler);
					return () => this.eventEmitter.off("companiesChanged", handler);
				}),
			),
		});
	}
}
