import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as trpcExpress from '@trpc/server/adapters/express';
import type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  Express,
} from 'express';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { TrpcService } from './trpc/trpc.service';
import { TrpcContext } from './trpc/trpc.context';

async function bootstrap() {
  // Disable body parser for Better Auth to work correctly
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

  // Initialize the application so lifecycle hooks (onModuleInit) run
  // before we request providers that rely on those hooks.
  await app.init();

  // Get tRPC services from DI container
  const trpcService = app.get(TrpcService);
  const trpcContext = app.get(TrpcContext);

  // Create tRPC router
  const appRouter = trpcService.getAppRouter();

  // Mount tRPC adapter at /trpc
  // Create a single middleware instance so we can mount it for both POST
  // (batch requests) and explicit GET routes used by httpBatchLink when it
  // prefers GET for idempotent queries. This makes the backend accept
  // GET requests to /trpc/<procedure> while preserving the existing POST
  // behavior at /trpc.
  const trpcMiddleware: RequestHandler = trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => trpcContext,
  });

  // Handle standard POST/batched requests under the /trpc prefix
  app.use('/trpc', trpcMiddleware);

  // Explicitly accept GET requests to /trpc/:path and nested paths. Some
  // clients (httpBatchLink with prefer GET) call /trpc/<procedure>?...; to
  // make sure these are handled we register the same middleware on the
  // underlying Express instance if available, otherwise fall back to a
  // small GET-only wrapper mounted on the '/trpc' prefix.
  const httpAdapter = app.getHttpAdapter();
  const expressInstance = (httpAdapter as any)?.getInstance?.() as
    | Express
    | undefined;

  if (expressInstance && typeof expressInstance.get === 'function') {
    expressInstance.get('/trpc/:path', trpcMiddleware);
    expressInstance.get('/trpc/:path/*', trpcMiddleware);
  } else {
    // Fallback: mount a GET-only handler under /trpc that delegates to
    // the tRPC middleware for GET requests and passes through others.
    app.use('/trpc', (req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET') {
        return trpcMiddleware(req, res, next);
      }
      return next();
    });
  }

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
