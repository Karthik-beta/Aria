import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "@aria/utils";
import { NestFactory } from "@nestjs/core";
import * as trpcExpress from "@trpc/server/adapters/express";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { toNodeHandler } from "better-auth/node";
import { config } from "dotenv";
import { WebSocketServer } from "ws";
import { AppModule } from "./app.module";
import { auth } from "./auth/auth.config";
import { TrpcContext } from "./trpc/trpc.context";
import { TrpcService } from "./trpc/trpc.service";

/**
 * Load environment variables from .env file
 *
 * In local development, dotenv loads environment variables from .env file.
 * In Docker/production, environment variables are passed directly to the container.
 * This ensures DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, etc. are available
 * during application startup for default user creation.
 *
 * Path resolution works in both development and production scenarios.
 */
// When running from monorepo root, path is apps/backend/.env
// When running from apps/backend directory, path is just .env
// We check both possibilities
const envPathOptions = [
	resolve(process.cwd(), "apps/backend/.env.development"), // Backend specific dev env
	resolve(process.cwd(), ".env.development"), // Root dev env
	resolve(process.cwd(), "apps/backend/.env"), // Backend specific .env
	resolve(process.cwd(), ".env"), // Root .env
];

let envPath = envPathOptions[0]; // Default to first option
try {
	// Find which path actually exists
	let fileContent: string | undefined;
	for (const path of envPathOptions) {
		try {
			fileContent = readFileSync(path, "utf-8");
			envPath = path;
			break;
		} catch {
			// Try next path
		}
	}

	if (!fileContent) {
		throw new Error("No .env file found");
	}

	// Load .env and explicitly merge with process.env
	const result = config({ path: envPath, override: true });

	if (result.error) {
		logger.error(`[ENV] Error parsing .env file: ${result.error.message}`);
	} else if (result.parsed) {
		const parsedCount = Object.keys(result.parsed).length;
		logger.info(`[ENV] Successfully loaded ${parsedCount} variables from .env`);

		// Manually ensure variables are in process.env if dotenv didn't do it
		if (
			!process.env.DEFAULT_ADMIN_USERNAME &&
			result.parsed.DEFAULT_ADMIN_USERNAME
		) {
			Object.assign(process.env, result.parsed);
		}
	}
} catch (error) {
	if ((error as NodeJS.ErrnoException).code === "ENOENT") {
		logger.info(
			`[ENV] .env file not found at ${envPath} (expected in Docker/production)`,
		);
	} else {
		logger.error("[ENV] Failed to load .env file:", error);
	}
}

async function bootstrap() {
	/**
	 * Disable body parser for Better Auth compatibility
	 *
	 * Per @thallesp/nestjs-better-auth official docs, we must disable NestJS's
	 * built-in body parser to allow Better Auth to handle request bodies correctly.
	 */
	const app = await NestFactory.create(AppModule, {
		bodyParser: false, // Required for Better Auth's Node handler
	});

	/**
	 * CORS Configuration for Cross-Origin Requests
	 *
	 * Supports both separate domain deployment and Docker Compose scenarios.
	 * Environment variable FRONTEND_URL can contain comma-separated origins.
	 * Trailing slashes are removed to ensure consistent origin matching.
	 */
	const allowedOriginsRaw = process.env.FRONTEND_URL || "http://localhost:3000";

	// Split, trim whitespace, and remove trailing slashes from each origin
	const allowedOrigins = allowedOriginsRaw
		.split(",")
		.map((origin) => origin.trim().replace(/\/$/, ""))
		.filter((origin) => origin.length > 0);

	// Enable CORS for frontend with credentials support
	app.enableCors({
		origin: allowedOrigins,
		credentials: true, // Required for cookies in cross-origin requests
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		exposedHeaders: ["Set-Cookie"], // Allow browsers to access Set-Cookie header
	});

	// Get tRPC services from DI container
	const trpcService = app.get(TrpcService);
	const trpcContext = app.get(TrpcContext);

	/**
	 * Manually trigger onModuleInit if not already called
	 *
	 * TrpcService.onModuleInit() creates the router. We need to ensure it's called
	 * before we try to get the router, but we also need to mount middleware BEFORE
	 * the application is fully initialized to avoid routing issues.
	 */
	if (!trpcService.appRouter) {
		trpcService.onModuleInit();
	}

	// Create tRPC router (now safe to call)
	const appRouter = trpcService.getAppRouter();

	/**
	 * Mount Better Auth at /api/auth using the official Node integration.
	 */
	app.use("/api/auth", toNodeHandler(auth));

	/**
	 * Mount tRPC adapter at /trpc
	 *
	 * Following official tRPC Express adapter pattern.
	 * Context is created per-request with Express req/res objects.
	 */
	app.use(
		"/trpc",
		trpcExpress.createExpressMiddleware({
			router: appRouter,
			createContext: (opts: trpcExpress.CreateExpressContextOptions) =>
				trpcContext.create(opts),
		}),
	);

	// Start the HTTP server
	await app.listen(process.env.PORT ?? 3001);

	// Get the underlying HTTP server instance
	const httpServer = app.getHttpServer();

	// Create WebSocket server for tRPC subscriptions
	const wss = new WebSocketServer({
		server: httpServer,
		path: "/trpc-ws",
	});

	/**
	 * Apply tRPC WebSocket handler
	 *
	 * The WebSocket adapter exposes the upgrade request, so we propagate that
	 * request into tRPC context and reuse the same auth path as HTTP procedures.
	 */
	const wssHandler = applyWSSHandler({
		wss,
		router: appRouter,
		createContext: (opts) =>
			trpcContext.createWithRequest(
				opts.req as unknown as Parameters<
					typeof trpcContext.createWithRequest
				>[0],
				opts.res as unknown as Parameters<
					typeof trpcContext.createWithRequest
				>[1],
			),
		keepAlive: {
			enabled: true,
			pingMs: 30000, // Send ping every 30 seconds
			pongWaitMs: 5000, // Wait 5 seconds for pong response
		},
	});

	// Graceful shutdown for WebSocket connections
	process.on("SIGTERM", () => {
		logger.info("SIGTERM received, closing WebSocket connections...");
		wssHandler.broadcastReconnectNotification();
		wss.close();
	});

	logger.info(`Server running on http://localhost:${process.env.PORT ?? 3001}`);
	logger.info(
		`tRPC endpoint: http://localhost:${process.env.PORT ?? 3001}/trpc`,
	);
	logger.info(
		`tRPC WebSocket endpoint: ws://localhost:${process.env.PORT ?? 3001}/trpc-ws`,
	);
}
void bootstrap();
// Trigger build
