const { PrismaClient } = require("@prisma/client");
const { version } = require("@prisma/client/package.json");

void (async () => {
	const { logger } = await import("@aria/utils/dist/logger.js");

	try {
		logger.info("✓ Successfully imported PrismaClient from @prisma/client");

		const prisma = new PrismaClient();
		logger.info("✓ Successfully instantiated PrismaClient");

		logger.info(
			"✓ Prisma namespace available:",
			typeof prisma.$connect === "function",
		);
		logger.info("✓ Prisma version:", version);

		logger.info("\n✅ All Prisma client tests passed!");
	} catch (err) {
		logger.error("❌ Test failed:", err);
		process.exit(1);
	}
})();
