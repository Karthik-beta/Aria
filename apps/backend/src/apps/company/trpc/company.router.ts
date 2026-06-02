import { EventEmitter } from "node:events";
import { Company } from "@aria/types";
import { logger } from "@aria/utils";
import { Injectable } from "@nestjs/common";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { orgProcedure, router } from "../../../trpc/trpc";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { CompanyService } from "../company.service";

const companyEvents = new EventEmitter({ captureRejections: true });
companyEvents.setMaxListeners(50);
companyEvents.on("error", (error) => {
	logger.error("[companyEvents]", error);
});

type CompaniesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Company.CompanyItem | { id: string };
};

@Injectable()
export class CompanyRouter {
	constructor(private readonly companyService: CompanyService) {}

	getRouter() {
		const svc = this.companyService;
		const companyProcedure = orgProcedure();

		return router({
			listCompanies: companyProcedure
				.input(Company.listCompaniesSchema)
				.query(async ({ input }) => svc.findAllCompanies(input)),

			getCompanyById: companyProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findCompanyById(input.id)),

			createCompany: companyProcedure
				.input(Company.createCompanySchema)
				.mutation(async ({ input }) => {
					const company = await svc.createCompany(input);
					companyEvents.emit("companiesChanged", {
						type: "created",
						data: company,
					} satisfies CompaniesChangedEvent);
					return company;
				}),

			updateCompany: companyProcedure
				.input(Company.updateCompanySchema)
				.mutation(async ({ input }) => {
					const company = await svc.updateCompany(input);
					companyEvents.emit("companiesChanged", {
						type: "updated",
						data: company,
					} satisfies CompaniesChangedEvent);
					return company;
				}),

			deleteCompany: companyProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteCompany(input.id);
					companyEvents.emit("companiesChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies CompaniesChangedEvent);
					return result;
				}),

			deleteManyCompanies: companyProcedure
				.input(Company.bulkDeleteCompaniesSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteManyCompanies(input.ids);
					for (const id of input.ids) {
						companyEvents.emit("companiesChanged", {
							type: "deleted",
							data: { id },
						} satisfies CompaniesChangedEvent);
					}
					return result;
				}),

			onCompaniesChanged: companyProcedure.subscription(() =>
				observable<CompaniesChangedEvent>((emit) => {
					const handler = (event: CompaniesChangedEvent) => emit.next(event);
					companyEvents.on("companiesChanged", handler);
					return () => companyEvents.off("companiesChanged", handler);
				}),
			),
		});
	}
}
