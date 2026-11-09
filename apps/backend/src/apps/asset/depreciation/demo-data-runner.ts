import { type INestApplicationContext, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DatabaseModule } from "../../../shared/database.module";
import { PrismaService } from "../../../shared/prisma.service";
import type { DemoDepreciationCoordinator } from "./demo-data.types";
import { DepreciationBarrierService } from "./depreciation-barrier.service";
import { DepreciationExecutionModule } from "./depreciation-execution.module";

@Module({ imports: [DatabaseModule, DepreciationExecutionModule] })
export class DemoDepreciationModule {}

/** Runs demo seeding with the production queue worker but no cron scheduler. */
export async function runWithDemoDepreciationApplication<T>(
	application: Pick<INestApplicationContext, "get" | "close">,
	callback: (
		prisma: PrismaService,
		coordinator: DemoDepreciationCoordinator,
	) => Promise<T>,
): Promise<T> {
	try {
		const prisma = application.get(PrismaService);
		const barrier = application.get(DepreciationBarrierService);
		return await callback(prisma, {
			async ensurePosted(scope) {
				await barrier.ensureDepreciationPosted(scope);
			},
		});
	} finally {
		await application.close();
	}
}

/** Creates and closes the scheduler-free Nest context used by demo loading. */
export async function withDemoDepreciationExecution<T>(
	callback: (
		prisma: PrismaService,
		coordinator: DemoDepreciationCoordinator,
	) => Promise<T>,
): Promise<T> {
	const application = await NestFactory.createApplicationContext(
		DemoDepreciationModule,
	);
	return runWithDemoDepreciationApplication(application, callback);
}
