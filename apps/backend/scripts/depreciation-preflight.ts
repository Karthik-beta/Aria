import "dotenv/config";
import { DepreciationQueueClient } from "../src/apps/asset/depreciation/depreciation-queue.client";
import { prismaClient } from "../src/shared/prisma-client";

type CountRow = { count: bigint };

async function count(query: TemplateStringsArray): Promise<number> {
	const rows = await prismaClient.$queryRawUnsafe<CountRow[]>(query[0] ?? "");
	return Number(rows[0]?.count ?? 0);
}

const queue = new DepreciationQueueClient();
try {
	const [
		missingCompanyConfiguration,
		missingCategoryAccounts,
		invalidOpenSchedules,
		duplicateOpenSchedules,
		frozenDuePeriods,
		pendingDuePeriods,
		queueStatus,
	] = await Promise.all([
		count`
			SELECT COUNT(*) AS count
			FROM "Company"
			WHERE "disabled" = false
			  AND (
			    "defaultFinanceBookId" IS NULL
			    OR "depreciationEntrySeries" IS NULL
			  )
		`,
		count`
			SELECT COUNT(*) AS count
			FROM "assets" asset
			JOIN "Company" company ON company."name" = asset."company"
			LEFT JOIN "asset_category_accounts" account
			  ON account."assetCategoryId" = asset."assetCategoryId"
			 AND account."companyId" = company."id"
			WHERE asset."calculateDepreciation" = true
			  AND asset."status" IN ('SUBMITTED', 'PARTIALLY_DEPRECIATED')
			  AND (
			    account."id" IS NULL
			    OR COALESCE(
			      account."accumulatedDepreciationAccount",
			      company."accumulatedDepreciationAccount"
			    ) IS NULL
			    OR COALESCE(
			      account."depreciationExpenseAccount",
			      company."depreciationExpenseAccount"
			    ) IS NULL
			  )
		`,
		count`
			SELECT COUNT(*) AS count
			FROM "asset_depreciation_schedules"
			WHERE "status" = 'ACTIVE'
			  AND (
			    "totalNumberOfDepreciations" < 1
			    OR "frequencyOfDepreciation" < 1
			    OR "remainingDepreciations" < 0
			    OR "bookedDepreciations" < 0
			  )
		`,
		count`
			SELECT COUNT(*) AS count
			FROM (
			  SELECT "assetFinanceBookId"
			  FROM "asset_depreciation_schedules"
			  WHERE "status" = 'ACTIVE'
			  GROUP BY "assetFinanceBookId"
			  HAVING COUNT(*) > 1
			) duplicate
		`,
		count`
			SELECT COUNT(*) AS count
			FROM "asset_depreciation_schedule_entries" entry
			JOIN "asset_depreciation_schedules" schedule
			  ON schedule."id" = entry."scheduleId"
			JOIN "assets" asset ON asset."id" = schedule."assetId"
			JOIN "Company" company ON company."name" = asset."company"
			WHERE schedule."status" = 'ACTIVE'
			  AND entry."postingId" IS NULL
			  AND entry."scheduleDate" <= CURRENT_DATE
			  AND company."accountsFrozenThrough" IS NOT NULL
			  AND entry."scheduleDate" <= company."accountsFrozenThrough"
		`,
		count`
			SELECT COUNT(*) AS count
			FROM "asset_depreciation_schedule_entries" entry
			JOIN "asset_depreciation_schedules" schedule
			  ON schedule."id" = entry."scheduleId"
			WHERE schedule."status" = 'ACTIVE'
			  AND entry."postingId" IS NULL
			  AND entry."scheduleDate" <= CURRENT_DATE
		`,
		queue.status(),
	]);

	const blockers = {
		missingCompanyConfiguration,
		missingCategoryAccounts,
		invalidOpenSchedules,
		duplicateOpenSchedules,
	};
	process.stdout.write(
		`${JSON.stringify(
			{
				ok: Object.values(blockers).every((value) => value === 0),
				blockers,
				frozenDuePeriods,
				pendingDuePeriods,
				redis: "ready",
				queue: queueStatus,
			},
			null,
			2,
		)}\n`,
	);
	if (Object.values(blockers).some((value) => value > 0)) process.exitCode = 1;
} catch (error) {
	process.stderr.write(
		`${JSON.stringify(
			{
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			},
			null,
			2,
		)}\n`,
	);
	process.exitCode = 1;
} finally {
	await Promise.allSettled([
		queue.onApplicationShutdown(),
		prismaClient.$disconnect(),
	]);
}
