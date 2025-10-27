import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as trpcExpress from '@trpc/server/adapters/express';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { TrpcService } from './trpc/trpc.service';
import { TrpcContext } from './trpc/trpc.context';

async function bootstrap() {
  /**
   * CRITICAL: Disable body parser for Better Auth compatibility
   *
   * Per @thallesp/nestjs-better-auth official docs, we must disable NestJS's
   * built-in body parser to allow Better Auth to handle request bodies correctly.
   * The Better Auth module will automatically re-add the necessary body parsers.
   */
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required for Better Auth
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
   * Mount tRPC adapter at /trpc
   *
   * Using app.use() directly before app.listen().
   * This ensures the middleware is registered with Express before
   * the server starts accepting connections.
   */
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: () => trpcContext,
    }),
  );

  // Start the HTTP server
  await app.listen(process.env.PORT ?? 3001);

  // Get the underlying HTTP server instance
  const httpServer = app.getHttpServer();

  // Create WebSocket server for tRPC subscriptions
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/trpc-ws',
  });

  // Apply tRPC WebSocket handler
  const wssHandler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: () => trpcContext,
    keepAlive: {
      enabled: true,
      pingMs: 30000, // Send ping every 30 seconds
      pongWaitMs: 5000, // Wait 5 seconds for pong response
    },
  });

  // Graceful shutdown for WebSocket connections
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing WebSocket connections...');
    wssHandler.broadcastReconnectNotification();
    wss.close();
  });

  console.log(`Server running on http://localhost:${process.env.PORT ?? 3001}`);
  console.log(
    `tRPC endpoint: http://localhost:${process.env.PORT ?? 3001}/trpc`,
  );
  console.log(
    `tRPC WebSocket endpoint: ws://localhost:${process.env.PORT ?? 3001}/trpc-ws`,
  );
}
void bootstrap();
