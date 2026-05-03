import { Global, Module } from "@nestjs/common";
import { DatabaseModule } from "../database.module";
import { FiscalYearService } from "./fiscal-year.service";

@Global()
@Module({
	imports: [DatabaseModule],
	providers: [FiscalYearService],
	exports: [FiscalYearService],
})
export class FiscalYearModule {}
