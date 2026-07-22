import { Module } from "@nestjs/common";
import { CompanyService } from "./company.service";
import { CompanyRouter } from "./trpc/company.router";

@Module({
	providers: [CompanyService, CompanyRouter],
	exports: [CompanyRouter],
})
export class CompanyModule {}
