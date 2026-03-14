const { PrismaClientKnownRequestError } = require("@prisma/client");

void (async () => {
	const { logger } = await import("@aria/utils/dist/logger.js");

	// Test error construction
	try {
		const error = new PrismaClientKnownRequestError("Test message", {
			code: "P2025",
			clientVersion: "5.0.0",
		});
		logger.info("Error created successfully:", error.message, error.code);
	} catch (e) {
		logger.error("Error creating:", e.message);
	}
})();
